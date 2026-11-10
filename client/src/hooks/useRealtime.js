import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

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

// When the server says a booking or dispute changed, refetch the affected
// data so every open page updates by itself, and show a small notification.
export function useRealtime() {
  const socket = useSocket();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = (...keys) => keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));

    const onBooking = (event) => {
      refresh(['bookings'], ['booking', event.bookingId], ['call', event.bookingId], ['wallet'], ['offers'], ['offer'], ['my-offers'], ['admin']);
      const [title, tone] = BOOKING_MESSAGES[event.action] ?? ['Booking updated', 'info'];
      toast({ title, description: event.offerTitle, tone });
    };
    const onDispute = (event) => {
      refresh(['dispute', event.disputeId], ['booking', event.bookingId], ['bookings'], ['admin'], ['wallet']);
      const title = DISPUTE_MESSAGES[event.action];
      if (title && event.actorId !== user?.id) toast({ title });
    };

    socket.on('booking:updated', onBooking);
    socket.on('dispute:updated', onDispute);
    return () => {
      socket.off('booking:updated', onBooking);
      socket.off('dispute:updated', onDispute);
    };
  }, [socket, user?.id, queryClient, toast]);
}
