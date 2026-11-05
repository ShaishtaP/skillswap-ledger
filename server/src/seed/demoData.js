import { User } from '../models/index.js';
import { signup, updateProfile } from '../services/auth.js';
import { bookSlot, cancelBooking, confirmAttendance } from '../services/bookings.js';
import { openDispute, proposeResolution } from '../services/disputes.js';
import { createOffer, createSlot } from '../services/offers.js';

// Fictional demo community. Everything goes through the real services, so
// the demo ledger obeys exactly the same rules as real use.
export const DEMO_PASSWORD = 'password123';
export const DEMO_DOMAIN = 'skillswap.test';

const PEOPLE = [
  { key: 'aisha', name: 'Aisha Khan', bio: 'Grew up speaking Spanish at home. Learning to code.', skills: ['spanish'] },
  { key: 'rohan', name: 'Rohan Mehta', bio: 'Backend developer who loves the terminal.', skills: ['git', 'linux'] },
  { key: 'priya', name: 'Priya Nair', bio: 'Weekend watercolor painter.', skills: ['painting'] },
  { key: 'daniel', name: 'Daniel Brooks', bio: 'Played guitar in a college band for 4 years.', skills: ['guitar'] },
  { key: 'meera', name: 'Meera Iyer', bio: 'Software engineer, happy to help with interviews.', skills: ['python', 'dsa'] },
  { key: 'kabir', name: 'Kabir Singh', bio: 'Toastmasters club member.', skills: ['public speaking'] },
  { key: 'sara', name: 'Sara Thomas', bio: 'Analyst who lives in spreadsheets.', skills: ['excel'] },
  { key: 'arjun', name: 'Arjun Rao', bio: 'Club chess player, rated 1800.', skills: ['chess'] },
];

const OFFERS = [
  { key: 'spanish', teacher: 'aisha', title: 'Conversational Spanish for Beginners', durationMinutes: 60, skills: ['spanish', 'languages'], description: 'Greetings, ordering food and small talk. No grammar drills, just speaking practice.' },
  { key: 'git', teacher: 'rohan', title: 'Git & GitHub from Zero', durationMinutes: 45, skills: ['git', 'programming'], description: 'Commits, branches, pull requests and fixing the most common mistakes.' },
  { key: 'linux', teacher: 'rohan', title: 'Linux Command Line Basics', durationMinutes: 60, skills: ['linux', 'programming'], description: 'Navigate files, use pipes, and stop being scared of the terminal.' },
  { key: 'watercolor', teacher: 'priya', title: 'Watercolor Basics', durationMinutes: 90, skills: ['painting', 'art'], description: 'Washes, wet-on-wet and a simple landscape. Bring paper and three colours.' },
  { key: 'guitar', teacher: 'daniel', title: 'Guitar Chords in One Session', durationMinutes: 60, skills: ['guitar', 'music'], description: 'Learn G, C, D and Em and play your first full song.' },
  { key: 'python', teacher: 'meera', title: 'Intro to Python', durationMinutes: 60, skills: ['python', 'programming'], description: 'Variables, loops and functions by building a tiny quiz game.' },
  { key: 'dsa', teacher: 'meera', title: 'DSA Interview Warm-up', durationMinutes: 60, skills: ['dsa', 'interviews', 'programming'], description: 'Solve two classic problems together and talk through your thinking out loud.' },
  { key: 'speaking', teacher: 'kabir', title: 'Public Speaking Practice', durationMinutes: 30, skills: ['communication', 'confidence'], description: 'Give a 3-minute talk and get friendly, specific feedback.' },
  { key: 'excel', teacher: 'sara', title: 'Excel Formulas That Save Hours', durationMinutes: 45, skills: ['excel', 'productivity'], description: 'XLOOKUP, pivot tables and conditional formatting with real examples.' },
  { key: 'chess', teacher: 'arjun', title: 'Chess Openings for Improvers', durationMinutes: 60, skills: ['chess', 'games'], description: 'Two solid openings for white and black, and the ideas behind them.' },
];

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export async function seedDemo({ now = new Date(), log = () => {} } = {}) {
  // A local-time clock: at(-3, 18) = three days ago at 18:00.
  const at = (days, hour) => {
    const d = new Date(now.getTime() + days * DAY);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const founded = new Date(now.getTime() - 30 * DAY);

  const users = {};
  for (const person of PEOPLE) {
    const { user } = await signup({ name: person.name, email: `${person.key}@${DEMO_DOMAIN}`, password: DEMO_PASSWORD }, { now: founded });
    users[person.key] = await updateProfile(user.id, { bio: person.bio, skills: person.skills });
  }
  const { user: admin } = await signup({ name: 'Admin', email: `admin@${DEMO_DOMAIN}`, password: DEMO_PASSWORD }, { now: founded });
  await User.updateOne({ _id: admin._id }, { role: 'admin' });
  log(`Created ${PEOPLE.length} members and 1 admin`);

  const offers = {};
  for (const { key, teacher, ...data } of OFFERS) {
    offers[key] = await createOffer(users[teacher].id, data);
  }
  const teacherOf = (offerKey) => users[OFFERS.find((o) => o.key === offerKey).teacher];

  // Create a slot at `start` and have `learner` book it, pretending both
  // happened a couple of days before the session.
  async function book(offerKey, learnerKey, start) {
    const madeAt = new Date(Math.min(start.getTime() - 2 * DAY, now.getTime()));
    const slot = await createSlot(teacherOf(offerKey).id, offers[offerKey].id, start, { now: madeAt });
    return bookSlot(users[learnerKey].id, slot.id, { now: new Date(madeAt.getTime() + HOUR) });
  }
  const afterEnd = (booking) => new Date(booking.endsAt.getTime() + 15 * 60 * 1000);

  // 1. Completed sessions: both confirmed, teacher paid.
  const completed = [
    ['python', 'aisha', -12, 18],
    ['spanish', 'rohan', -11, 18],
    ['git', 'priya', -10, 19],
    ['guitar', 'meera', -9, 17],
    ['speaking', 'sara', -8, 20],
    ['excel', 'arjun', -7, 18],
    ['chess', 'daniel', -6, 19],
    ['dsa', 'kabir', -5, 18],
    ['watercolor', 'daniel', -4, 11],
  ];
  for (const [offerKey, learnerKey, days, hour] of completed) {
    const booking = await book(offerKey, learnerKey, at(days, hour));
    await confirmAttendance(users[learnerKey].id, booking.id, { now: afterEnd(booking) });
    await confirmAttendance(teacherOf(offerKey).id, booking.id, { now: afterEnd(booking) });
  }
  log(`Settled ${completed.length} completed sessions`);

  // 2. Cancellations: early (full refund), late (50/50), by the teacher.
  const early = await book('spanish', 'kabir', at(4, 16));
  await cancelBooking(users.kabir.id, early.id, { now: new Date(early.startsAt.getTime() - 3 * DAY) });
  const late = await book('linux', 'sara', at(-3, 17));
  await cancelBooking(users.sara.id, late.id, { now: new Date(late.startsAt.getTime() - 3 * HOUR) });
  const byTeacher = await book('python', 'arjun', at(-2, 19));
  await cancelBooking(users.meera.id, byTeacher.id, { now: new Date(byTeacher.startsAt.getTime() - DAY) });
  log('Added 3 cancellations');

  // 3. Waiting for confirmation: the session is over, but not everyone confirmed.
  const waiting = await book('guitar', 'aisha', at(-1, 18));
  await confirmAttendance(users.daniel.id, waiting.id, { now: afterEnd(waiting) });
  await book('excel', 'priya', at(-1, 11));

  // 4. Disputes: one with a proposal on the table, one waiting for an admin.
  const lateTeacher = await book('speaking', 'rohan', at(-2, 18));
  const d1 = await openDispute(users.rohan.id, lateTeacher.id, 'Kabir joined 20 minutes late, so we only had 10 minutes.', { now: afterEnd(lateTeacher) });
  await proposeResolution(users.kabir.id, d1.id, 15, { now: new Date(afterEnd(lateTeacher).getTime() + HOUR) });
  const noShow = await book('chess', 'meera', at(-3, 19));
  await openDispute(users.arjun.id, noShow.id, 'Meera never joined the call. I waited for 30 minutes.', { now: afterEnd(noShow) });
  log('Added 2 open disputes');

  // 5. Upcoming booked sessions.
  await book('speaking', 'aisha', at(1, 17));
  await book('git', 'priya', at(3, 11));
  await book('python', 'kabir', at(2, 18));

  // 6. Open times anyone can book over the next week.
  let open = 0;
  for (const [i, { key, teacher }] of OFFERS.entries()) {
    const hour = i % 2 === 0 ? 9 : 13; // two offers by the same teacher never overlap
    for (const days of [1 + (i % 2), 3 + (i % 3), 6]) {
      await createSlot(users[teacher].id, offers[key].id, at(days, hour), { now });
      open += 1;
    }
  }
  log(`Opened ${open} bookable slots`);
}
