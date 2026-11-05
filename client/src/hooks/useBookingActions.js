import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';

// Confirm / cancel / dispute, shared by the dashboard and the booking page.
// On success we refetch bookings and the wallet so every number updates.
export function useBookingActions() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const options = {
    onSuccess: () => {
      for (const key of ['bookings', 'booking', 'wallet', 'offer', 'offers', 'my-offers', 'dispute']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (err) => toast({ title: 'That did not work', description: err.message, tone: 'error' }),
  };

  const confirm = useMutation({ mutationFn: (id) => api(`/bookings/${id}/confirm`, { method: 'POST' }), ...options });
  const cancel = useMutation({ mutationFn: (id) => api(`/bookings/${id}/cancel`, { method: 'POST' }), ...options });
  const dispute = useMutation({
    mutationFn: ({ id, reason }) => api(`/bookings/${id}/dispute`, { method: 'POST', body: { reason } }),
    ...options,
    onError: undefined, // the dispute form shows its own error under the text box
  });

  return { confirm, cancel, dispute };
}
