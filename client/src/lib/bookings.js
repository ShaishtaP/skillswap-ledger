// Booking rules the UI needs to know, mirroring the server.
const DAY = 24 * 60 * 60 * 1000;

export function myRole(booking, user) {
  if (booking.myRole !== undefined) return booking.myRole;
  if (booking.teacher?.id === user?.id) return 'teacher';
  if (booking.learner?.id === user?.id) return 'learner';
  return null;
}

export const otherPerson = (booking, role) => (role === 'teacher' ? booking.learner : booking.teacher);
export const hasStarted = (booking, now = Date.now()) => new Date(booking.startsAt).getTime() <= now;
export const confirmedBy = (booking, role) => Boolean(role === 'teacher' ? booking.teacherConfirmedAt : booking.learnerConfirmedAt);

// Same window as the server: the call opens 10 minutes before the start and
// closes 15 minutes after the end.
const MINUTE = 60 * 1000;
export function isCallOpen(booking, now = Date.now()) {
  if (booking.status !== 'BOOKED') return false;
  return now >= new Date(booking.startsAt).getTime() - 10 * MINUTE && now <= new Date(booking.endsAt).getTime() + 15 * MINUTE;
}

// Same policy as the server: teacher cancels or >24h ahead → full refund,
// otherwise 50/50 with the odd minute going to the learner.
export function cancellationPreview(booking, role, now = Date.now()) {
  const credits = booking.credits;
  if (role === 'teacher' || new Date(booking.startsAt).getTime() - now > DAY) return { refund: credits, fee: 0 };
  const refund = Math.ceil(credits / 2);
  return { refund, fee: credits - refund };
}
