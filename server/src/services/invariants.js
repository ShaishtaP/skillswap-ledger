import { Booking, Dispute, LedgerEntry, Offer, User } from '../models/index.js';
import { OPEN_BOOKING_STATUSES } from '../models/Booking.js';
import { MINT, checkInvariants, escrowAccount, getBalance } from './ledger.js';

/**
 * Every booking's escrow must hold exactly what its status says:
 * open bookings (BOOKED, DISPUTED) hold the full price, closed ones hold 0.
 */
export async function checkEscrow() {
  const problems = [];
  const bookings = await Booking.find({}, { status: 1, credits: 1 }).lean();
  const sums = await LedgerEntry.aggregate([
    { $match: { account: /^escrow:/ } },
    { $group: { _id: '$account', sum: { $sum: '$amount' } } },
  ]);
  const held = new Map(sums.map((s) => [s._id, s.sum]));

  for (const booking of bookings) {
    const account = escrowAccount(booking._id);
    const expected = OPEN_BOOKING_STATUSES.includes(booking.status) ? booking.credits : 0;
    const actual = held.get(account) ?? 0;
    if (actual !== expected) problems.push(`${account} (${booking.status}) holds ${actual}, expected ${expected}`);
  }
  return { ok: problems.length === 0, bookingsChecked: bookings.length, problems };
}

export async function fullHealthReport() {
  const [ledger, escrow] = await Promise.all([checkInvariants(), checkEscrow()]);
  return { ok: ledger.ok && escrow.ok, checkedAt: new Date(), ledger, escrow };
}

export async function platformStats() {
  const [users, offers, byStatus, openDisputes, minted, entries] = await Promise.all([
    User.countDocuments(),
    Offer.countDocuments({ active: true }),
    Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, minutes: { $sum: '$credits' } } }]),
    Dispute.countDocuments({ status: 'OPEN' }),
    getBalance(MINT),
    LedgerEntry.countDocuments(),
  ]);
  const bookings = Object.fromEntries(byStatus.map((s) => [s._id, { count: s.count, minutes: s.minutes }]));
  // The mint's balance is minus everything ever issued.
  return { users, activeOffers: offers, openDisputes, creditsIssued: -minted, ledgerEntries: entries, bookings };
}
