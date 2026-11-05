import { signup } from '../src/services/auth.js';
import { fullHealthReport } from '../src/services/invariants.js';
import { getBalance, userAccount } from '../src/services/ledger.js';
import { createOffer, createSlot } from '../src/services/offers.js';

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

let counter = 0;

export async function makeUser(name = 'User') {
  counter += 1;
  const { user, token } = await signup({ name, email: `${name.toLowerCase()}${counter}@example.com`, password: 'password123' });
  return { id: user.id, name, token };
}

// An offer with one open slot, `startsIn` from `now`.
export async function makeSlot(teacher, { startsIn = 2 * DAY, duration = 60, now = new Date(), title = 'Intro to Guitar' } = {}) {
  const offer = await createOffer(teacher.id, { title, skills: ['guitar', 'music'], durationMinutes: duration });
  const slot = await createSlot(teacher.id, offer.id, new Date(now.getTime() + startsIn), { now });
  return { offer, slot };
}

export const balanceOf = (user) => getBalance(userAccount(user.id));

export async function expectHealthy(expect) {
  const report = await fullHealthReport();
  expect(report.ledger.problems).toEqual([]);
  expect(report.escrow.problems).toEqual([]);
}

// A moment shortly after the slot starts, for confirming or disputing.
export const during = (slot) => new Date(slot.startsAt.getTime() + 30 * MINUTE);
