import { Account, LedgerEntry } from '../models/index.js';
import { AppError, isDuplicateKeyError } from '../utils/errors.js';
import { runInTransaction } from '../utils/transaction.js';

// Account keys. Every credit lives in exactly one of these.
export const MINT = 'mint'; // where new credits come from; the only account allowed below zero
export const userAccount = (userId) => `user:${userId}`;
export const escrowAccount = (bookingId) => `escrow:${bookingId}`;

function validateLegs(legs) {
  if (!Array.isArray(legs) || legs.length < 2) {
    throw new AppError(400, 'INVALID_TRANSACTION', 'A transaction needs at least two legs');
  }
  const accounts = new Set();
  let sum = 0;
  for (const { account, amount } of legs) {
    if (!account || !Number.isInteger(amount) || amount === 0) {
      throw new AppError(400, 'INVALID_TRANSACTION', 'Each leg needs an account and a non-zero whole-minute amount');
    }
    if (accounts.has(account)) {
      throw new AppError(400, 'INVALID_TRANSACTION', `Account ${account} appears twice in one transaction`);
    }
    accounts.add(account);
    sum += amount;
  }
  // Double-entry rule: credits are moved, never created or destroyed.
  if (sum !== 0) {
    throw new AppError(400, 'INVALID_TRANSACTION', `Legs must sum to zero (got ${sum})`);
  }
}

async function applyTransaction({ key, type, legs, bookingId, memo, at = new Date() }, session) {
  // Already written? Then this is a retry: do nothing and say so.
  if (await LedgerEntry.exists({ txKey: key }).session(session)) {
    return { applied: false, txKey: key };
  }

  await LedgerEntry.insertMany(
    legs.map(({ account, amount }) => ({ txKey: key, type, account, amount, bookingId, memo, createdAt: at })),
    { session },
  );

  for (const { account, amount } of legs) {
    if (amount < 0 && account !== MINT) {
      // Only take credits if enough are there. The check and the subtraction
      // happen in one atomic step, so two requests can't both pass the check.
      const updated = await Account.findOneAndUpdate(
        { _id: account, balance: { $gte: -amount } },
        { $inc: { balance: amount } },
        { session, returnDocument: 'after' },
      );
      if (!updated) {
        throw new AppError(409, 'INSUFFICIENT_CREDITS', 'Not enough credits', { account });
      }
    } else {
      await Account.updateOne({ _id: account }, { $inc: { balance: amount } }, { session, upsert: true });
    }
  }
  return { applied: true, txKey: key };
}

/**
 * Move credits between accounts, all-or-nothing and at most once per key.
 *
 *   postTransaction({
 *     key: 'signup:123',
 *     type: 'SIGNUP_GRANT',
 *     legs: [{ account: MINT, amount: -120 }, { account: 'user:123', amount: 120 }],
 *   })
 *
 * `at` is when the movement happened (defaults to now).
 * Returns { applied: true } the first time and { applied: false } for any
 * repeat of the same key. Pass `session` to join a transaction the caller
 * already started (e.g. "create the booking AND hold the credits").
 */
export async function postTransaction(tx, { session } = {}) {
  if (!tx.key) throw new AppError(400, 'INVALID_TRANSACTION', 'A transaction needs an idempotency key');
  validateLegs(tx.legs);

  if (session) return applyTransaction(tx, session);

  try {
    return await runInTransaction((ownSession) => applyTransaction(tx, ownSession));
  } catch (err) {
    // A concurrent request with the same key won the race.
    if (isDuplicateKeyError(err)) return { applied: false, txKey: tx.key };
    throw err;
  }
}

export async function getBalance(account) {
  const doc = await Account.findById(account).lean();
  return doc?.balance ?? 0;
}

export async function getStatement(account, { limit = 50 } = {}) {
  return LedgerEntry.find({ account }).sort({ createdAt: -1, _id: -1 }).limit(limit);
}

/**
 * Health check for the whole ledger. Returns { ok, problems[] }.
 *  1. All entries together sum to zero (nothing created from thin air).
 *  2. Each account's stored balance equals the sum of its entries.
 *  3. No account except the mint is below zero.
 */
export async function checkInvariants() {
  const problems = [];

  const sums = await LedgerEntry.aggregate([{ $group: { _id: '$account', sum: { $sum: '$amount' } } }]);
  const accounts = await Account.find().lean();

  const total = sums.reduce((acc, s) => acc + s.sum, 0);
  if (total !== 0) problems.push(`Ledger total is ${total}, expected 0`);

  const fromEntries = new Map(sums.map((s) => [s._id, s.sum]));
  const fromAccounts = new Map(accounts.map((a) => [a._id, a.balance]));
  const allKeys = new Set([...fromEntries.keys(), ...fromAccounts.keys()]);

  for (const key of allKeys) {
    const expected = fromEntries.get(key) ?? 0;
    const stored = fromAccounts.get(key) ?? 0;
    if (expected !== stored) problems.push(`${key}: stored balance ${stored} but entries sum to ${expected}`);
    if (key !== MINT && expected < 0) problems.push(`${key} is negative (${expected})`);
  }

  return { ok: problems.length === 0, total, accountsChecked: allKeys.size, problems };
}
