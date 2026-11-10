import { config } from '../config/env.js';
import { authorizeCall, markConnected, markDisconnected } from './calls.js';

/**
 * Video-call "signaling" over Socket.IO.
 *
 * The video itself flows directly between the two browsers (WebRTC). The
 * server only introduces them: it checks who may join, then passes their
 * connection details ("offer", "answer", "ICE candidates") to the other
 * person in the same call room, and nobody else.
 */
export function registerCallHandlers(io, socket) {
  const user = socket.data.user;
  socket.data.calls = new Map(); // bookingId → { room, role, closesAt }

  // Only forward messages for calls this socket joined and that haven't ended.
  const activeCall = (bookingId) => {
    const call = socket.data.calls.get(String(bookingId));
    return call && new Date() <= call.closesAt ? call : null;
  };

  socket.on('call:join', async ({ bookingId } = {}, ack = () => {}) => {
    try {
      const { booking, role, closesAt } = await authorizeCall(user.id, bookingId);
      const room = `call:${booking.id}`;

      // One tab per person: if they joined from another tab, that tab steps out.
      const present = await io.in(room).fetchSockets();
      for (const other of present.filter((s) => s.data.user.id === user.id)) {
        other.emit('call:replaced', { bookingId: booking.id });
        other.leave(room);
      }

      await socket.join(room);
      socket.data.calls.set(booking.id, { room, role, closesAt });
      socket.to(room).emit('call:peer-joined', { bookingId: booking.id, role });

      ack({
        ok: true,
        role,
        // When both browsers try to start the call at once, the "polite" one
        // (the learner) backs off. See "perfect negotiation" in useCall.js.
        polite: role === 'learner',
        peerPresent: present.some((s) => s.data.user.id !== user.id),
        iceServers: config.iceServers,
        closesAt,
      });
    } catch (err) {
      ack({ ok: false, error: { code: err.code ?? 'INTERNAL', message: err.code ? err.message : 'Could not join the call' } });
    }
  });

  socket.on('call:signal', ({ bookingId, data } = {}) => {
    const call = activeCall(bookingId);
    if (call && data) socket.to(call.room).emit('call:signal', { bookingId: String(bookingId), data });
  });

  socket.on('call:connected', async ({ bookingId } = {}) => {
    const call = activeCall(bookingId);
    if (!call) return;
    try {
      await markConnected(String(bookingId), user.id, call.role);
    } catch (err) {
      console.error('Could not record call attendance', err);
    }
  });

  socket.on('call:disconnected', async ({ bookingId } = {}) => {
    if (!socket.data.calls.has(String(bookingId))) return;
    try {
      await markDisconnected(String(bookingId), user.id);
    } catch (err) {
      console.error('Could not record call attendance', err);
    }
  });

  async function leave(bookingId) {
    const call = socket.data.calls.get(String(bookingId));
    if (!call) return;
    socket.data.calls.delete(String(bookingId));
    socket.leave(call.room);
    io.to(call.room).emit('call:peer-left', { bookingId: String(bookingId) });
    try {
      await markDisconnected(String(bookingId), user.id);
    } catch (err) {
      console.error('Could not record call attendance', err);
    }
  }

  socket.on('call:leave', ({ bookingId } = {}) => leave(bookingId));
  // Closing the tab or losing the internet counts as leaving.
  socket.on('disconnect', () => {
    for (const bookingId of [...socket.data.calls.keys()]) leave(bookingId);
  });
}
