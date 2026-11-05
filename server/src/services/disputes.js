import { Booking, Dispute } from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { idOf, runInTransaction } from '../utils/transaction.js';
import { roleOf } from './bookings.js';
import { escrowAccount, postTransaction, userAccount } from './ledger.js';
import { notifyBooking, notifyDispute } from './realtime.js';

const POPULATE = [
  { path: 'teacher', select: 'name' },
  { path: 'learner', select: 'name' },
  { path: 'openedBy', select: 'name' },
  { path: 'notes.author', select: 'name role' },
  { path: 'booking', select: 'offerTitle credits startsAt endsAt status teacherConfirmedAt learnerConfirmedAt' },
];

function describeSplit(learnerRefund, credits) {
  if (learnerRefund === credits) return 'full refund to the learner';
  if (learnerRefund === 0) return 'full payment to the teacher';
  return `${learnerRefund} min back to the learner, ${credits - learnerRefund} min to the teacher`;
}

function checkRefund(learnerRefund, credits) {
  if (!Number.isInteger(learnerRefund) || learnerRefund < 0 || learnerRefund > credits) {
    throw new AppError(400, 'INVALID_AMOUNT', `Refund must be a whole number between 0 and ${credits}`);
  }
}

async function loadDispute(disputeId, session) {
  const dispute = await Dispute.findById(disputeId).session(session);
  if (!dispute) throw new AppError(404, 'NOT_FOUND', 'Dispute not found');
  return dispute;
}

/**
 * Either party can dispute a session once it has started (e.g. "teacher
 * didn't show up"). The credits stay frozen in escrow until it's resolved.
 */
export async function openDispute(userId, bookingId, reason, { now = new Date() } = {}) {
  const { dispute, booking } = await runInTransaction(async (session) => {
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
    if (!roleOf(booking, userId)) throw new AppError(403, 'FORBIDDEN', 'This is not your booking');
    if (booking.status !== 'BOOKED') throw new AppError(409, 'BOOKING_CLOSED', `This booking is ${booking.status.toLowerCase()}`);
    if (now < booking.startsAt) throw new AppError(409, 'TOO_EARLY', 'You can dispute once the session has started. Cancel it instead.');

    const [created] = await Dispute.create(
      [
        {
          booking: booking._id,
          teacher: booking.teacher,
          learner: booking.learner,
          openedBy: userId,
          reason,
          notes: [{ author: userId, text: reason }],
        },
      ],
      { session },
    );
    const moved = await Booking.updateOne(
      { _id: booking._id, status: 'BOOKED' },
      { $set: { status: 'DISPUTED', dispute: created._id } },
      { session },
    );
    if (moved.modifiedCount !== 1) throw new AppError(409, 'CONFLICT', 'This booking just changed, please refresh');
    return { dispute: created, booking };
  });

  notifyDispute(dispute, 'opened', { includeAdmins: true });
  notifyBooking({ ...booking.toJSON(), status: 'DISPUTED' }, 'disputed');
  return dispute;
}

/** Suggest how to split the escrow. Replaces any earlier proposal. */
export async function proposeResolution(userId, disputeId, learnerRefund, { now = new Date() } = {}) {
  const dispute = await loadDispute(disputeId);
  const role = roleOf(dispute, userId);
  if (!role) throw new AppError(403, 'FORBIDDEN', 'This is not your dispute');
  if (dispute.status !== 'OPEN') throw new AppError(409, 'DISPUTE_CLOSED', 'This dispute is already resolved');

  const booking = await Booking.findById(dispute.booking);
  checkRefund(learnerRefund, booking.credits);

  const updated = await Dispute.findOneAndUpdate(
    { _id: dispute._id, status: 'OPEN' },
    {
      $set: { proposal: { by: userId, learnerRefund, at: now } },
      $push: { notes: { author: userId, kind: 'SYSTEM', text: `The ${role} proposed: ${describeSplit(learnerRefund, booking.credits)}` } },
    },
    { returnDocument: 'after' },
  );
  if (!updated) throw new AppError(409, 'DISPUTE_CLOSED', 'This dispute is already resolved');
  notifyDispute(updated, 'proposed');
  return updated;
}

// Closes the dispute and pays out the escrow. The conditional update on
// status OPEN means that if the other party accepts at the same moment an
// admin decides, only the first one is applied.
async function resolve(session, dispute, { learnerRefund, method, actorId, now, note }) {
  const booking = await Booking.findById(dispute.booking).session(session);
  checkRefund(learnerRefund, booking.credits);
  const teacherPayout = booking.credits - learnerRefund;

  const resolved = await Dispute.findOneAndUpdate(
    { _id: dispute._id, status: 'OPEN' },
    {
      $set: { status: 'RESOLVED', resolution: { method, learnerRefund, teacherPayout, resolvedBy: actorId, at: now } },
      $push: { notes: { author: actorId, kind: 'SYSTEM', text: note } },
    },
    { session, returnDocument: 'after' },
  );
  if (!resolved) throw new AppError(409, 'DISPUTE_CLOSED', 'This dispute is already resolved');

  await Booking.updateOne({ _id: booking._id, status: 'DISPUTED' }, { $set: { status: 'RESOLVED' } }, { session });

  await postTransaction(
    {
      key: `resolve:${booking.id}`,
      type: 'DISPUTE_RESOLUTION',
      bookingId: booking._id,
      memo: `Dispute on "${booking.offerTitle}" resolved`,
      at: now,
      legs: [
        { account: escrowAccount(booking.id), amount: -booking.credits },
        { account: userAccount(idOf(booking.learner)), amount: learnerRefund },
        { account: userAccount(idOf(booking.teacher)), amount: teacherPayout },
      ].filter((leg) => leg.amount !== 0),
    },
    { session },
  );
  return { resolved, booking };
}

/**
 * The other party accepts the current proposal. They send the amount they
 * saw, so if the proposal changed a moment before, nothing is applied.
 */
export async function acceptProposal(userId, disputeId, expectedRefund, { now = new Date() } = {}) {
  const { resolved, booking } = await runInTransaction(async (session) => {
    const dispute = await loadDispute(disputeId, session);
    if (!roleOf(dispute, userId)) throw new AppError(403, 'FORBIDDEN', 'This is not your dispute');
    if (dispute.status !== 'OPEN') throw new AppError(409, 'DISPUTE_CLOSED', 'This dispute is already resolved');
    if (!dispute.proposal) throw new AppError(409, 'NO_PROPOSAL', 'There is no proposal to accept yet');
    if (idOf(dispute.proposal.by) === String(userId)) throw new AppError(409, 'OWN_PROPOSAL', 'The other person has to accept your proposal');
    if (dispute.proposal.learnerRefund !== expectedRefund) {
      throw new AppError(409, 'PROPOSAL_CHANGED', 'The proposal was just changed, please review it again');
    }
    return resolve(session, dispute, {
      learnerRefund: dispute.proposal.learnerRefund,
      method: 'AGREEMENT',
      actorId: userId,
      now,
      note: 'Both parties agreed. Dispute resolved.',
    });
  });
  notifyDispute(resolved, 'resolved', { includeAdmins: true });
  notifyBooking({ ...booking.toJSON(), status: 'RESOLVED' }, 'resolved');
  return resolved;
}

/** An admin decides the split. Final. */
export async function adminResolve(adminId, disputeId, learnerRefund, note, { now = new Date() } = {}) {
  const { resolved, booking } = await runInTransaction(async (session) => {
    const dispute = await loadDispute(disputeId, session);
    if (dispute.status !== 'OPEN') throw new AppError(409, 'DISPUTE_CLOSED', 'This dispute is already resolved');
    const credits = (await Booking.findById(dispute.booking).session(session)).credits;
    checkRefund(learnerRefund, credits);
    return resolve(session, dispute, {
      learnerRefund,
      method: 'ADMIN',
      actorId: adminId,
      now,
      note: `Admin decision: ${describeSplit(learnerRefund, credits)}.${note ? ` ${note}` : ''}`,
    });
  });
  notifyDispute(resolved, 'resolved', { includeAdmins: true });
  notifyBooking({ ...booking.toJSON(), status: 'RESOLVED' }, 'resolved');
  return resolved;
}

export async function addNote(user, disputeId, text) {
  const dispute = await loadDispute(disputeId);
  if (!roleOf(dispute, user.id) && user.role !== 'admin') throw new AppError(403, 'FORBIDDEN', 'This is not your dispute');
  const updated = await Dispute.findByIdAndUpdate(
    dispute._id,
    { $push: { notes: { author: user.id, text } } },
    { returnDocument: 'after' },
  );
  notifyDispute(updated, 'note', { includeAdmins: true });
  return updated;
}

export async function getDispute(user, disputeId) {
  const dispute = await Dispute.findById(disputeId).populate(POPULATE);
  if (!dispute) throw new AppError(404, 'NOT_FOUND', 'Dispute not found');
  const myRole = roleOf(dispute, user.id);
  if (!myRole && user.role !== 'admin') throw new AppError(403, 'FORBIDDEN', 'This is not your dispute');
  return { ...dispute.toJSON(), myRole };
}

export async function listDisputes({ status } = {}) {
  const filter = status ? { status } : {};
  return Dispute.find(filter).sort({ createdAt: -1 }).limit(100).populate(POPULATE);
}
