import { describe, expect, it } from 'vitest';
import { Booking, LedgerEntry, User } from '../src/models/index.js';
import { bookSlot } from '../src/services/bookings.js';
import { acceptProposal, addNote, adminResolve, getDispute, openDispute, proposeResolution } from '../src/services/disputes.js';
import { escrowAccount, getBalance } from '../src/services/ledger.js';
import { balanceOf, during, expectHealthy, makeSlot, makeUser } from './helpers.js';

async function disputedBooking() {
  const teacher = await makeUser('Teacher');
  const learner = await makeUser('Learner');
  const admin = await makeUser('Admin');
  await User.updateOne({ _id: admin.id }, { role: 'admin' });
  const { slot } = await makeSlot(teacher);
  const booking = await bookSlot(learner.id, slot.id);
  const dispute = await openDispute(learner.id, booking.id, 'The teacher did not join the call', { now: during(slot) });
  return { teacher, learner, admin, slot, booking, dispute };
}

describe('opening a dispute', () => {
  it('cannot dispute before the session starts', async () => {
    const teacher = await makeUser('Teacher');
    const learner = await makeUser('Learner');
    const { slot } = await makeSlot(teacher);
    const booking = await bookSlot(learner.id, slot.id);
    await expect(openDispute(learner.id, booking.id, 'Too early to know')).rejects.toMatchObject({ code: 'TOO_EARLY' });
  });

  it('freezes the credits in escrow', async () => {
    const { teacher, booking } = await disputedBooking();

    expect((await Booking.findById(booking.id)).status).toBe('DISPUTED');
    expect(await getBalance(escrowAccount(booking.id))).toBe(60);
    expect(await balanceOf(teacher)).toBe(120);
    await expectHealthy(expect);
  });

  it('cannot be opened twice for the same booking', async () => {
    const { teacher, booking, slot } = await disputedBooking();
    await expect(openDispute(teacher.id, booking.id, 'Opening it again', { now: during(slot) })).rejects.toMatchObject({
      code: 'BOOKING_CLOSED',
    });
  });
});

describe('resolving by agreement', () => {
  it('applies the split once the other person accepts', async () => {
    const { teacher, learner, booking, dispute } = await disputedBooking();

    await proposeResolution(teacher.id, dispute.id, 30);
    const resolved = await acceptProposal(learner.id, dispute.id, 30);

    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolution).toMatchObject({ method: 'AGREEMENT', learnerRefund: 30, teacherPayout: 30 });
    expect((await Booking.findById(booking.id)).status).toBe('RESOLVED');
    expect(await balanceOf(learner)).toBe(90);
    expect(await balanceOf(teacher)).toBe(150);
    await expectHealthy(expect);
  });

  it('does not let someone accept their own proposal', async () => {
    const { teacher, dispute } = await disputedBooking();
    await proposeResolution(teacher.id, dispute.id, 0);
    await expect(acceptProposal(teacher.id, dispute.id, 0)).rejects.toMatchObject({ code: 'OWN_PROPOSAL' });
  });

  it('refuses to accept a proposal that changed in the meantime', async () => {
    const { teacher, learner, dispute } = await disputedBooking();
    await proposeResolution(teacher.id, dispute.id, 60);
    await proposeResolution(teacher.id, dispute.id, 10); // teacher changes their mind

    await expect(acceptProposal(learner.id, dispute.id, 60)).rejects.toMatchObject({ code: 'PROPOSAL_CHANGED' });
  });

  it('rejects refunds larger than the booking', async () => {
    const { teacher, dispute } = await disputedBooking();
    await expect(proposeResolution(teacher.id, dispute.id, 61)).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
  });

  it('keeps a timeline of notes and proposals', async () => {
    const { teacher, learner, dispute } = await disputedBooking();
    await addNote({ id: teacher.id, role: 'user' }, dispute.id, 'I was there, here is a screenshot');
    await proposeResolution(teacher.id, dispute.id, 30);

    const view = await getDispute({ id: learner.id, role: 'user' }, dispute.id);
    expect(view.notes.map((n) => n.kind)).toEqual(['NOTE', 'NOTE', 'SYSTEM']);
    expect(view.notes[2].text).toMatch(/teacher proposed: 30 min back to the learner/);
  });
});

describe('resolving by admin', () => {
  it('applies the admin decision', async () => {
    const { learner, admin, dispute } = await disputedBooking();
    const resolved = await adminResolve(admin.id, dispute.id, 60, 'No evidence the session took place');

    expect(resolved.resolution).toMatchObject({ method: 'ADMIN', learnerRefund: 60, teacherPayout: 0 });
    expect(await balanceOf(learner)).toBe(120);
    await expectHealthy(expect);
  });

  it('pays out once when an agreement and an admin decision land together', async () => {
    const { teacher, learner, admin, dispute } = await disputedBooking();
    await proposeResolution(teacher.id, dispute.id, 30);

    const results = await Promise.allSettled([acceptProposal(learner.id, dispute.id, 30), adminResolve(admin.id, dispute.id, 60)]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await LedgerEntry.countDocuments({ type: 'DISPUTE_RESOLUTION' })).toBeGreaterThan(0);
    expect(await LedgerEntry.distinct('txKey', { type: 'DISPUTE_RESOLUTION' })).toHaveLength(1);
    await expectHealthy(expect);
  });

  it('only parties and admins can see a dispute', async () => {
    const { dispute } = await disputedBooking();
    const stranger = await makeUser('Stranger');
    await expect(getDispute({ id: stranger.id, role: 'user' }, dispute.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
