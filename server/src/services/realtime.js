import { Server } from 'socket.io';
import { idOf } from '../utils/transaction.js';
import { verifyToken } from './auth.js';
import { registerCallHandlers } from './callSignaling.js';

// Socket.IO keeps a live connection open to each logged-in browser. Every
// user joins a private "room" named after their id, so the server can push
// an update to exactly the people a booking concerns.
let io = null;

export function initRealtime(httpServer, { corsOrigin } = {}) {
  io = new Server(httpServer, { cors: corsOrigin ? { origin: corsOrigin } : undefined });

  // Only logged-in users may connect: the browser sends its JWT on connect.
  io.use((socket, next) => {
    try {
      const payload = verifyToken(socket.handshake.auth?.token);
      socket.data.user = { id: payload.sub, role: payload.role };
      next();
    } catch {
      next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.data.user;
    socket.join(`user:${id}`);
    if (role === 'admin') socket.join('admins');
    registerCallHandlers(io, socket);
  });

  return io;
}

export function closeRealtime() {
  io?.close();
  io = null;
}

// Events are sent only after the database transaction has committed, so a
// browser never hears about a change that was then rolled back.
function emit(rooms, event, payload) {
  if (!io || rooms.length === 0) return;
  io.to(rooms).emit(event, payload);
}

export function notifyBooking(booking, action) {
  emit([`user:${idOf(booking.teacher)}`, `user:${idOf(booking.learner)}`], 'booking:updated', {
    bookingId: booking.id,
    status: booking.status,
    offerTitle: booking.offerTitle,
    action,
  });
}

export function notifyDispute(dispute, action, { includeAdmins = false, actorId } = {}) {
  const rooms = [`user:${idOf(dispute.teacher)}`, `user:${idOf(dispute.learner)}`];
  if (includeAdmins) rooms.push('admins');
  emit(rooms, 'dispute:updated', {
    disputeId: dispute.id,
    bookingId: idOf(dispute.booking),
    status: dispute.status,
    action,
    actorId: actorId && String(actorId),
  });
}
