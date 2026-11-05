import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import CancelDialog from '../components/CancelDialog.jsx';
import DisputePanel from '../components/DisputePanel.jsx';
import { Avatar, Button, Card, ErrorNote, Field, Loading, RoleBadge, StatusBadge, Textarea } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useBookingActions } from '../hooks/useBookingActions.js';
import { api, fieldErrors } from '../lib/api.js';
import { cancellationPreview, confirmedBy, hasStarted, otherPerson } from '../lib/bookings.js';
import { formatDateTime, formatMinutes, formatTime, relativeTime } from '../lib/format.js';

function Timeline({ booking }) {
  const confirmations = [
    { label: `${booking.learner.name} confirmed`, at: booking.learnerConfirmedAt, done: Boolean(booking.learnerConfirmedAt) },
    { label: `${booking.teacher.name} confirmed`, at: booking.teacherConfirmedAt, done: Boolean(booking.teacherConfirmedAt) },
  ];
  const steps = [
    { label: 'Booked, credits held in escrow', at: booking.createdAt, done: true },
    // Pending confirmations only make sense while the booking is still active.
    ...confirmations.filter((step) => step.done || booking.status === 'BOOKED'),
  ];
  if (booking.status === 'COMPLETED') steps.push({ label: `${formatMinutes(booking.credits)} paid to ${booking.teacher.name}`, at: booking.completedAt, done: true });
  if (booking.status === 'CANCELLED') steps.push({ label: `Cancelled by the ${booking.cancelledBy}`, at: booking.cancelledAt, done: true });
  if (booking.status === 'DISPUTED') steps.push({ label: 'Dispute opened, credits frozen', done: true, warn: true });
  if (booking.status === 'RESOLVED') steps.push({ label: 'Dispute resolved, credits paid out', done: true });

  return (
    <ol className="space-y-3">
      {steps.map((step) => (
        <li key={step.label} className="flex items-start gap-3 text-sm">
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
              step.warn ? 'bg-amber-100 text-amber-700' : step.done ? 'bg-teal-600 text-white' : 'border-2 border-slate-300'
            }`}
          >
            {step.done && (step.warn ? '!' : '✓')}
          </span>
          <div>
            <p className={step.done ? 'text-slate-800' : 'text-slate-400'}>{step.label}</p>
            {step.at && <p className="text-xs text-slate-500">{formatDateTime(step.at)}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ReportProblem({ booking }) {
  const { dispute } = useBookingActions();
  const [reason, setReason] = useState('');
  const errors = fieldErrors(dispute.error);

  return (
    <form
      id="problem"
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        dispute.mutate({ id: booking.id, reason });
      }}
    >
      <Field label="Something went wrong? Open a dispute" htmlFor="reason" error={errors.reason ?? dispute.error?.message} hint="The credits stay frozen until you agree on a split or an admin decides.">
        <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The teacher joined 20 minutes late" />
      </Field>
      <Button type="submit" variant="danger" loading={dispute.isPending} disabled={!reason.trim()}>
        Open dispute
      </Button>
    </form>
  );
}

function Actions({ booking, role }) {
  const { confirm, cancel } = useBookingActions();
  const [cancelling, setCancelling] = useState(false);
  const other = otherPerson(booking, role);

  if (!role) return null; // admins viewing someone else's booking

  if (booking.status === 'BOOKED' && !hasStarted(booking)) {
    const { refund, fee } = cancellationPreview(booking, role);
    return (
      <Card className="p-5">
        <h2 className="font-semibold text-slate-900">Starts {relativeTime(booking.startsAt)}</h2>
        <p className="mt-1 text-sm text-slate-500">
          After the session, you'll both confirm it happened and {booking.teacher.name.split(' ')[0]} will receive the credits.
        </p>
        <p className="mt-4 text-sm text-slate-600">
          {fee > 0
            ? `Cancelling now returns ${formatMinutes(refund)} to the learner; ${formatMinutes(fee)} goes to the teacher for the late notice.`
            : 'Cancelling now gives the learner a full refund.'}
        </p>
        <Button variant="danger" className="mt-3" onClick={() => setCancelling(true)}>
          Cancel session
        </Button>
        <CancelDialog
          booking={cancelling ? booking : null}
          role={role}
          pending={cancel.isPending}
          onClose={() => setCancelling(false)}
          onConfirm={() => cancel.mutate(booking.id, { onSettled: () => setCancelling(false) })}
        />
      </Card>
    );
  }

  if (booking.status === 'BOOKED') {
    const iConfirmed = confirmedBy(booking, role);
    return (
      <Card className="space-y-5 p-5">
        {iConfirmed ? (
          <div>
            <h2 className="font-semibold text-slate-900">Thanks, you've confirmed</h2>
            <p className="mt-1 text-sm text-slate-500">Waiting for {other.name} to confirm. The credits are released as soon as they do.</p>
          </div>
        ) : (
          <div>
            <h2 className="font-semibold text-slate-900">Did the session happen?</h2>
            <p className="mt-1 text-sm text-slate-500">
              Confirm if it went ahead. {booking.teacher.name.split(' ')[0]} is paid {formatMinutes(booking.credits)} once you both confirm.
            </p>
            <Button className="mt-3" loading={confirm.isPending} onClick={() => confirm.mutate(booking.id)}>
              Yes, it happened
            </Button>
          </div>
        )}
        <div className="border-t border-slate-100 pt-5">
          <ReportProblem booking={booking} />
        </div>
      </Card>
    );
  }

  if (booking.status === 'COMPLETED') {
    return (
      <Card className="border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <p className="font-semibold">Session completed</p>
        <p className="mt-1">
          {formatMinutes(booking.credits)} {role === 'teacher' ? 'were added to your balance' : `were paid to ${booking.teacher.name}`}.
        </p>
      </Card>
    );
  }

  if (booking.status === 'CANCELLED') {
    return (
      <Card className="p-5 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Cancelled by the {booking.cancelledBy}</p>
        <p className="mt-1">
          {formatMinutes(booking.refundMinutes)} returned to {booking.learner.name}
          {booking.feeMinutes > 0 && `, ${formatMinutes(booking.feeMinutes)} paid to ${booking.teacher.name} as a late-cancellation fee`}.
        </p>
      </Card>
    );
  }
  return null;
}

export default function BookingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const { data, isLoading, error } = useQuery({ queryKey: ['booking', id], queryFn: () => api(`/bookings/${id}`) });

  // Jump to the dispute form when linked from "Report a problem".
  useEffect(() => {
    if (data && location.hash === '#problem') document.getElementById('problem')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [data, location.hash]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorNote error={error} />;

  const booking = data.booking;
  const role = booking.myRole;

  return (
    <div>
      <Link to={user.role === 'admin' && !role ? '/admin' : '/dashboard'} className="text-sm text-slate-500 hover:text-slate-700">
        ← Back
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{booking.offerTitle}</h1>
        <StatusBadge status={booking.status} />
        {role && <RoleBadge role={role} />}
      </div>
      <p className="mt-1 text-slate-500">
        {formatDateTime(booking.startsAt)} – {formatTime(booking.endsAt)} · {formatMinutes(booking.credits)}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Actions booking={booking} role={role} />
          {booking.dispute && <DisputePanel disputeId={booking.dispute} booking={booking} />}
        </div>

        <div className="space-y-6">
          <Card className="divide-y divide-slate-100">
            {[
              ['Teacher', booking.teacher],
              ['Learner', booking.learner],
            ].map(([label, person]) => (
              <div key={label} className="flex items-center gap-3 p-4">
                <Avatar name={person.name} />
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="font-medium text-slate-800">
                    {person.name}
                    {person.id === user.id && ' (you)'}
                  </p>
                </div>
              </div>
            ))}
          </Card>
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-medium text-slate-800">Progress</h2>
            <Timeline booking={booking} />
          </Card>
        </div>
      </div>
    </div>
  );
}
