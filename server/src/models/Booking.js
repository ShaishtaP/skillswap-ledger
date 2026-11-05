import mongoose from 'mongoose';
import { cleanJSON } from './plugins.js';

export const BOOKING_STATUSES = ['BOOKED', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'RESOLVED'];
// Statuses where the learner's credits are still held in escrow.
export const OPEN_BOOKING_STATUSES = ['BOOKED', 'DISPUTED'];

const { ObjectId } = mongoose.Schema.Types;

const bookingSchema = new mongoose.Schema(
  {
    offer: { type: ObjectId, ref: 'Offer', required: true },
    slot: { type: ObjectId, ref: 'Slot', required: true },
    teacher: { type: ObjectId, ref: 'User', required: true },
    learner: { type: ObjectId, ref: 'User', required: true },
    // Copied from the offer at booking time, so history stays accurate (and
    // searchable) even if the teacher later edits the offer.
    offerTitle: { type: String, required: true },
    skills: { type: [String], default: [] },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    credits: { type: Number, required: true },
    status: { type: String, enum: BOOKING_STATUSES, default: 'BOOKED' },

    teacherConfirmedAt: { type: Date, default: null },
    learnerConfirmedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    cancelledBy: { type: String, enum: ['teacher', 'learner', null], default: null },
    cancelledAt: { type: Date, default: null },
    refundMinutes: { type: Number, default: null },
    feeMinutes: { type: Number, default: null },

    dispute: { type: ObjectId, ref: 'Dispute', default: null },
  },
  { timestamps: true },
);

bookingSchema.index({ learner: 1, startsAt: -1 });
bookingSchema.index({ teacher: 1, startsAt: -1 });
bookingSchema.index({ status: 1 });
cleanJSON(bookingSchema);

export const Booking = mongoose.model('Booking', bookingSchema);
