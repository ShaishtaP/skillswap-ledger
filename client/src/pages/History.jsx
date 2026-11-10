import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import BookingRow from '../components/BookingRow.jsx';
import { Button, Card, EmptyState, ErrorNote, Input, Loading, PageHeader, Select } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api, queryString } from '../lib/api.js';
import { myRole } from '../lib/bookings.js';
import { formatMinutes } from '../lib/format.js';

const STATUSES = [
  ['', 'Any status'],
  ['COMPLETED', 'Completed'],
  ['BOOKED', 'Booked'],
  ['CANCELLED', 'Cancelled'],
  ['DISPUTED', 'Disputed'],
  ['RESOLVED', 'Resolved'],
];

// Every session you've learned or taught, searchable. Filters live in the
// URL (?q=python&role=learner) so a filtered view can be bookmarked.
export default function History() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const filters = { q: params.get('q') ?? '', role: params.get('role') ?? '', status: params.get('status') ?? '' };
  const [draft, setDraft] = useState(filters.q);

  const { data, isLoading, error } = useQuery({
    queryKey: ['bookings', filters],
    queryFn: () => api(`/bookings${queryString(filters)}`),
  });

  const update = (next) => setParams(Object.fromEntries(Object.entries({ ...filters, ...next }).filter(([, v]) => v)));

  const completed = (data?.bookings ?? []).filter((b) => b.status === 'COMPLETED');
  const sum = (role) => completed.filter((b) => myRole(b, user) === role).reduce((total, b) => total + b.credits, 0);

  return (
    <div>
      <PageHeader eyebrow="History" title={<>Everything you've <em className="italic">swapped</em></>} subtitle="Every session you've taught or attended, searchable." />

      <Card className="mb-6 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto]">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: draft.trim() });
          }}
        >
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search by title or skill" aria-label="Search history" />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
        <Select value={filters.role} onChange={(e) => update({ role: e.target.value })} aria-label="Role">
          <option value="">Learning & teaching</option>
          <option value="learner">Only learning</option>
          <option value="teacher">Only teaching</option>
        </Select>
        <Select value={filters.status} onChange={(e) => update({ status: e.target.value })} aria-label="Status">
          {STATUSES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Card>

      {completed.length > 0 && (
        <p className="mb-3 text-sm text-muted">
          In this view: learned {formatMinutes(sum('learner'))} · taught {formatMinutes(sum('teacher'))}
        </p>
      )}

      <ErrorNote error={error} />
      {isLoading ? (
        <Loading />
      ) : data?.bookings.length === 0 ? (
        <EmptyState title="No sessions found">{filters.q || filters.role || filters.status ? 'Try removing some filters.' : 'Your sessions will appear here once you book or teach one.'}</EmptyState>
      ) : (
        <Card className="divide-y divide-line">
          {data?.bookings.map((b) => (
            <BookingRow key={b.id} booking={b} />
          ))}
        </Card>
      )}
    </div>
  );
}
