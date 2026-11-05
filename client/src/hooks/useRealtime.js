import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useToast } from '../context/ToastContext.jsx';
import { tokenStore } from '../lib/api.js';

const BOOKING_MESSAGES = {
  booked: ['Session booked', 'success'],
  confirmed: ['Attendance confirmed', 'info'],
  completed: ['Session completed, credits settled', 'success'],
  cancelled: ['Session cancelled', 'info'],
  disputed: ['A dispute was opened', 'error'],
  resolved: ['Dispute resolved', 'success'],
};
const DISPUTE_MESSAGES = {
  opened: 'New dispute opened',
  proposed: 'New proposal in a dispute',
  note: 'New message in a dispute',
};

// Keeps a live connection to the server while logged in. When the server
// says a booking or dispute changed, we refetch the affected data so every
// open page updates by itself, and show a small notification.
export function useRealtime(user) {
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (!user) return undefined;
    const socket = io({ auth: { token: tokenStore.get() } });
    const refresh = (...keys) => keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));

    socket.on('booking:updated', (event) => {
      refresh(['bookings'], ['booking', event.bookingId], ['wallet'], ['offers'], ['offer'], ['my-offers'], ['admin']);
      const [title, tone] = BOOKING_MESSAGES[event.action] ?? ['Booking updated', 'info'];
      toast({ title, description: event.offerTitle, tone });
    });

    socket.on('dispute:updated', (event) => {
      refresh(['dispute', event.disputeId], ['booking', event.bookingId], ['bookings'], ['admin'], ['wallet']);
      const title = DISPUTE_MESSAGES[event.action];
      if (title && event.actorId !== user.id) toast({ title });
    });

    return () => socket.disconnect();
    // Reconnect only when a different user logs in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}
