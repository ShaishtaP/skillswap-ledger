import { useQuery } from '@tanstack/react-query';
import { useBookingActions } from '../hooks/useBookingActions.js';
import { api } from '../lib/api.js';
import { confirmedBy, hasStarted } from '../lib/bookings.js';
import { formatTime, relativeTime } from '../lib/format.js';
import { Badge, Button, Card } from './ui.jsx';

function Person({ name, data }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-[15px]">
      <span className="text-ink">{name}</span>
      <span className={data.joined ? 'font-mono text-sm text-body' : 'font-mono text-sm text-ox'}>
        {data.connectedNow ? `on the call · ${data.minutes} min` : data.joined ? `${data.minutes} min` : "didn't join"}
      </span>
    </div>
  );
}

// The booking page's video call panel: join button, who has been on the
// call, and a nudge to confirm when you were clearly both there.
export default function CallCard({ booking }) {
  const { confirm } = useBookingActions();
  const { data } = useQuery({ queryKey: ['call', booking.id], queryFn: () => api(`/bookings/${booking.id}/call`), refetchInterval: 30_000 });
  if (!data) return null;

  const role = booking.myRole;
  const { attendance: a } = data;
  const anyoneJoined = a.teacher.joined || a.learner.joined;
  if (booking.status !== 'BOOKED' && !anyoneJoined) return null;

  const suggestConfirm = role && booking.status === 'BOOKED' && hasStarted(booking) && !confirmedBy(booking, role) && a.togetherMinutes >= booking.credits / 2;
  const pill = { open: ['ok', 'Open now'], upcoming: ['slate', `Opens ${relativeTime(data.opensAt)}`], closed: ['slate', 'Ended'] }[data.status];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <h2 className="font-display text-xl text-ink">Video call</h2>
        {booking.status === 'BOOKED' && <Badge tone={pill[0] === 'ok' ? 'emerald' : 'slate'}>{pill[1]}</Badge>}
      </div>
      <div className="space-y-5 p-6">
        {role && booking.status === 'BOOKED' && data.status !== 'closed' && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-sm text-[15px]">
              {data.canJoin
                ? `The call is open until ${formatTime(data.closesAt)}. Your video goes straight to the other person, and nothing is recorded.`
                : 'The call opens 10 minutes before the start. You can test your camera and microphone now.'}
            </p>
            <Button to={`/bookings/${booking.id}/call`} variant={data.canJoin ? 'primary' : 'secondary'}>
              {data.canJoin ? 'Join the call' : 'Test camera & mic'}
            </Button>
          </div>
        )}

        {anyoneJoined && (
          <div>
            <p className="label text-muted">Time on the call</p>
            <div className="mt-2 divide-y divide-line">
              <Person name={`${booking.teacher.name} (teacher)`} data={a.teacher} />
              <Person name={`${booking.learner.name} (learner)`} data={a.learner} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-champagne">
                <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, (a.togetherMinutes / a.sessionMinutes) * 100)}%` }} />
              </div>
              <span className="font-mono text-sm text-ink">
                together {a.togetherMinutes} of {a.sessionMinutes} min
              </span>
            </div>
          </div>
        )}

        {suggestConfirm && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gold-2 bg-gold-soft/60 p-4">
            <p className="text-[15px] text-ink">
              You were both on the call for {a.togetherMinutes} minutes. <b className="font-semibold">Looks like it happened.</b>
            </p>
            <Button size="sm" loading={confirm.isPending} onClick={() => confirm.mutate(booking.id)}>
              Confirm it happened
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
