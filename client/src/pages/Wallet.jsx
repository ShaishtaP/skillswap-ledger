import { useQuery } from '@tanstack/react-query';
import { Badge, Card, ErrorNote, Loading, PageHeader } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { formatDateTime, formatMinutes } from '../lib/format.js';

const TYPES = {
  SIGNUP_GRANT: ['gold', 'Welcome credits'],
  BOOKING_HOLD: ['sky', 'Held for booking'],
  SETTLEMENT: ['emerald', 'Earned'],
  REFUND: ['slate', 'Refund'],
  CANCELLATION_FEE: ['amber', 'Cancellation'],
  DISPUTE_RESOLUTION: ['violet', 'Dispute payout'],
};

export default function Wallet() {
  const { data, isLoading, error } = useQuery({ queryKey: ['wallet'], queryFn: () => api('/wallet') });

  if (isLoading) return <Loading />;
  if (error) return <ErrorNote error={error} />;

  return (
    <div>
      <PageHeader eyebrow="Wallet" title={<>Every minute, <em className="italic">accounted for</em></>} subtitle="Your time credits and every movement in and out." />

      <div className="grid gap-5 md:grid-cols-[1fr_1.6fr]">
        <Card className="relative overflow-hidden p-8">
          <span className="blob -top-16 -right-16 h-48 w-48 bg-gold opacity-25" aria-hidden="true" />
          <span className="label text-muted">Available balance</span>
          <p className="gold-text mt-3 font-display text-7xl leading-none">{data.balance}</p>
          <p className="mt-2 inline-block border-b-[3px] border-double border-ink pb-1 text-ink">minutes · {formatMinutes(data.balance)}</p>
        </Card>
        <Card className="p-8">
          <span className="label text-gold">How it stays honest</span>
          <p className="mt-3 leading-relaxed">
            Every line below is permanent: entries are only ever added, never edited or deleted. Each movement has a matching opposite entry somewhere else (like the
            holding account for a booking), so credits can't appear from nowhere and are never paid twice.
          </p>
        </Card>
      </div>

      <Card className="mt-8 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-xl text-ink">Statement</h2>
          <span className="label text-muted">{data.entries.length} entries</span>
        </div>
        {data.entries.length === 0 ? (
          <p className="p-6 text-muted">No movements yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.entries.map((entry) => {
              const [tone, label] = TYPES[entry.type] ?? ['slate', entry.type];
              return (
                <li key={entry.id} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-ink">{entry.memo}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                      <Badge tone={tone}>{label}</Badge>
                      {formatDateTime(entry.createdAt)}
                    </div>
                  </div>
                  <p className={`shrink-0 font-mono text-[15px] tabular-nums ${entry.amount > 0 ? 'text-ok' : 'text-ox'}`}>
                    {entry.amount > 0 ? '+' : ''}
                    {entry.amount}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex justify-between border-t-[3px] border-double border-ink bg-ivory px-6 py-4 font-mono text-ink">
          <span>Balance</span>
          <span>{data.balance}</span>
        </div>
      </Card>
    </div>
  );
}
