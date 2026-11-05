import { io as connect } from 'socket.io-client';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { startServer } from '../src/httpServer.js';
import { User } from '../src/models/index.js';
import { closeRealtime } from '../src/services/realtime.js';

const app = createApp();
const inTwoDays = () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

async function signup(name) {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ name, email: `${name.toLowerCase()}@example.com`, password: 'password123' })
    .expect(201);
  return { ...res.body.user, token: res.body.token, auth: { Authorization: `Bearer ${res.body.token}` } };
}

async function publishOffer(teacher) {
  const offer = await request(app)
    .post('/api/offers')
    .set(teacher.auth)
    .send({ title: 'Intro to Guitar', description: 'Chords and strumming', skills: ['Guitar', 'music'], durationMinutes: 60 })
    .expect(201);
  const slot = await request(app).post(`/api/offers/${offer.body.offer.id}/slots`).set(teacher.auth).send({ startsAt: inTwoDays() }).expect(201);
  return { offer: offer.body.offer, slot: slot.body.slot };
}

describe('marketplace over HTTP', () => {
  it('publish → search → book → history → cancel', async () => {
    const teacher = await signup('Teacher');
    const learner = await signup('Learner');
    const { offer, slot } = await publishOffer(teacher);
    expect(offer.skills).toEqual(['guitar', 'music']); // cleaned up by validation

    const search = await request(app).get('/api/offers?q=guitar').expect(200);
    expect(search.body.offers).toHaveLength(1);
    expect(search.body.offers[0]).toMatchObject({ title: 'Intro to Guitar', openSlots: 1, teacher: { name: 'Teacher' } });
    expect((await request(app).get('/api/offers?q=piano')).body.offers).toHaveLength(0);

    const booked = await request(app).post(`/api/slots/${slot.id}/book`).set(learner.auth).expect(201);
    const bookingId = booked.body.booking.id;
    await request(app).post(`/api/slots/${slot.id}/book`).set(learner.auth).expect(409);

    const history = await request(app).get('/api/bookings?status=BOOKED&q=guit').set(learner.auth).expect(200);
    expect(history.body.bookings).toHaveLength(1);
    expect(history.body.bookings[0]).toMatchObject({ offerTitle: 'Intro to Guitar', teacher: { name: 'Teacher' } });

    expect((await request(app).get('/api/wallet').set(learner.auth)).body.balance).toBe(60);

    await request(app).post(`/api/bookings/${bookingId}/cancel`).set(teacher.auth).expect(200);
    expect((await request(app).get('/api/wallet').set(learner.auth)).body.balance).toBe(120);
    const detail = await request(app).get(`/api/bookings/${bookingId}`).set(learner.auth).expect(200);
    expect(detail.body.booking).toMatchObject({ status: 'CANCELLED', myRole: 'learner' });
  });

  it('validates offers and slot times', async () => {
    const teacher = await signup('Teacher');
    const bad = await request(app).post('/api/offers').set(teacher.auth).send({ title: 'Hi', durationMinutes: 50 }).expect(400);
    expect(bad.body.error.details.map((d) => d.field).sort()).toEqual(['durationMinutes', 'title']);

    const { offer } = await publishOffer(teacher);
    const past = new Date(Date.now() - 60_000).toISOString();
    await request(app).post(`/api/offers/${offer.id}/slots`).set(teacher.auth).send({ startsAt: past }).expect(400);
  });

  it('stops users from changing other people’s offers', async () => {
    const teacher = await signup('Teacher');
    const other = await signup('Other');
    const { offer } = await publishOffer(teacher);
    await request(app).patch(`/api/offers/${offer.id}`).set(other.auth).send({ title: 'Hijacked' }).expect(403);
  });

  it('keeps admin routes for admins only', async () => {
    const user = await signup('Regular');
    await request(app).get('/api/admin/health').set(user.auth).expect(403);

    await User.updateOne({ _id: user.id }, { role: 'admin' });
    const login = await request(app).post('/api/auth/login').send({ email: 'regular@example.com', password: 'password123' });
    const health = await request(app).get('/api/admin/health').set('Authorization', `Bearer ${login.body.token}`).expect(200);
    expect(health.body.ok).toBe(true);
  });

  it('returns 400 for a malformed id', async () => {
    const user = await signup('Regular');
    await request(app).get('/api/bookings/not-an-id').set(user.auth).expect(400);
  });
});

describe('live updates', () => {
  let server;
  const sockets = [];

  afterEach(async () => {
    sockets.forEach((s) => s.disconnect());
    closeRealtime();
    await new Promise((resolve) => server?.close(resolve));
  });

  function listen(user, port) {
    const socket = connect(`http://localhost:${port}`, { auth: { token: user.token }, transports: ['websocket'] });
    sockets.push(socket);
    return new Promise((resolve, reject) => {
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);
    });
  }

  it('tells both people when a session is booked', async () => {
    server = await startServer(0);
    const { port } = server.address();
    const teacher = await signup('Teacher');
    const learner = await signup('Learner');
    const { slot } = await publishOffer(teacher);

    const [teacherSocket, learnerSocket] = await Promise.all([listen(teacher, port), listen(learner, port)]);
    const heard = Promise.all(
      [teacherSocket, learnerSocket].map((s) => new Promise((resolve) => s.once('booking:updated', resolve))),
    );

    await request(app).post(`/api/slots/${slot.id}/book`).set(learner.auth).expect(201);
    const [toTeacher, toLearner] = await heard;
    expect(toTeacher).toMatchObject({ action: 'booked', status: 'BOOKED', offerTitle: 'Intro to Guitar' });
    expect(toLearner.bookingId).toBe(toTeacher.bookingId);
  });

  it('rejects connections without a valid token', async () => {
    server = await startServer(0);
    const { port } = server.address();
    await expect(listen({ token: 'forged' }, port)).rejects.toThrow('UNAUTHENTICATED');
  });
});
