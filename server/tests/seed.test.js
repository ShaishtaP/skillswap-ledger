import { describe, expect, it } from 'vitest';
import { Booking, Dispute, Slot, User } from '../src/models/index.js';
import { seedDemo } from '../src/seed/demoData.js';
import { fullHealthReport } from '../src/services/invariants.js';
import { getBalance, userAccount } from '../src/services/ledger.js';

describe('demo data', () => {
  it('builds every scenario and leaves the ledger healthy', async () => {
    await seedDemo();

    const count = async (status) => Booking.countDocuments({ status });
    expect(await User.countDocuments()).toBe(9);
    expect(await count('COMPLETED')).toBe(9);
    expect(await count('CANCELLED')).toBe(3);
    expect(await count('DISPUTED')).toBe(2);
    expect(await count('BOOKED')).toBe(5); // 2 waiting for confirmation + 3 upcoming
    expect(await Dispute.countDocuments({ 'proposal.learnerRefund': 15 })).toBe(1);
    expect(await Slot.countDocuments({ status: 'OPEN', startsAt: { $gt: new Date() } })).toBeGreaterThanOrEqual(30);

    const report = await fullHealthReport();
    expect(report.ledger.problems).toEqual([]);
    expect(report.escrow.problems).toEqual([]);

    for (const user of await User.find()) {
      expect(await getBalance(userAccount(user.id))).toBeGreaterThanOrEqual(0);
    }
  });
});
