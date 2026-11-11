import mongoose from 'mongoose';
import { LEDGER_TYPES } from './models/LedgerEntry.js';

/**
 * Rules the DATABASE itself enforces, on top of the checks in our code.
 *
 * Mongoose schemas only protect writes that go through this app. These
 * MongoDB "schema validators" ($jsonSchema) protect every write, even one
 * made directly in the database (Atlas UI, a script, a bug elsewhere).
 * A write that breaks a rule fails with error code 121.
 *
 * Note: validators check what a document LOOKS like. They can't forbid
 * changing or deleting a valid ledger entry; that is handled by the app
 * (append-only hooks) and caught by the invariant checks.
 */
const WHOLE_NUMBER = ['int', 'long'];

export const DB_RULES = {
  // Account balances: whole minutes, never negative (except the mint, whose
  // balance is minus everything ever issued).
  accounts: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'balance'],
      properties: {
        _id: { bsonType: 'string', pattern: '^(mint|user:.+|escrow:.+)$' },
        balance: { bsonType: WHOLE_NUMBER },
      },
      anyOf: [{ properties: { _id: { enum: ['mint'] } } }, { properties: { balance: { minimum: 0 } } }],
    },
  },
  // Ledger entries: a known type, a valid account, a whole non-zero amount.
  ledgerentries: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['txKey', 'type', 'account', 'amount', 'createdAt'],
      properties: {
        txKey: { bsonType: 'string', minLength: 1 },
        type: { enum: LEDGER_TYPES },
        account: { bsonType: 'string', pattern: '^(mint|user:.+|escrow:.+)$' },
        amount: { bsonType: WHOLE_NUMBER, not: { enum: [0] } },
        createdAt: { bsonType: 'date' },
      },
    },
  },
};

const OPTIONS = { validationLevel: 'strict', validationAction: 'error' };

/**
 * Install the rules. New collections are created with them; existing ones
 * are updated with collMod. collMod needs a database user with admin rights
 * on the database (e.g. Atlas "Atlas admin"); without them we log a warning
 * and the app keeps running with its own checks.
 */
export async function applyDbRules(db = mongoose.connection.db) {
  for (const [name, validator] of Object.entries(DB_RULES)) {
    try {
      try {
        await db.createCollection(name, { validator, ...OPTIONS });
      } catch (err) {
        // 48 = the collection already exists (from an earlier run, or Mongoose
        // created it a moment ago while connecting): add the rules to it.
        if (err.code !== 48) throw err;
        await db.command({ collMod: name, validator, ...OPTIONS });
      }
    } catch (err) {
      console.warn(`Could not install database rules on "${name}": ${err.message}`);
    }
  }
}

/** Which collections currently have the rules installed (for the admin check). */
export async function checkDbRules(db = mongoose.connection.db) {
  // List everything and filter here: Atlas's free tier rejects operators like
  // $in in a listCollections filter ("can't get regex from filter doc").
  const infos = await db.listCollections().toArray();
  const active = Object.fromEntries(Object.keys(DB_RULES).map((name) => [name, false]));
  for (const info of infos) {
    if (info.name in active) active[info.name] = Boolean(info.options?.validator?.$jsonSchema);
  }
  return { ok: Object.values(active).every(Boolean), collections: active };
}
