import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import { formatDateTime, formatMinutes } from '../lib/format.js';
import { Avatar, Badge, Button, Card, ErrorNote, Field, Input, Loading, Textarea } from './ui.jsx';

// Pick how the escrow is split: quick presets plus a slider for anything else.
function RefundChooser({ credits, value, onChange, learnerName, teacherName }) {
  const presets = [
    ['Full refund', credits],
    ['Split 50/50', Math.ceil(credits / 2)],
    ['Pay teacher', 0],
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {presets.map(([label, amount]) => (
          <button
            key={label}
            type="button"
            onClick={() => onChange(amount)}
            className={`rounded-full px-3 py-1 text-sm ring-1 ring-inset ${
              value === amount ? 'bg-teal-600 text-white ring-teal-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <Input type="range" min={0} max={credits} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="!p-0 accent-teal-600" />
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-slate-500">{learnerName} (learner) gets back</p>
          <p className="font-semibold text-slate-900">{formatMinutes(value)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-slate-500">{teacherName} (teacher) receives</p>
          <p className="font-semibold text-slate-900">{formatMinutes(credits - value)}</p>
        </div>
      </div>
    </div>
  );
}

// A dispute action (propose, accept, note, resolve). On success the server
// returns the updated dispute, which we put straight into the cache.
function useDisputeAction(disputeId, request, successTitle) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: request,
    onSuccess: (result) => {
      queryClient.setQueryData(['dispute', disputeId], result);
      for (const key of ['booking', 'bookings', 'wallet', 'admin']) queryClient.invalidateQueries({ queryKey: [key] });
      if (successTitle) toast({ title: successTitle, tone: 'success' });
    },
    onError: (err) => toast({ title: 'That did not work', description: err.message, tone: 'error' }),
  });
}

function describe(learnerRefund, credits) {
  if (learnerRefund === credits) return 'a full refund to the learner';
  if (learnerRefund === 0) return 'full payment to the teacher';
  return `${formatMinutes(learnerRefund)} back to the learner and ${formatMinutes(credits - learnerRefund)} to the teacher`;
}

export default function DisputePanel({ disputeId, booking }) {
  const { user } = useAuth();
  const credits = booking.credits;
  const [refund, setRefund] = useState(Math.ceil(credits / 2));
  const [note, setNote] = useState('');
  const [adminNote, setAdminNote] = useState('');

  const { data, isLoading, error } = useQuery({ queryKey: ['dispute', disputeId], queryFn: () => api(`/disputes/${disputeId}`) });

  const post = (path, body) => api(`/disputes/${disputeId}/${path}`, { method: 'POST', body });
  const propose = useDisputeAction(disputeId, (amount) => post('propose', { learnerRefund: amount }), 'Proposal sent');
  const accept = useDisputeAction(disputeId, (amount) => post('accept', { learnerRefund: amount }));
  const addNote = useDisputeAction(disputeId, (text) => post('notes', { text }));
  const resolve = useDisputeAction(
    disputeId,
    ({ amount, text }) => api(`/admin/disputes/${disputeId}/resolve`, { method: 'POST', body: { learnerRefund: amount, note: text || undefined } }),
    'Dispute resolved',
  );

  if (isLoading) return <Loading />;
  if (error) return <ErrorNote error={error} />;

  const dispute = data.dispute;
  const isOpen = dispute.status === 'OPEN';
  const isParty = Boolean(dispute.myRole);
  const isAdmin = user.role === 'admin';
  const proposal = dispute.proposal;
  const proposedByMe = proposal && proposal.by === user.id;
  const proposerName = proposal && (proposal.by === dispute.teacher.id ? dispute.teacher.name : dispute.learner.name);
  const names = { learnerName: dispute.learner.name.split(' ')[0], teacherName: dispute.teacher.name.split(' ')[0] };

  return (
    <Card className="overflow-hidden border-amber-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3">
        <h2 className="font-semibold text-amber-900">Dispute</h2>
        <Badge tone={isOpen ? 'amber' : 'violet'}>{isOpen ? 'Open · credits frozen' : 'Resolved'}</Badge>
      </div>

      <div className="space-y-6 p-5">
        {dispute.resolution && (
          <div className="rounded-lg bg-violet-50 p-4 text-sm text-violet-900">
            <p className="font-medium">{dispute.resolution.method === 'ADMIN' ? 'Decided by an admin' : 'Resolved by agreement'}</p>
            <p className="mt-1">
              {formatMinutes(dispute.resolution.learnerRefund)} returned to {dispute.learner.name}, {formatMinutes(dispute.resolution.teacherPayout)} paid to{' '}
              {dispute.teacher.name}.
            </p>
          </div>
        )}

        {isOpen && proposal && (
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm">
            <p className="text-teal-900">
              <strong>{proposedByMe ? 'You' : proposerName}</strong> proposed {describe(proposal.learnerRefund, credits)}.
            </p>
            {isParty && !proposedByMe && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" loading={accept.isPending} onClick={() => accept.mutate(proposal.learnerRefund)}>
                  Accept and close the dispute
                </Button>
              </div>
            )}
            {proposedByMe && <p className="mt-1 text-teal-700">Waiting for the other person to accept.</p>}
          </div>
        )}

        {isOpen && isParty && (
          <div>
            <h3 className="text-sm font-medium text-slate-800">{proposal ? 'Suggest a different split' : 'Suggest how to settle it'}</h3>
            <p className="mb-3 text-sm text-slate-500">If the other person accepts, the credits are paid out straight away.</p>
            <RefundChooser credits={credits} value={refund} onChange={setRefund} {...names} />
            <Button className="mt-3" variant="secondary" loading={propose.isPending} onClick={() => propose.mutate(refund)}>
              Send proposal
            </Button>
          </div>
        )}

        {isOpen && isAdmin && (
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-medium text-slate-800">Admin decision</h3>
            <p className="mb-3 text-sm text-slate-500">Read both sides below, then decide. This is final.</p>
            <RefundChooser credits={credits} value={refund} onChange={setRefund} {...names} />
            <Field label="Reason (shown to both people)" htmlFor="admin-note">
              <Input id="admin-note" value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="e.g. Session was cut short by 20 minutes" />
            </Field>
            <Button className="mt-3" loading={resolve.isPending} onClick={() => resolve.mutate({ amount: refund, text: adminNote })}>
              Resolve dispute
            </Button>
          </div>
        )}

        <div>
          <h3 className="mb-3 text-sm font-medium text-slate-800">Timeline</h3>
          <ol className="space-y-4">
            {dispute.notes.map((n, i) => (
              <li key={n.id ?? i} className="flex gap-3">
                {n.kind === 'SYSTEM' ? (
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-500">●</span>
                ) : (
                  <Avatar name={n.author?.name} size="sm" />
                )}
                <div className="min-w-0 text-sm">
                  <p className="text-slate-500">
                    <span className="font-medium text-slate-700">{n.author?.name}</span>
                    {n.author?.role === 'admin' && ' (admin)'} · {formatDateTime(n.createdAt)}
                  </p>
                  <p className={n.kind === 'SYSTEM' ? 'italic text-slate-600' : 'text-slate-800'}>{n.text}</p>
                </div>
              </li>
            ))}
          </ol>

          {isOpen && (isParty || isAdmin) && (
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (note.trim()) addNote.mutate(note.trim(), { onSuccess: () => setNote('') });
              }}
            >
              <Textarea rows={1} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a message…" aria-label="Message" />
              <Button type="submit" variant="secondary" loading={addNote.isPending}>
                Send
              </Button>
            </form>
          )}
        </div>
      </div>
    </Card>
  );
}
