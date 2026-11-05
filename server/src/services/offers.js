import { Offer, Slot } from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { idOf } from '../utils/transaction.js';

const MAX_DAYS_AHEAD = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

// Turns user input into a safe regex (so "c++" searches for "c++" literally).
export function searchRegex(text) {
  return new RegExp(text.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

async function loadOwnOffer(teacherId, offerId) {
  const offer = await Offer.findById(offerId);
  if (!offer) throw new AppError(404, 'NOT_FOUND', 'Offer not found');
  if (idOf(offer.teacher) !== String(teacherId)) throw new AppError(403, 'FORBIDDEN', 'This is not your offer');
  return offer;
}

export async function createOffer(teacherId, data) {
  return Offer.create({ ...data, teacher: teacherId });
}

export async function updateOffer(teacherId, offerId, changes) {
  const offer = await loadOwnOffer(teacherId, offerId);
  offer.set(changes);
  await offer.save();
  // Pausing an offer closes its open slots so nobody can book them.
  if (changes.active === false) {
    await Slot.updateMany({ offer: offer._id, status: 'OPEN' }, { $set: { status: 'CLOSED' } });
  }
  return offer;
}

// Public catalogue: active offers, newest first, with their next open times.
export async function listOffers({ q, skill, limit = 30 } = {}, { now = new Date() } = {}) {
  const filter = { active: true };
  if (q?.trim()) {
    const re = searchRegex(q);
    filter.$or = [{ title: re }, { description: re }, { skills: re }];
  }
  if (skill?.trim()) filter.skills = searchRegex(skill);

  const offers = await Offer.find(filter).sort({ createdAt: -1 }).limit(limit).populate('teacher', 'name');

  const slotStats = await Slot.aggregate([
    { $match: { offer: { $in: offers.map((o) => o._id) }, status: 'OPEN', startsAt: { $gt: now } } },
    { $group: { _id: '$offer', openSlots: { $sum: 1 }, nextSlotAt: { $min: '$startsAt' } } },
  ]);
  const statsByOffer = new Map(slotStats.map((s) => [String(s._id), s]));

  return offers.map((offer) => {
    const stats = statsByOffer.get(offer.id);
    return { ...offer.toJSON(), openSlots: stats?.openSlots ?? 0, nextSlotAt: stats?.nextSlotAt ?? null };
  });
}

export async function getOffer(offerId, { now = new Date() } = {}) {
  const offer = await Offer.findById(offerId).populate('teacher', 'name bio skills');
  if (!offer) throw new AppError(404, 'NOT_FOUND', 'Offer not found');
  const slots = await Slot.find({ offer: offer._id, status: 'OPEN', startsAt: { $gt: now } }).sort({ startsAt: 1 });
  return { ...offer.toJSON(), slots };
}

// The teacher's own view: every offer plus its upcoming slots in any state.
export async function listMyOffers(teacherId, { now = new Date() } = {}) {
  const offers = await Offer.find({ teacher: teacherId }).sort({ createdAt: -1 });
  const slots = await Slot.find({ teacher: teacherId, status: { $ne: 'CLOSED' }, startsAt: { $gt: now } }).sort({ startsAt: 1 });
  return offers.map((offer) => ({
    ...offer.toJSON(),
    slots: slots.filter((s) => idOf(s.offer) === offer.id),
  }));
}

export async function createSlot(teacherId, offerId, startsAt, { now = new Date() } = {}) {
  const offer = await loadOwnOffer(teacherId, offerId);
  if (!offer.active) throw new AppError(409, 'OFFER_INACTIVE', 'Activate this offer before adding times');

  const start = new Date(startsAt);
  if (start <= now) throw new AppError(400, 'INVALID_TIME', 'Pick a time in the future');
  if (start - now > MAX_DAYS_AHEAD * DAY_MS) {
    throw new AppError(400, 'INVALID_TIME', `Slots can be at most ${MAX_DAYS_AHEAD} days ahead`);
  }
  const end = new Date(start.getTime() + offer.durationMinutes * 60_000);

  // A teacher can't be in two places at once: reject overlapping slots.
  const overlap = await Slot.exists({
    teacher: teacherId,
    status: { $ne: 'CLOSED' },
    startsAt: { $lt: end },
    endsAt: { $gt: start },
  });
  if (overlap) throw new AppError(409, 'SLOT_OVERLAP', 'You already have a session at that time');

  return Slot.create({ offer: offer._id, teacher: teacherId, startsAt: start, endsAt: end });
}

export async function closeSlot(teacherId, slotId) {
  const slot = await Slot.findById(slotId);
  if (!slot) throw new AppError(404, 'NOT_FOUND', 'Slot not found');
  if (idOf(slot.teacher) !== String(teacherId)) throw new AppError(403, 'FORBIDDEN', 'This is not your slot');
  const closed = await Slot.findOneAndUpdate(
    { _id: slot._id, status: 'OPEN' },
    { $set: { status: 'CLOSED' } },
    { returnDocument: 'after' },
  );
  if (!closed) throw new AppError(409, 'SLOT_BOOKED', 'This slot is booked. Cancel the booking instead.');
  return closed;
}
