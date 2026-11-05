import mongoose from 'mongoose';
import { cleanJSON } from './plugins.js';

// Something a user can teach. Learners book one of its time slots.
const offerSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 2000 },
    skills: { type: [String], default: [] },
    // Also the price: a 60-minute session costs 60 credits.
    durationMinutes: { type: Number, required: true, min: 15, max: 240 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

offerSchema.index({ active: 1, createdAt: -1 });
cleanJSON(offerSchema);

export const Offer = mongoose.model('Offer', offerSchema);
