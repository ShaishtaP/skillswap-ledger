import { Booking, Offer, Slot } from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { idOf, runInTransaction } from '../utils/transaction.js';
import { escrowAccount, postTransaction, userAccount } from './ledger.js';
import { searchRegex } from './offers.js';
import { notifyBooking } from './realtime.js';

export const LATE_CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;
const CONFIRM_FIELD = { teacher: 'teacherConfirmedAt', learner: 'learnerConfirmedAt' };
const PEOPLE = [
  { path: 'teacher', select: 'name' },
  { path: 'learner', select: 'name' },
];

export function roleOf(booking, userId) {
  if (idOf(booking.teacher) === String(userId)) return 'teacher';
  if (idOf(booking.learner) === String(userId)) return 'learner';
  return null;
}

// Drop zero-minute legs (e.g. a full refund has no teacher share).
const nonZero = (legs) => legs.filter((leg) => leg.amount !== 0);

async function loadForParty(bookingId, userId, session) {
  const booking = await Booking.findById(bookingId).session(session);
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  const role = roleOf(booking, userId);
  if (!role) throw new AppError(403, 'FORBIDDEN', 'This is not your booking');
  return { booking, role };
}

/**
 * Book a slot: claim it, create the booking and move the learner's credits
 * into escrow. All three happen together or not at all.
 */
export async function bookSlot(learnerId, slotId, { now = new Date() } = {}) {
  const booking = await runInTransaction(async (session) => {
    const slot = await Slot.findById(slotId).session(session);
    if (!slot) throw new AppError(404, 'NOT_FOUND', 'Slot not found');
    if (idOf(slot.teacher) === String(learnerId)) throw new AppError(400, 'OWN_SLOT', 'You cannot book your own session');

    const offer = await Offer.findById(slot.offer).session(session);
    if (!offer?.active) throw new AppError(409, 'SLOT_UNAVAILABLE', 'This offer is no longer available');

    // The key step: only succeeds if the slot is still OPEN. If two learners
    // try at the same moment, MongoDB lets exactly one of them through.
    const claimed = await Slot.findOneAndUpdate(
      { _id: slot._id, status: 'OPEN', startsAt: { $gt: now } },
      { $set: { status: 'BOOKED' } },
      { session, returnDocument: 'after' },
    );
    if (!claimed) throw new AppError(409, 'SLOT_UNAVAILABLE', 'Someone just booked this slot, or it has already started');

    const credits = Math.round((slot.endsAt - slot.startsAt) / 60_000);
    const [created] = await Booking.create(
      [
        {
          offer: offer._id,
          slot: slot._id,
          teacher: slot.teacher,
          learner: learnerId,
          offerTitle: offer.title,
          skills: offer.skills,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          credits,
        },
      ],
      { session },
    );

    await postTransaction(
      {
        key: `hold:${created.id}`,
        type: 'BOOKING_HOLD',
        bookingId: created._id,
        memo: `Booked "${offer.title}"`,
        at: now,
        legs: [
          { account: userAccount(learnerId), amount: -credits },
          { account: escrowAccount(created.id), amount: credits },
        ],
      },
      { session },
    );
    return created;
  });

  notifyBooking(booking, 'booked');
  return booking;
}

/**
 * Teacher or learner confirms the session happened. When the second one
 * confirms, the escrowed credits are paid to the teacher, exactly once.
 * Calling it again is safe: it just returns the booking unchanged.
 */
export async function confirmAttendance(userId, bookingId, { now = new Date() } = {}) {
  let settled = false;
  const booking = await runInTransaction(async (session) => {
    settled = false; // reset in case the transaction is retried
    const { booking: current, role } = await loadForParty(bookingId, userId, session);
    const field = CONFIRM_FIELD[role];

    if (current[field]) return current; // already confirmed: nothing to do
    if (current.status !== 'BOOKED') throw new AppError(409, 'BOOKING_CLOSED', `This booking is ${current.status.toLowerCase()}`);
    if (now < current.startsAt) throw new AppError(409, 'TOO_EARLY', 'You can confirm once the session has started');

    let updated = await Booking.findOneAndUpdate(
      { _id: current._id, status: 'BOOKED', [field]: null },
      { $set: { [field]: now } },
      { session, returnDocument: 'after' },
    );
    if (!updated) throw new AppError(409, 'CONFLICT', 'This booking just changed, please refresh');

    if (updated.teacherConfirmedAt && updated.learnerConfirmedAt) {
      updated = await Booking.findOneAndUpdate(
        { _id: current._id, status: 'BOOKED' },
        { $set: { status: 'COMPLETED', completedAt: now } },
        { session, returnDocument: 'after' },
      );
      // The key `settle:<id>` can only ever be written once, so even if this
      // code somehow ran twice the teacher would still be paid once.
      await postTransaction(
        {
          key: `settle:${current.id}`,
          type: 'SETTLEMENT',
          bookingId: current._id,
          memo: `Taught "${current.offerTitle}"`,
          at: now,
          legs: [
            { account: escrowAccount(current.id), amount: -current.credits },
            { account: userAccount(idOf(current.teacher)), amount: current.credits },
          ],
        },
        { session },
      );
      settled = true;
    }
    return updated;
  });

  notifyBooking(booking, settled ? 'completed' : 'confirmed');
  return booking;
}

/**
 * Who gets what when a booking is cancelled:
 *  - teacher cancels                      → learner gets everything back
 *  - learner cancels more than 24h before → learner gets everything back
 *  - learner cancels within 24h           → 50/50 (odd minute goes to the learner)
 */
export function cancellationSplit({ credits, startsAt }, role, now) {
  if (role === 'teacher' || startsAt - now > LATE_CANCEL_WINDOW_MS) return { refund: credits, fee: 0 };
  const refund = Math.ceil(credits / 2);
  return { refund, fee: credits - refund };
}

export async function cancelBooking(userId, bookingId, { now = new Date() } = {}) {
  const booking = await runInTransaction(async (session) => {
    const { booking: current, role } = await loadForParty(bookingId, userId, session);
    if (current.status !== 'BOOKED') throw new AppError(409, 'BOOKING_CLOSED', `This booking is ${current.status.toLowerCase()}`);
    if (now >= current.startsAt) {
      throw new AppError(409, 'TOO_LATE', 'This session has already started. Open a dispute if something went wrong.');
    }

    const { refund, fee } = cancellationSplit(current, role, now);
    const updated = await Booking.findOneAndUpdate(
      { _id: current._id, status: 'BOOKED' },
      { $set: { status: 'CANCELLED', cancelledBy: role, cancelledAt: now, refundMinutes: refund, feeMinutes: fee } },
      { session, returnDocument: 'after' },
    );

    // If the learner cancels, the time is free again for someone else.
    // If the teacher cancels, they can't make it, so the slot is closed.
    await Slot.updateOne({ _id: current.slot }, { $set: { status: role === 'learner' ? 'OPEN' : 'CLOSED' } }, { session });

    await postTransaction(
      {
        key: `cancel:${current.id}`,
        type: fee > 0 ? 'CANCELLATION_FEE' : 'REFUND',
        bookingId: current._id,
        memo: `"${current.offerTitle}" cancelled by ${role}`,
        at: now,
        legs: nonZero([
          { account: escrowAccount(current.id), amount: -current.credits },
          { account: userAccount(idOf(current.learner)), amount: refund },
          { account: userAccount(idOf(current.teacher)), amount: fee },
        ]),
      },
      { session },
    );
    return updated;
  });

  notifyBooking(booking, 'cancelled');
  return booking;
}

// The user's sessions (as learner, teacher or both), newest first, with
// optional status filter and text search over title and skills.
export async function listBookings(userId, { role, status, q, limit = 100 } = {}) {
  const filter = {};
  if (role === 'learner') filter.learner = userId;
  else if (role === 'teacher') filter.teacher = userId;
  else filter.$or = [{ learner: userId }, { teacher: userId }];

  if (status?.length) filter.status = { $in: status };
  if (q?.trim()) {
    const re = searchRegex(q);
    filter.$and = [{ $or: [{ offerTitle: re }, { skills: re }] }];
  }

  return Booking.find(filter).sort({ startsAt: -1 }).limit(limit).populate(PEOPLE);
}

export async function getBooking(user, bookingId) {
  const booking = await Booking.findById(bookingId).populate(PEOPLE);
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  const role = roleOf(booking, user.id);
  if (!role && user.role !== 'admin') throw new AppError(403, 'FORBIDDEN', 'This is not your booking');
  return { ...booking.toJSON(), myRole: role };
}
