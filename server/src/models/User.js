import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Never stored in plain text. `select: false` keeps it out of every query
    // unless we explicitly ask for it (only the login check does).
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    bio: { type: String, default: '', maxlength: 500 },
    skills: { type: [String], default: [] },
  },
  { timestamps: true },
);

// Shape the JSON we send to the client: `id` instead of `_id`, no internals.
userSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
