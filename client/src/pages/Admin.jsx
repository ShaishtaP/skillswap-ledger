import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Badge, Button, Card, EmptyState, ErrorNote, Loading, PageHeader, StatusBadge } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { formatDateTime, formatMinutes } from '../lib/format.js';

function HealthCard() {
  const { data, isLoading, isFetching, error, refetch } = useQuery({ queryKey: ['admin', 'health'], queryFn: () => api('/admin/health') });

  return (
    <Card className={`p-5 ${data && !data.ok ? 'border-rose-300' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-ink">Ledger health</h2>
          <p className="mt-1 text-sm text-muted">Checks that credits add up everywhere, recomputed from every ledger entry.</p>
        </div>
        <Button variant="secondary" size="sm" loading={isFetching} onClick={() => refetch()}>
          Run checks
        </Button>
      </div>
      <ErrorNote error={error} className="mt-4" />
      {isLoading && <Loading label="Checking…" />}
      {data && (
        <div className="mt-4">
          <div className={`flex items-center gap-2 font-medium ${data.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${data.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {data.ok ? 'All checks passed' : 'Problems found'}
            <span className="text-sm font-normal text-muted">· {formatDateTime(data.checkedAt)}</span>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-body">
            <li>✓ All {data.ledger.accountsChecked} accounts sum to {data.ledger.total} (nothing created or lost)</li>
            <li>✓ Every stored balance matches its ledger entries</li>
            <li>✓ No member has a negative balance</li>
            <li>✓ Escrow of all {data.escrow.bookingsChecked} bookings matches their status</li>
          </ul>
          {[...data.ledger.problems, ...data.escrow.problems].map((p) => (
            <p key={p} className="mt-2 rounded bg-rose-50 px-3 py-2 font-mono text-xs text-rose-700">
              {p}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}

function Stats() {
  const { data } = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api('/admin/stats') });
  if (!data) return null;
  const items = [
    ['Members', data.users],
    ['Active offers', data.activeOffers],
    ['Credits issued', formatMinutes(data.creditsIssued)],
    ['Ledger entries', data.ledgerEntries],
    ['Completed sessions', data.bookings.COMPLETED?.count ?? 0],
    ['Open disputes', data.openDisputes],
  ];
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(([label, value]) => (
        <Card key={label} className="p-4">
          <p className="text-xs text-muted">{label}</p>
          <p className="mt-1 font-display text-3xl text-ink">{value}</p>
        </Card>
      ))}
    </div>
  );
}

function Disputes() {
  const [status, setStatus] = useState('OPEN');
  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'disputes', status], queryFn: () => api(`/admin/disputes?status=${status}`) });

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="font-display text-xl text-ink">Disputes</h2>
        <div className="flex rounded-lg bg-champagne p-1 text-sm">
          {['OPEN', 'RESOLVED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-md px-3 py-1 ${status === s ? 'bg-card font-medium text-ink shadow-sm' : 'text-muted'}`}
            >
              {s === 'OPEN' ? 'Open' : 'Resolved'}
            </button>
          ))}
        </div>
      </div>
      <ErrorNote error={error} className="m-5" />
      {isLoading ? (
        <Loading />
      ) : data?.disputes.length === 0 ? (
        <div className="p-5">
          <EmptyState title={status === 'OPEN' ? 'No open disputes 🎉' : 'No resolved disputes yet'} />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {data?.disputes.map((d) => (
            <li key={d.id}>
              <Link to={`/bookings/${d.booking.id}`} className="flex flex-col gap-1 px-5 py-4 hover:bg-ivory sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink">{d.booking.offerTitle}</p>
                    <StatusBadge status={d.booking.status} />
                    {d.proposal && d.status === 'OPEN' && <Badge tone="teal">Proposal pending</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {d.openedBy.name}: “{d.reason}”
                  </p>
                </div>
                <p className="shrink-0 text-sm text-muted">
                  {d.teacher.name} ↔ {d.learner.name} · {formatMinutes(d.booking.credits)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function Admin() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title={<>Keep it <em className="italic">fair</em></>} subtitle="Watch the ledger, settle disputes, see how the community is doing." />
      <Stats />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] [&>*]:min-w-0">
        <HealthCard />
        <Disputes />
      </div>
    </div>
  );
}
