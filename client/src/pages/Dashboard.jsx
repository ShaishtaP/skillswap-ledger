import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import BookingRow from '../components/BookingRow.jsx';
import CancelDialog from '../components/CancelDialog.jsx';
import { Button, Card, EmptyState, ErrorNote, Loading, PageHeader } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useBookingActions } from '../hooks/useBookingActions.js';
import { api } from '../lib/api.js';
import { confirmedBy, hasStarted, myRole } from '../lib/bookings.js';
import { formatMinutes } from '../lib/format.js';

function Section({ title, count, children, tone }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {count > 0 && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone ?? 'bg-slate-100 text-slate-600'}`}>{count}</span>}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, hint }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { confirm, cancel } = useBookingActions();
  const [cancelling, setCancelling] = useState(null);

  const active = useQuery({ queryKey: ['bookings', { status: 'BOOKED,DISPUTED' }], queryFn: () => api('/bookings?status=BOOKED,DISPUTED') });
  const done = useQuery({ queryKey: ['bookings', { status: 'COMPLETED' }], queryFn: () => api('/bookings?status=COMPLETED') });
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: () => api('/wallet') });

  if (active.isLoading) return <Loading />;
  if (active.error) return <ErrorNote error={active.error} />;

  const bookings = active.data.bookings.map((b) => ({ ...b, role: myRole(b, user) }));
  const needsMe = bookings.filter((b) => b.status === 'BOOKED' && hasStarted(b) && !confirmedBy(b, b.role));
  const waiting = bookings.filter((b) => b.status === 'BOOKED' && hasStarted(b) && confirmedBy(b, b.role));
  const upcoming = bookings.filter((b) => b.status === 'BOOKED' && !hasStarted(b)).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const disputes = bookings.filter((b) => b.status === 'DISPUTED');

  const completed = done.data?.bookings ?? [];
  const taught = completed.filter((b) => myRole(b, user) === 'teacher').reduce((sum, b) => sum + b.credits, 0);
  const learned = completed.filter((b) => myRole(b, user) === 'learner').reduce((sum, b) => sum + b.credits, 0);
  const sessions = (role) => {
    const n = completed.filter((b) => myRole(b, user) === role).length;
    return `${n} completed session${n === 1 ? '' : 's'}`;
  };

  return (
    <div>
      <PageHeader
        title={`Hi, ${user.name.split(' ')[0]}`}
        subtitle="Here's what's happening with your sessions."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" to="/teach">
              Offer a session
            </Button>
            <Button to="/">Find a session</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Balance" value={wallet.data ? formatMinutes(wallet.data.balance) : '…'} hint="available to spend" />
        <Stat label="Upcoming" value={upcoming.length} hint="booked sessions" />
        <Stat label="Taught" value={formatMinutes(taught)} hint={sessions('teacher')} />
        <Stat label="Learned" value={formatMinutes(learned)} hint={sessions('learner')} />
      </div>

      {needsMe.length > 0 && (
        <Section title="Did these sessions happen?" count={needsMe.length} tone="bg-amber-100 text-amber-800">
          <Card className="divide-y divide-slate-100 border-amber-200">
            {needsMe.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                showStatus={false}
                actions={
                  <>
                    <Button size="sm" loading={confirm.isPending && confirm.variables === b.id} onClick={() => confirm.mutate(b.id)}>
                      Yes, confirm
                    </Button>
                    <Button size="sm" variant="secondary" to={`/bookings/${b.id}#problem`}>
                      Report a problem
                    </Button>
                  </>
                }
              />
            ))}
          </Card>
          <p className="mt-2 text-sm text-slate-500">The teacher is paid once both of you confirm.</p>
        </Section>
      )}

      {disputes.length > 0 && (
        <Section title="Open disputes" count={disputes.length} tone="bg-amber-100 text-amber-800">
          <Card className="divide-y divide-slate-100">
            {disputes.map((b) => (
              <BookingRow key={b.id} booking={b} actions={<Button size="sm" variant="secondary" to={`/bookings/${b.id}`}>View dispute</Button>} />
            ))}
          </Card>
        </Section>
      )}

      <Section title="Upcoming sessions" count={upcoming.length}>
        {upcoming.length === 0 ? (
          <EmptyState title="Nothing booked yet" action={<Button to="/">Browse sessions</Button>}>
            Find something you'd like to learn, or add times to your own offers so others can book you.
          </EmptyState>
        ) : (
          <Card className="divide-y divide-slate-100">
            {upcoming.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                showStatus={false}
                actions={
                  <Button size="sm" variant="ghost" onClick={() => setCancelling(b)}>
                    Cancel
                  </Button>
                }
              />
            ))}
          </Card>
        )}
      </Section>

      {waiting.length > 0 && (
        <Section title="Waiting for the other person to confirm" count={waiting.length}>
          <Card className="divide-y divide-slate-100">
            {waiting.map((b) => (
              <BookingRow key={b.id} booking={b} showStatus={false} />
            ))}
          </Card>
        </Section>
      )}

      <CancelDialog
        booking={cancelling}
        role={cancelling?.role}
        pending={cancel.isPending}
        onClose={() => setCancelling(null)}
        onConfirm={() => cancel.mutate(cancelling.id, { onSettled: () => setCancelling(null) })}
      />
    </div>
  );
}
