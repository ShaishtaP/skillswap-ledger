import mongoose from 'mongoose';
import { cleanJSON } from './plugins.js';

const { ObjectId } = mongoose.Schema.Types;

// An offer to settle the dispute: "learner gets X minutes back, teacher keeps the rest".
const proposalSchema = new mongoose.Schema(
  {
    by: { type: ObjectId, ref: 'User', required: true },
    learnerRefund: { type: Number, required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const resolutionSchema = new mongoose.Schema(
  {
    method: { type: String, enum: ['AGREEMENT', 'ADMIN'], required: true },
    learnerRefund: { type: Number, required: true },
    teacherPayout: { type: Number, required: true },
    resolvedBy: { type: ObjectId, ref: 'User', required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const noteSchema = new mongoose.Schema(
  {
    author: { type: ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, maxlength: 2000 },
    // SYSTEM notes are written by the app ("Teacher proposed a 50/50 split").
    kind: { type: String, enum: ['NOTE', 'SYSTEM'], default: 'NOTE' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
cleanJSON(noteSchema);

const disputeSchema = new mongoose.Schema(
  {
    booking: { type: ObjectId, ref: 'Booking', required: true, unique: true },
    teacher: { type: ObjectId, ref: 'User', required: true },
    learner: { type: ObjectId, ref: 'User', required: true },
    openedBy: { type: ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: ['OPEN', 'RESOLVED'], default: 'OPEN' },
    proposal: { type: proposalSchema, default: null },
    resolution: { type: resolutionSchema, default: null },
    notes: { type: [noteSchema], default: [] },
  },
  { timestamps: true },
);

disputeSchema.index({ status: 1, createdAt: -1 });
cleanJSON(disputeSchema);

export const Dispute = mongoose.model('Dispute', disputeSchema);
