import mongoose from 'mongoose';
import { Booking, CallAttendance } from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { roleOf } from './bookings.js';

const MINUTE = 60 * 1000;
export const CALL_OPENS_BEFORE_MS = 10 * MINUTE;
export const CALL_CLOSES_AFTER_MS = 15 * MINUTE;

// The call is open from 10 minutes before the start to 15 minutes after the end.
export function callWindow(booking) {
  return {
    opensAt: new Date(booking.startsAt.getTime() - CALL_OPENS_BEFORE_MS),
    closesAt: new Date(booking.endsAt.getTime() + CALL_CLOSES_AFTER_MS),
  };
}

export function callStatus(booking, now = new Date()) {
  const { opensAt, closesAt } = callWindow(booking);
  if (now < opensAt) return 'upcoming';
  if (now > closesAt) return 'closed';
  return 'open';
}

/** Checks that this user may be in this booking's call right now. */
export async function authorizeCall(userId, bookingId, { now = new Date() } = {}) {
  if (!mongoose.isValidObjectId(bookingId)) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  const role = roleOf(booking, userId);
  if (!role) throw new AppError(403, 'FORBIDDEN', 'Only the teacher and the learner can join this call');
  if (booking.status !== 'BOOKED') throw new AppError(409, 'BOOKING_CLOSED', `This session is ${booking.status.toLowerCase()}`);

  const { opensAt, closesAt } = callWindow(booking);
  if (now < opensAt) throw new AppError(409, 'CALL_NOT_OPEN', 'The call opens 10 minutes before the session starts', { opensAt });
  if (now > closesAt) throw new AppError(409, 'CALL_CLOSED', 'The call for this session has ended');
  return { booking, role, opensAt, closesAt };
}

// The browser tells us when its video connection is actually up or down;
// the times recorded are always the server's own clock.
export async function markConnected(bookingId, userId, role, { now = new Date() } = {}) {
  await markDisconnected(bookingId, userId, { now });
  return CallAttendance.create({ booking: bookingId, user: userId, role, connectedAt: now });
}

export async function markDisconnected(bookingId, userId, { now = new Date() } = {}) {
  await CallAttendance.updateMany({ booking: bookingId, user: userId, disconnectedAt: null }, { $set: { disconnectedAt: now } });
}

// Joins overlapping [start, end] intervals so time isn't counted twice.
function merge(intervals) {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [start, end] of sorted) {
    const last = out.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else out.push([start, end]);
  }
  return out;
}

const total = (intervals) => intervals.reduce((sum, [a, b]) => sum + (b - a), 0);

function overlap(a, b) {
  let ms = 0;
  for (const [s1, e1] of a) for (const [s2, e2] of b) ms += Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));
  return ms;
}

/**
 * Who was on the call, and for how long, counting only the scheduled
 * session time. Example: { teacher: { minutes: 56, joined: true }, ..., togetherMinutes: 55 }
 */
export async function attendanceSummary(booking, { now = new Date() } = {}) {
  const rows = await CallAttendance.find({ booking: booking._id }).sort({ connectedAt: 1 });
  const { closesAt } = callWindow(booking);
  const start = booking.startsAt.getTime();
  const end = booking.endsAt.getTime();
  const stillOpenUntil = Math.min(now.getTime(), closesAt.getTime());

  const intervalsFor = (role) =>
    merge(
      rows
        .filter((r) => r.role === role)
        .map((r) => [Math.max(r.connectedAt.getTime(), start), Math.min((r.disconnectedAt?.getTime() ?? stillOpenUntil), end)])
        .filter(([a, b]) => b > a),
    );

  const teacher = intervalsFor('teacher');
  const learner = intervalsFor('learner');
  const person = (role, intervals) => ({
    joined: rows.some((r) => r.role === role),
    minutes: Math.round(total(intervals) / MINUTE),
    connectedNow: rows.some((r) => r.role === role && !r.disconnectedAt),
  });

  return {
    sessionMinutes: booking.credits,
    teacher: person('teacher', teacher),
    learner: person('learner', learner),
    togetherMinutes: Math.round(overlap(teacher, learner) / MINUTE),
    timeline: rows.map((r) => ({ role: r.role, connectedAt: r.connectedAt, disconnectedAt: r.disconnectedAt })),
  };
}

/** Everything the booking page needs about the call. Parties and admins only. */
export async function getCallInfo(user, bookingId, { now = new Date() } = {}) {
  if (!mongoose.isValidObjectId(bookingId)) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  const role = roleOf(booking, user.id);
  if (!role && user.role !== 'admin') throw new AppError(403, 'FORBIDDEN', 'This is not your booking');

  const status = callStatus(booking, now);
  return {
    ...callWindow(booking),
    status,
    canJoin: Boolean(role) && booking.status === 'BOOKED' && status === 'open',
    attendance: await attendanceSummary(booking, { now }),
  };
}
