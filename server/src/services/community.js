import { Booking, Offer, Slot, User } from '../models/index.js';
import { checkInvariants } from './ledger.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const firstName = (name = '') => name.split(' ')[0];

// Numbers for the homepage hero. Everything is computed from real data;
// "unaccounted minutes" is the ledger total, which should always be 0.
export async function publicStats({ now = new Date() } = {}) {
  const weekAhead = new Date(now.getTime() + 7 * DAY_MS);
  const [members, openSeats, offers, crafts, ledger] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    Slot.countDocuments({ status: 'OPEN', startsAt: { $gt: now, $lte: weekAhead } }),
    Offer.countDocuments({ active: true }),
    Offer.distinct('category', { active: true }),
    checkInvariants(),
  ]);
  return { members, openSeats, offers, crafts: crafts.length, unaccountedMinutes: Math.abs(ledger.total), ledgerBalanced: ledger.ok };
}

// The "recently swapped" strip: latest completed sessions, first names only.
export async function recentSwaps({ limit = 12 } = {}) {
  const bookings = await Booking.find({ status: 'COMPLETED' })
    .sort({ completedAt: -1 })
    .limit(limit)
    .populate('teacher', 'name')
    .populate('learner', 'name');
  return bookings.map((b) => ({
    id: b.id,
    teacher: firstName(b.teacher?.name),
    learner: firstName(b.learner?.name),
    offerTitle: b.offerTitle,
    minutes: b.credits,
    completedAt: b.completedAt,
  }));
}
