import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { LedgerEntry } from '../src/models/index.js';
import { MINT, checkInvariants, escrowAccount, getBalance, postTransaction, userAccount } from '../src/services/ledger.js';

const alice = userAccount('alice');
const escrow = escrowAccount('booking1');

// Give an account credits from the mint, like a signup grant does.
function grant(account, minutes, key = `grant:${account}`) {
  return postTransaction({
    key,
    type: 'SIGNUP_GRANT',
    legs: [
      { account: MINT, amount: -minutes },
      { account, amount: minutes },
    ],
  });
}

// Move credits from an account into escrow, like booking a session does.
function hold(from, minutes, key) {
  return postTransaction({
    key,
    type: 'BOOKING_HOLD',
    legs: [
      { account: from, amount: -minutes },
      { account: escrow, amount: minutes },
    ],
  });
}

describe('postTransaction: input rules', () => {
  it('rejects legs that do not sum to zero', async () => {
    await expect(
      postTransaction({
        key: 'bad',
        type: 'SIGNUP_GRANT',
        legs: [
          { account: MINT, amount: -100 },
          { account: alice, amount: 120 },
        ],
      }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSACTION' });
  });

  it('rejects fractional amounts', async () => {
    await expect(
      postTransaction({
        key: 'bad',
        type: 'SIGNUP_GRANT',
        legs: [
          { account: MINT, amount: -0.5 },
          { account: alice, amount: 0.5 },
        ],
      }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSACTION' });
  });

  it('rejects a transaction without a key', async () => {
    await expect(
      postTransaction({ type: 'SIGNUP_GRANT', legs: [{ account: MINT, amount: -1 }, { account: alice, amount: 1 }] }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSACTION' });
  });
});

describe('postTransaction: moving credits', () => {
  it('writes both legs and updates balances', async () => {
    const result = await grant(alice, 120);

    expect(result.applied).toBe(true);
    expect(await getBalance(alice)).toBe(120);
    expect(await getBalance(MINT)).toBe(-120);
    expect(await LedgerEntry.countDocuments()).toBe(2);
    expect((await checkInvariants()).ok).toBe(true);
  });

  it('applies the same key only once when retried', async () => {
    await grant(alice, 120, 'same-key');
    const second = await grant(alice, 120, 'same-key');

    expect(second.applied).toBe(false);
    expect(await getBalance(alice)).toBe(120);
  });

  it('applies the same key only once when sent 10 times at the same moment', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => grant(alice, 120, 'race-key')));

    expect(results.filter((r) => r.applied)).toHaveLength(1);
    expect(await getBalance(alice)).toBe(120);
    expect(await LedgerEntry.countDocuments()).toBe(2);
    expect((await checkInvariants()).ok).toBe(true);
  });

  it('refuses to overdraw and writes nothing', async () => {
    await grant(alice, 60);

    await expect(hold(alice, 90, 'too-much')).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
    expect(await getBalance(alice)).toBe(60);
    expect(await LedgerEntry.countDocuments({ txKey: 'too-much' })).toBe(0);
  });

  it('never lets parallel spends overdraw an account', async () => {
    await grant(alice, 120);

    // Five different bookings of 50 minutes each, all at once. Only two fit.
    const results = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => hold(alice, 50, `hold-${i}`)));

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter((r) => r.status === 'rejected').every((r) => r.reason.code === 'INSUFFICIENT_CREDITS')).toBe(true);
    expect(await getBalance(alice)).toBe(20);
    expect(await getBalance(escrow)).toBe(100);
    expect((await checkInvariants()).ok).toBe(true);
  });
});

describe('ledger is append-only', () => {
  it('blocks updates and deletes through the model', async () => {
    await grant(alice, 120);

    await expect(LedgerEntry.updateOne({ account: alice }, { amount: 9999 })).rejects.toThrow(/append-only/);
    await expect(LedgerEntry.deleteMany({})).rejects.toThrow(/append-only/);
    expect(await LedgerEntry.countDocuments()).toBe(2);
  });
});

describe('checkInvariants', () => {
  it('detects a balance that was tampered with directly in the database', async () => {
    await grant(alice, 120);
    await mongoose.connection.db.collection('accounts').updateOne({ _id: alice }, { $set: { balance: 5000 } });

    const report = await checkInvariants();
    expect(report.ok).toBe(false);
    expect(report.problems[0]).toMatch(/user:alice: stored balance 5000 but entries sum to 120/);
  });
});
