import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import BookingRow from '../components/BookingRow.jsx';
import CancelDialog from '../components/CancelDialog.jsx';
import RisoArt from '../components/RisoArt.jsx';
import { Button, Card, EmptyState, ErrorNote, Loading } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useBookingActions } from '../hooks/useBookingActions.js';
import { api } from '../lib/api.js';
import { confirmedBy, hasStarted, isCallOpen, myRole, otherPerson } from '../lib/bookings.js';
import { formatDateTime, formatMinutes } from '../lib/format.js';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function Section({ title, count, children }) {
  return (
    <section className="mt-14">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="label text-muted">{title}</h2>
        {count > 0 && <span className="rounded-full bg-champagne px-2 py-0.5 font-mono text-[11px] text-body">{count}</span>}
      </div>
      {children}
    </section>
  );
}

// The one thing that needs you, presented as an "admit one" ticket.
function NeedsYou({ booking, role, confirm }) {
  const other = otherPerson(booking, role);
  const otherConfirmed = confirmedBy(booking, role === 'teacher' ? 'learner' : 'teacher');
  const live = isCallOpen(booking) && Date.now() < new Date(booking.endsAt).getTime();
  if (live) {
    return (
      <div className="ticket grid overflow-hidden rounded-2xl bg-ink text-ivory md:grid-cols-[200px_1fr_180px]">
        <RisoArt offer={{ title: booking.offerTitle, skills: booking.skills }} className="min-h-40 md:min-h-full" glyphScale={0.9} />
        <div className="border-b-2 border-dashed border-gold-2/50 p-7 md:border-r-2 md:border-b-0">
          <span className="label text-gold-2">Happening now · until {formatDateTime(booking.endsAt)}</span>
          <h3 className="mt-3 font-display text-[28px] leading-tight text-white">
            {booking.offerTitle} with {other?.name.split(' ')[0]}
          </h3>
          <p className="mt-2 text-[#d9d2c4]">The video call is open. Join from here, and confirm once you're done.</p>
        </div>
        <div className="flex flex-col justify-center gap-2.5 p-6">
          <Button to={`/bookings/${booking.id}/call`}>Join the call</Button>
          <Link to={`/bookings/${booking.id}`} className="rounded-md border border-gold-2/60 px-4 py-2.5 text-center text-sm text-gold-2 hover:bg-white/5">
            Details
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="ticket grid overflow-hidden rounded-2xl bg-ink text-ivory md:grid-cols-[200px_1fr_180px]">
      <RisoArt offer={{ title: booking.offerTitle, skills: booking.skills }} className="min-h-40 md:min-h-full" glyphScale={0.9} />
      <div className="border-b-2 border-dashed border-gold-2/50 p-7 md:border-r-2 md:border-b-0">
        <span className="label text-gold-2">One thing needs you · {formatDateTime(booking.startsAt)}</span>
        <h3 className="mt-3 font-display text-[28px] leading-tight text-white">
          Did {booking.offerTitle} with {other?.name.split(' ')[0]} happen?
        </h3>
        <p className="mt-2 text-[#d9d2c4]">
          {otherConfirmed ? `${other?.name.split(' ')[0]} has confirmed. ` : ''}
          {role === 'learner' ? `Once you both confirm, ${formatMinutes(booking.credits)} go to your teacher.` : `Once you both confirm, you receive ${formatMinutes(booking.credits)}.`}
        </p>
      </div>
      <div className="flex flex-col justify-center gap-2.5 p-6">
        <Button loading={confirm.isPending && confirm.variables === booking.id} onClick={() => confirm.mutate(booking.id)}>
          Yes, it did
        </Button>
        <Link to={`/bookings/${booking.id}#problem`} className="rounded-md border border-gold-2/60 px-4 py-2.5 text-center text-sm text-gold-2 hover:bg-white/5">
          Report a problem
        </Link>
      </div>
    </div>
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
  const minutes = (role) => completed.filter((b) => myRole(b, user) === role).reduce((sum, b) => sum + b.credits, 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <span className="eyebrow">Your desk</span>
          <h1 className="mt-1 font-display text-5xl leading-[1.02] text-ink sm:text-6xl">
            {greeting()},<br />
            <em className="text-ox">{user.name.split(' ')[0]}.</em>
          </h1>
          <p className="mt-4 text-muted">
            Taught {formatMinutes(minutes('teacher'))} · learned {formatMinutes(minutes('learner'))} so far
          </p>
        </div>
        <Link to="/wallet" className="text-right">
          <span className="label text-muted">Your balance</span>
          <p className="gold-text font-display text-7xl leading-none sm:text-8xl">{wallet.data?.balance ?? '…'}</p>
          <span className="text-sm">minutes to spend</span>
        </Link>
      </div>

      {needsMe.length > 0 && (
        <div className="mt-12 space-y-5">
          <NeedsYou booking={needsMe[0]} role={needsMe[0].role} confirm={confirm} />
          {needsMe.length > 1 && (
            <Card className="divide-y divide-line">
              {needsMe.slice(1).map((b) => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  showStatus={false}
                  actions={
                    <Button size="sm" loading={confirm.isPending && confirm.variables === b.id} onClick={() => confirm.mutate(b.id)}>
                      Confirm
                    </Button>
                  }
                />
              ))}
            </Card>
          )}
        </div>
      )}

      {disputes.length > 0 && (
        <Section title="Open disputes" count={disputes.length}>
          <Card className="divide-y divide-line">
            {disputes.map((b) => (
              <BookingRow key={b.id} booking={b} actions={<Button size="sm" variant="secondary" to={`/bookings/${b.id}`}>View dispute</Button>} />
            ))}
          </Card>
        </Section>
      )}

      <Section title="Coming up" count={upcoming.length}>
        {upcoming.length === 0 ? (
          <EmptyState
            title="Nothing booked yet"
            action={
              <div className="flex justify-center gap-3">
                <Button to="/">Find a session</Button>
                <Button to="/teach" variant="secondary">
                  Offer one
                </Button>
              </div>
            }
          >
            Find something you'd like to learn, or add times to your own sessions so others can book you.
          </EmptyState>
        ) : (
          <Card className="divide-y divide-line">
            {upcoming.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                showStatus={false}
                actions={
                  isCallOpen(b) ? (
                    <Button size="sm" to={`/bookings/${b.id}/call`}>
                      Join call
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setCancelling(b)}>
                      Cancel
                    </Button>
                  )
                }
              />
            ))}
          </Card>
        )}
      </Section>

      {waiting.length > 0 && (
        <Section title="Waiting for the other person" count={waiting.length}>
          <Card className="divide-y divide-line">
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
