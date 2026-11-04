import mongoose from 'mongoose';

// A running balance per account, kept in step with the ledger.
// The ledger is the source of truth; this is a fast-to-read copy that is
// updated in the same transaction as the ledger rows. Updating it also lets
// MongoDB detect two transactions spending the same credits at once.
const accountSchema = new mongoose.Schema(
  {
    _id: { type: String }, // the account key, same as LedgerEntry.account
    balance: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

export const Account = mongoose.model('Account', accountSchema);
