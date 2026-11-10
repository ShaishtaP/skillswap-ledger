import { io as connect } from 'socket.io-client';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { startServer } from '../src/httpServer.js';
import { Booking, CallAttendance, User } from '../src/models/index.js';
import { bookSlot, cancelBooking } from '../src/services/bookings.js';
import { attendanceSummary, authorizeCall, markConnected, markDisconnected } from '../src/services/calls.js';
import { closeRealtime } from '../src/services/realtime.js';
import { HOUR, MINUTE, makeSlot, makeUser } from './helpers.js';

const at = (booking, minutes) => new Date(booking.startsAt.getTime() + minutes * MINUTE);

async function bookedSession({ startsIn = 2 * HOUR } = {}) {
  const teacher = await makeUser('Teacher');
  const learner = await makeUser('Learner');
  const { slot } = await makeSlot(teacher, { startsIn });
  const booking = await bookSlot(learner.id, slot.id);
  return { teacher, learner, booking };
}

describe('who can join a call, and when', () => {
  it('opens 10 minutes before the start and closes 15 minutes after the end', async () => {
    const { learner, booking } = await bookedSession();

    await expect(authorizeCall(learner.id, booking.id, { now: at(booking, -11) })).rejects.toMatchObject({ code: 'CALL_NOT_OPEN' });
    await expect(authorizeCall(learner.id, booking.id, { now: at(booking, -10) })).resolves.toMatchObject({ role: 'learner' });
    await expect(authorizeCall(learner.id, booking.id, { now: at(booking, 60 + 15) })).resolves.toBeTruthy();
    await expect(authorizeCall(learner.id, booking.id, { now: at(booking, 60 + 16) })).rejects.toMatchObject({ code: 'CALL_CLOSED' });
  });

  it('is only for the teacher and the learner of that booking', async () => {
    const { teacher, booking } = await bookedSession();
    const stranger = await makeUser('Stranger');

    await expect(authorizeCall(teacher.id, booking.id, { now: at(booking, 0) })).resolves.toMatchObject({ role: 'teacher' });
    await expect(authorizeCall(stranger.id, booking.id, { now: at(booking, 0) })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(authorizeCall(stranger.id, 'not-an-id')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('closes when the booking is cancelled', async () => {
    const { learner, booking } = await bookedSession({ startsIn: 3 * 24 * HOUR });
    await cancelBooking(learner.id, booking.id);
    await expect(authorizeCall(learner.id, booking.id, { now: at(booking, 0) })).rejects.toMatchObject({ code: 'BOOKING_CLOSED' });
  });
});

describe('attendance', () => {
  it('counts each person’s time and the time both were connected, within the session only', async () => {
    const { teacher, learner, booking } = await bookedSession();
    const b = await Booking.findById(booking.id);

    // Learner arrives 5 min early (only session time counts), drops for 10 min, rejoins.
    await markConnected(b.id, learner.id, 'learner', { now: at(b, -5) });
    await markDisconnected(b.id, learner.id, { now: at(b, 20) });
    await markConnected(b.id, learner.id, 'learner', { now: at(b, 30) });
    await markDisconnected(b.id, learner.id, { now: at(b, 60) });
    // Teacher is 10 minutes late and stays to the end.
    await markConnected(b.id, teacher.id, 'teacher', { now: at(b, 10) });
    await markDisconnected(b.id, teacher.id, { now: at(b, 70) });

    const summary = await attendanceSummary(b, { now: at(b, 80) });
    expect(summary.learner).toMatchObject({ joined: true, minutes: 50, connectedNow: false });
    expect(summary.teacher).toMatchObject({ joined: true, minutes: 50 });
    expect(summary.togetherMinutes).toBe(40); // 10→20 and 30→60
    expect(summary.timeline).toHaveLength(3);
  });

  it('counts a connection that is still open up to now', async () => {
    const { learner, booking } = await bookedSession();
    const b = await Booking.findById(booking.id);
    await markConnected(b.id, learner.id, 'learner', { now: at(b, 0) });

    const summary = await attendanceSummary(b, { now: at(b, 25) });
    expect(summary.learner).toMatchObject({ minutes: 25, connectedNow: true });
    expect(summary.teacher).toMatchObject({ joined: false, minutes: 0 });
  });

  it('is shown to the two people and admins only', async () => {
    const app = createApp();
    const signup = async (name) => {
      const res = await request(app).post('/api/auth/signup').send({ name, email: `${name}@example.com`, password: 'password123' });
      return { id: res.body.user.id, auth: { Authorization: `Bearer ${res.body.token}` } };
    };
    const teacher = await signup('teach');
    const learner = await signup('learn');
    const stranger = await signup('stranger');
    const { slot } = await makeSlot({ id: teacher.id });
    const booking = await bookSlot(learner.id, slot.id);

    const res = await request(app).get(`/api/bookings/${booking.id}/call`).set(learner.auth).expect(200);
    expect(res.body).toMatchObject({ status: 'upcoming', canJoin: false, attendance: { togetherMinutes: 0 } });
    await request(app).get(`/api/bookings/${booking.id}/call`).set(stranger.auth).expect(403);

    await User.updateOne({ _id: stranger.id }, { role: 'admin' });
    const login = await request(app).post('/api/auth/login').send({ email: 'stranger@example.com', password: 'password123' });
    const asAdmin = await request(app).get(`/api/bookings/${booking.id}/call`).set('Authorization', `Bearer ${login.body.token}`).expect(200);
    expect(asAdmin.body.canJoin).toBe(false); // admins can look, not join
  });
});

describe('signaling over Socket.IO', () => {
  let server;
  const sockets = [];
  afterEach(async () => {
    sockets.forEach((s) => s.disconnect());
    sockets.length = 0;
    closeRealtime();
    await new Promise((resolve) => server?.close(resolve));
  });

  async function connectAs(user, port) {
    const socket = connect(`http://localhost:${port}`, { auth: { token: user.token }, transports: ['websocket'] });
    sockets.push(socket);
    await new Promise((resolve, reject) => {
      socket.on('connect', resolve);
      socket.on('connect_error', reject);
    });
    return socket;
  }
  const next = (socket, event) => new Promise((resolve) => socket.once(event, resolve));

  it('introduces the two people, relays messages only between them, and records attendance', async () => {
    server = await startServer(0);
    const { port } = server.address();
    // Starts in 5 minutes, so the call is already open.
    const { teacher, learner, booking } = await bookedSession({ startsIn: 5 * MINUTE });
    const stranger = await makeUser('Stranger');
    const [t, l, s] = await Promise.all([connectAs(teacher, port), connectAs(learner, port), connectAs(stranger, port)]);

    const first = await l.emitWithAck('call:join', { bookingId: booking.id });
    expect(first).toMatchObject({ ok: true, role: 'learner', polite: true, peerPresent: false });
    expect(first.iceServers[0].urls).toContain('stun:');

    const peerJoined = next(l, 'call:peer-joined');
    const second = await t.emitWithAck('call:join', { bookingId: booking.id });
    expect(second).toMatchObject({ ok: true, role: 'teacher', polite: false, peerPresent: true });
    expect(await peerJoined).toMatchObject({ role: 'teacher' });

    const denied = await s.emitWithAck('call:join', { bookingId: booking.id });
    expect(denied).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    // A stranger's message goes nowhere; the teacher's reaches only the learner.
    let strangerHeard = false;
    s.on('call:signal', () => (strangerHeard = true));
    s.emit('call:signal', { bookingId: booking.id, data: { description: { type: 'offer', sdp: 'fake' } } });
    const relayed = next(l, 'call:signal');
    t.emit('call:signal', { bookingId: booking.id, data: { candidate: 'abc' } });
    expect(await relayed).toEqual({ bookingId: booking.id, data: { candidate: 'abc' } });
    expect(strangerHeard).toBe(false);

    // Connection reported up, then the learner closes the tab.
    l.emit('call:connected', { bookingId: booking.id });
    await new Promise((r) => setTimeout(r, 150));
    const peerLeft = next(t, 'call:peer-left');
    l.disconnect();
    await peerLeft;
    await new Promise((r) => setTimeout(r, 150));

    const rows = await CallAttendance.find({ booking: booking.id });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ role: 'learner' });
    expect(rows[0].disconnectedAt).toBeInstanceOf(Date);
  });

  it('refuses to join before the call opens', async () => {
    server = await startServer(0);
    const { port } = server.address();
    const { learner, booking } = await bookedSession({ startsIn: 2 * HOUR });
    const l = await connectAs(learner, port);
    expect(await l.emitWithAck('call:join', { bookingId: booking.id })).toMatchObject({ ok: false, error: { code: 'CALL_NOT_OPEN' } });
  });
});
