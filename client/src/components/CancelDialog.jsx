import { cancellationPreview, otherPerson } from '../lib/bookings.js';
import { formatMinutes } from '../lib/format.js';
import { Button, Dialog } from './ui.jsx';

// Shows exactly who gets what before the user cancels.
export default function CancelDialog({ booking, role, onClose, onConfirm, pending }) {
  if (!booking) return <Dialog open={false} onClose={onClose} title="" footer={null} />;
  const { refund, fee } = cancellationPreview(booking, role);
  const other = otherPerson(booking, role)?.name ?? 'the other person';
  const learnerName = role === 'learner' ? 'You get' : `${booking.learner?.name ?? 'The learner'} gets`;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Cancel this session?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="danger" loading={pending} onClick={onConfirm}>
            Cancel session
          </Button>
        </>
      }
    >
      <p>
        <strong className="text-slate-800">{booking.offerTitle}</strong> with {other}.
      </p>
      <div className="mt-3 rounded-lg bg-slate-50 p-3">
        <p>
          {learnerName} <strong className="text-slate-800">{formatMinutes(refund)}</strong> back.
        </p>
        {fee > 0 && (
          <p className="mt-1 text-amber-700">
            This is less than 24 hours before the start, so {formatMinutes(fee)} goes to the teacher for the late notice.
          </p>
        )}
      </div>
    </Dialog>
  );
}
