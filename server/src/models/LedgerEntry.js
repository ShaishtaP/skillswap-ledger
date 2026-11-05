import mongoose from 'mongoose';
import { cleanJSON } from './plugins.js';

export const LEDGER_TYPES = [
  'SIGNUP_GRANT', // new user receives starting credits
  'BOOKING_HOLD', // learner's credits move into escrow when they book
  'SETTLEMENT', // escrow pays the teacher after both confirm
  'REFUND', // escrow returns credits to the learner on cancellation
  'CANCELLATION_FEE', // late-cancel share paid to the teacher
  'DISPUTE_RESOLUTION', // escrow split decided by agreement or admin
];

// One row = one side of one credit movement. Rows are only ever inserted,
// never changed or deleted, so the full history can always be replayed.
const ledgerEntrySchema = new mongoose.Schema(
  {
    // Groups the rows of one transaction and makes it idempotent: the same
    // key can only ever be written once (see the unique index below).
    txKey: { type: String, required: true },
    type: { type: String, enum: LEDGER_TYPES, required: true },
    // Who the credits belong to, e.g. "user:<id>", "escrow:<bookingId>" or "mint".
    account: { type: String, required: true },
    // Whole minutes. Positive = credits in, negative = credits out.
    amount: {
      type: Number,
      required: true,
      validate: { validator: (v) => Number.isInteger(v) && v !== 0, message: 'amount must be a non-zero integer' },
    },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    memo: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

ledgerEntrySchema.index({ txKey: 1, account: 1 }, { unique: true });
ledgerEntrySchema.index({ account: 1, createdAt: -1 });

// Append-only: refuse any update or delete that goes through Mongoose.
const blocked = ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete', 'findOneAndReplace'];
ledgerEntrySchema.pre(blocked, function () {
  throw new Error('Ledger entries are append-only and cannot be changed or deleted');
});

cleanJSON(ledgerEntrySchema);

export const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);
