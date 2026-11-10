import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { seedDemo } from '../src/seed/demoData.js';
import { bookSlot, confirmAttendance } from '../src/services/bookings.js';
import { createOffer, createSlot, getOffer, listOffers } from '../src/services/offers.js';
import { DAY, HOUR, makeUser } from './helpers.js';

const app = createApp();

describe('offer popularity', () => {
  it('counts sessions taught, marks member picks and new offers', async () => {
    const now = new Date();
    const teacher = await makeUser('Teacher');
    const popular = await createOffer(teacher.id, { title: 'Popular Python', category: 'Programming', durationMinutes: 30 }, { now: new Date(now - 30 * DAY) });
    const quiet = await createOffer(teacher.id, { title: 'Quiet Chess', category: 'Games', durationMinutes: 30 });

    // Two different learners book the popular offer; one session is completed.
    const learners = [await makeUser('A'), await makeUser('B')];
    for (const [i, learner] of learners.entries()) {
      const slot = await createSlot(teacher.id, popular.id, new Date(now.getTime() + (2 + i) * DAY), { now });
      const booking = await bookSlot(learner.id, slot.id, { now });
      if (i === 0) {
        const after = new Date(slot.endsAt.getTime() + HOUR);
        await confirmAttendance(learner.id, booking.id, { now: after });
        await confirmAttendance(teacher.id, booking.id, { now: after });
      }
    }

    const byTitle = Object.fromEntries((await listOffers()).map((o) => [o.title, o]));
    expect(byTitle['Popular Python']).toMatchObject({ taughtCount: 1, memberPick: true, isNew: false, category: 'Programming' });
    expect(byTitle['Quiet Chess']).toMatchObject({ taughtCount: 0, memberPick: false, isNew: true });
    expect((await getOffer(quiet.id)).isNew).toBe(true);
  });

  it('filters by category', async () => {
    const teacher = await makeUser('Teacher');
    await createOffer(teacher.id, { title: 'Python Basics', category: 'Programming', durationMinutes: 30 });
    await createOffer(teacher.id, { title: 'Guitar Basics', category: 'Music', durationMinutes: 30 });

    const res = await request(app).get('/api/offers?category=Music').expect(200);
    expect(res.body.offers.map((o) => o.title)).toEqual(['Guitar Basics']);
    await request(app).get('/api/offers?category=Cooking').expect(400);
  });

  it('validates the outcome and category when publishing', async () => {
    const signup = await request(app).post('/api/auth/signup').send({ name: 'Tess', email: 'tess@example.com', password: 'password123' });
    const auth = { Authorization: `Bearer ${signup.body.token}` };
    const res = await request(app)
      .post('/api/offers')
      .set(auth)
      .send({ title: 'Knots', durationMinutes: 30, category: 'Sailing', outcome: 'x'.repeat(161) })
      .expect(400);
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(['category', 'outcome']);
  });
});

describe('community endpoints', () => {
  it('serve homepage stats and recent swaps from real data', async () => {
    await seedDemo();

    const stats = await request(app).get('/api/community/stats').expect(200);
    expect(stats.body).toMatchObject({ members: 8, offers: 10, crafts: 7, unaccountedMinutes: 0, ledgerBalanced: true });
    expect(stats.body.openSeats).toBeGreaterThan(20);

    const recent = await request(app).get('/api/community/recent').expect(200);
    expect(recent.body.swaps).toHaveLength(9);
    // First names only, newest first.
    expect(recent.body.swaps.every((s) => !s.teacher.includes(' ') && !s.learner.includes(' '))).toBe(true);
    const times = recent.body.swaps.map((s) => new Date(s.completedAt).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('seeds outcomes, categories, a member pick and a new offer', async () => {
    await seedDemo();
    const offers = await listOffers();
    expect(offers.every((o) => o.outcome && o.category !== 'Other')).toBe(true);
    expect(offers.filter((o) => o.memberPick).length).toBe(2);
    expect(offers.filter((o) => o.isNew).map((o) => o.title)).toEqual(['Excel Formulas That Save Hours']);
  });
});
