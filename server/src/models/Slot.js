import mongoose from 'mongoose';
import { cleanJSON } from './plugins.js';

export const SLOT_STATUSES = ['OPEN', 'BOOKED', 'CLOSED'];

// One bookable time for an offer. Its status changes OPEN → BOOKED in a
// single conditional update, which is what stops two people booking it.
const slotSchema = new mongoose.Schema(
  {
    offer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: { type: String, enum: SLOT_STATUSES, default: 'OPEN' },
  },
  { timestamps: true },
);

slotSchema.index({ offer: 1, status: 1, startsAt: 1 });
slotSchema.index({ teacher: 1, startsAt: 1 });
cleanJSON(slotSchema);

export const Slot = mongoose.model('Slot', slotSchema);
