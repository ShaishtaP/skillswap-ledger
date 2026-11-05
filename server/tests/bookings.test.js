import { describe, expect, it } from 'vitest';
import { Booking, LedgerEntry, Slot } from '../src/models/index.js';
import { bookSlot, cancelBooking, cancellationSplit, confirmAttendance } from '../src/services/bookings.js';
import { escrowAccount, getBalance } from '../src/services/ledger.js';
import { DAY, HOUR, balanceOf, during, expectHealthy, makeSlot, makeUser } from './helpers.js';

async function setup(options) {
  const teacher = await makeUser('Teacher');
  const learner = await makeUser('Learner');
  const { slot } = await makeSlot(teacher, options);
  return { teacher, learner, slot };
}

describe('booking a slot', () => {
  it('claims the slot and moves the price into escrow', async () => {
    const { learner, slot } = await setup();
    const booking = await bookSlot(learner.id, slot.id);

    expect(booking.status).toBe('BOOKED');
    expect(booking.credits).toBe(60);
    expect((await Slot.findById(slot.id)).status).toBe('BOOKED');
    expect(await balanceOf(learner)).toBe(60);
    expect(await getBalance(escrowAccount(booking.id))).toBe(60);
    await expectHealthy(expect);
  });

  it('does not let a teacher book their own slot', async () => {
    const { teacher, slot } = await setup();
    await expect(bookSlot(teacher.id, slot.id)).rejects.toMatchObject({ code: 'OWN_SLOT' });
  });

  it('gives a slot to exactly one of five learners booking at the same moment', async () => {
    const { slot } = await setup();
    const learners = await Promise.all([1, 2, 3, 4, 5].map((i) => makeUser(`Learner${i}`)));

    const results = await Promise.allSettled(learners.map((l) => bookSlot(l.id, slot.id)));

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected').map((r) => r.reason.code)).toEqual(Array(4).fill('SLOT_UNAVAILABLE'));
    expect(await Booking.countDocuments()).toBe(1);
    await expectHealthy(expect);
  });

  it('rolls everything back when the learner cannot afford it', async () => {
    const { learner, slot } = await setup({ duration: 180 }); // costs 180, learner has 120

    await expect(bookSlot(learner.id, slot.id)).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
    expect((await Slot.findById(slot.id)).status).toBe('OPEN'); // slot was released again
    expect(await Booking.countDocuments()).toBe(0);
    expect(await balanceOf(learner)).toBe(120);
  });

  it('does not book a slot that has already started', async () => {
    const { learner, slot } = await setup();
    await expect(bookSlot(learner.id, slot.id, { now: during(slot) })).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
  });
});

describe('confirming attendance', () => {
  it('cannot confirm before the session starts', async () => {
    const { learner, slot } = await setup();
    const booking = await bookSlot(learner.id, slot.id);
    await expect(confirmAttendance(learner.id, booking.id)).rejects.toMatchObject({ code: 'TOO_EARLY' });
  });

  it('pays the teacher only after both people confirm', async () => {
    const { teacher, learner, slot } = await setup();
    const booking = await bookSlot(learner.id, slot.id);
    const now = during(slot);

    const afterLearner = await confirmAttendance(learner.id, booking.id, { now });
    expect(afterLearner.status).toBe('BOOKED');
    expect(await balanceOf(teacher)).toBe(120);

    const afterTeacher = await confirmAttendance(teacher.id, booking.id, { now });
    expect(afterTeacher.status).toBe('COMPLETED');
    expect(await balanceOf(teacher)).toBe(180);
    expect(await getBalance(escrowAccount(booking.id))).toBe(0);
    await expectHealthy(expect);
  });

  it('treats a repeated confirmation as a no-op', async () => {
    const { learner, slot } = await setup();
    const booking = await bookSlot(learner.id, slot.id);
    const now = during(slot);

    const first = await confirmAttendance(learner.id, booking.id, { now });
    const second = await confirmAttendance(learner.id, booking.id, { now: new Date(now.getTime() + HOUR) });
    expect(second.learnerConfirmedAt).toEqual(first.learnerConfirmedAt);
  });

  it('settles exactly once when both confirm at the same moment, repeatedly', async () => {
    const { teacher, learner, slot } = await setup();
    const booking = await bookSlot(learner.id, slot.id);
    const now = during(slot);

    // 5 confirmations from each side, all fired together (e.g. double-clicks and retries).
    const calls = [...Array(5).fill(teacher), ...Array(5).fill(learner)].map((u) => confirmAttendance(u.id, booking.id, { now }));
    await Promise.all(calls);

    expect((await Booking.findById(booking.id)).status).toBe('COMPLETED');
    expect(await balanceOf(teacher)).toBe(180);
    expect(await LedgerEntry.countDocuments({ type: 'SETTLEMENT' })).toBe(2); // one transaction = two legs
    await expectHealthy(expect);
  });

  it('only lets the two people in the booking confirm it', async () => {
    const { learner, slot } = await setup();
    const stranger = await makeUser('Stranger');
    const booking = await bookSlot(learner.id, slot.id);
    await expect(confirmAttendance(stranger.id, booking.id, { now: during(slot) })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('cancellation policy', () => {
  it('splits 50/50 inside 24h, giving the odd minute to the learner', () => {
    const startsAt = new Date('2026-01-02T10:00:00Z');
    const lateNow = new Date('2026-01-02T08:00:00Z');
    const earlyNow = new Date('2025-12-30T10:00:00Z');

    expect(cancellationSplit({ credits: 60, startsAt }, 'learner', lateNow)).toEqual({ refund: 30, fee: 30 });
    expect(cancellationSplit({ credits: 45, startsAt }, 'learner', lateNow)).toEqual({ refund: 23, fee: 22 });
    expect(cancellationSplit({ credits: 60, startsAt }, 'learner', earlyNow)).toEqual({ refund: 60, fee: 0 });
    expect(cancellationSplit({ credits: 60, startsAt }, 'teacher', lateNow)).toEqual({ refund: 60, fee: 0 });
  });

  it('learner cancelling early gets a full refund and the slot reopens', async () => {
    const { teacher, learner, slot } = await setup({ startsIn: 3 * DAY });
    const booking = await bookSlot(learner.id, slot.id);

    const cancelled = await cancelBooking(learner.id, booking.id);
    expect(cancelled).toMatchObject({ status: 'CANCELLED', cancelledBy: 'learner', refundMinutes: 60, feeMinutes: 0 });
    expect(await balanceOf(learner)).toBe(120);
    expect(await balanceOf(teacher)).toBe(120);
    expect((await Slot.findById(slot.id)).status).toBe('OPEN');
    await expectHealthy(expect);
  });

  it('learner cancelling late pays the teacher half', async () => {
    const { teacher, learner, slot } = await setup();
    const booking = await bookSlot(learner.id, slot.id);

    await cancelBooking(learner.id, booking.id, { now: new Date(slot.startsAt.getTime() - 2 * HOUR) });
    expect(await balanceOf(learner)).toBe(90);
    expect(await balanceOf(teacher)).toBe(150);
    await expectHealthy(expect);
  });

  it('teacher cancelling always refunds in full and closes the slot', async () => {
    const { teacher, learner, slot } = await setup();
    const booking = await bookSlot(learner.id, slot.id);

    await cancelBooking(teacher.id, booking.id, { now: new Date(slot.startsAt.getTime() - HOUR) });
    expect(await balanceOf(learner)).toBe(120);
    expect((await Slot.findById(slot.id)).status).toBe('CLOSED');
    await expectHealthy(expect);
  });

  it('cannot cancel once the session has started', async () => {
    const { learner, slot } = await setup();
    const booking = await bookSlot(learner.id, slot.id);
    await expect(cancelBooking(learner.id, booking.id, { now: during(slot) })).rejects.toMatchObject({ code: 'TOO_LATE' });
  });

  it('refunds only once when both people cancel at the same moment', async () => {
    const { teacher, learner, slot } = await setup();
    const booking = await bookSlot(learner.id, slot.id);

    const results = await Promise.allSettled([cancelBooking(learner.id, booking.id), cancelBooking(teacher.id, booking.id)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await balanceOf(learner)).toBe(120);
    await expectHealthy(expect);
  });
});
