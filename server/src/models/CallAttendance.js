import mongoose from 'mongoose';
import { cleanJSON } from './plugins.js';

// One row per stretch of time someone was connected to a session's video
// call. Rejoining after a dropped connection starts a new row. Only times
// are stored, never audio or video.
const callAttendanceSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['teacher', 'learner'], required: true },
    connectedAt: { type: Date, required: true },
    disconnectedAt: { type: Date, default: null },
  },
  { versionKey: false },
);

callAttendanceSchema.index({ booking: 1, connectedAt: 1 });
cleanJSON(callAttendanceSchema);

export const CallAttendance = mongoose.model('CallAttendance', callAttendanceSchema);
