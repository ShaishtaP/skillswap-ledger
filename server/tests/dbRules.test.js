import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { applyDbRules, checkDbRules } from '../src/dbRules.js';
import { Account } from '../src/models/index.js';
import { fullHealthReport } from '../src/services/invariants.js';
import { MINT, postTransaction, userAccount } from '../src/services/ledger.js';

// These tests use the raw MongoDB driver, skipping Mongoose and all of our
// app's checks, to prove the DATABASE refuses bad data on its own.
const db = () => mongoose.connection.db;
const accounts = () => db().collection('accounts');
const entries = () => db().collection('ledgerentries');

const VALIDATION_FAILED = { code: 121 }; // MongoDB "Document failed validation"

function entry(overrides = {}) {
  return { txKey: 'tx:1', type: 'SIGNUP_GRANT', account: 'user:a', amount: 60, createdAt: new Date(), ...overrides };
}

describe('database-level rules', () => {
  it('are installed on both collections', async () => {
    expect(await checkDbRules()).toEqual({ ok: true, collections: { accounts: true, ledgerentries: true } });
  });

  it('refuse a negative user or escrow balance, even written directly', async () => {
    await expect(accounts().insertOne({ _id: 'user:a', balance: -5 })).rejects.toMatchObject(VALIDATION_FAILED);
    await expect(accounts().insertOne({ _id: 'escrow:b', balance: -1 })).rejects.toMatchObject(VALIDATION_FAILED);
  });

  it('refuse an update that would push a balance below zero', async () => {
    await accounts().insertOne({ _id: 'user:a', balance: 10 });
    await expect(accounts().updateOne({ _id: 'user:a' }, { $inc: { balance: -11 } })).rejects.toMatchObject(VALIDATION_FAILED);
    expect((await accounts().findOne({ _id: 'user:a' })).balance).toBe(10);
  });

  it('allow the mint to go negative', async () => {
    await accounts().insertOne({ _id: MINT, balance: -120 });
    expect((await accounts().findOne({ _id: MINT })).balance).toBe(-120);
  });

  it('refuse balances that are not whole minutes, and unknown account names', async () => {
    await expect(accounts().insertOne({ _id: 'user:a', balance: 1.5 })).rejects.toMatchObject(VALIDATION_FAILED);
    await expect(accounts().insertOne({ _id: 'wallet:a', balance: 5 })).rejects.toMatchObject(VALIDATION_FAILED);
  });

  it('refuse malformed ledger entries', async () => {
    await expect(entries().insertOne(entry({ amount: 0 }))).rejects.toMatchObject(VALIDATION_FAILED);
    await expect(entries().insertOne(entry({ amount: 2.5 }))).rejects.toMatchObject(VALIDATION_FAILED);
    await expect(entries().insertOne(entry({ amount: '60' }))).rejects.toMatchObject(VALIDATION_FAILED);
    await expect(entries().insertOne(entry({ type: 'FREE_MONEY' }))).rejects.toMatchObject(VALIDATION_FAILED);
    await expect(entries().insertOne(entry({ account: 'nobody' }))).rejects.toMatchObject(VALIDATION_FAILED);
    const { txKey, ...noKey } = entry();
    await expect(entries().insertOne(noKey)).rejects.toMatchObject(VALIDATION_FAILED);
    expect(await entries().countDocuments()).toBe(0);
  });

  it('accept everything the app writes normally', async () => {
    const alice = userAccount('alice');
    await postTransaction({ key: 'grant:alice', type: 'SIGNUP_GRANT', legs: [{ account: MINT, amount: -120 }, { account: alice, amount: 120 }] });
    expect(await entries().countDocuments()).toBe(2);
    expect((await accounts().findOne({ _id: alice })).balance).toBe(120);
  });

  it('are added to existing collections that were created without them', async () => {
    await db().command({ collMod: 'accounts', validator: {} });
    expect((await checkDbRules()).collections.accounts).toBe(false);

    await applyDbRules();
    expect((await checkDbRules()).ok).toBe(true);
    await expect(accounts().insertOne({ _id: 'user:a', balance: -5 })).rejects.toMatchObject(VALIDATION_FAILED);
  });

  it('are installed even if Mongoose creates the collection at the same moment', async () => {
    // On a brand-new database Mongoose creates collections by itself while
    // connecting, racing with applyDbRules. The rules must still end up on.
    await accounts().drop();
    await Promise.all([Account.createCollection(), applyDbRules()]);
    expect((await checkDbRules()).ok).toBe(true);
  });

  it('show up in the admin health report', async () => {
    const report = await fullHealthReport();
    expect(report.ok).toBe(true);
    expect(report.dbRules.ok).toBe(true);
  });
});
