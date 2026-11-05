import { useQuery } from '@tanstack/react-query';
import { Badge, Card, ErrorNote, Loading, PageHeader } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { formatDateTime, formatMinutes } from '../lib/format.js';

const TYPES = {
  SIGNUP_GRANT: ['teal', 'Welcome credits'],
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
      <PageHeader title="Wallet" subtitle="Your time credits and every movement in and out." />

      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <Card className="bg-gradient-to-br from-teal-600 to-teal-800 p-6 text-white">
          <p className="text-sm text-teal-100">Available balance</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">{formatMinutes(data.balance)}</p>
          <p className="mt-1 text-sm text-teal-100">{data.balance} credits · 1 credit = 1 minute</p>
        </Card>
        <Card className="p-6 text-sm text-slate-600">
          <p className="font-medium text-slate-800">How your balance is kept honest</p>
          <p className="mt-2">
            Every line below is a permanent record: entries are only ever added, never edited or deleted. Each movement has a matching
            opposite entry somewhere else (for example, the holding account for a booking), so credits can't appear from nowhere
            and are never paid twice.
          </p>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Statement</h2>
        </div>
        {data.entries.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No movements yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.entries.map((entry) => {
              const [tone, label] = TYPES[entry.type] ?? ['slate', entry.type];
              return (
                <li key={entry.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{entry.memo}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <Badge tone={tone}>{label}</Badge>
                      {formatDateTime(entry.createdAt)}
                    </div>
                  </div>
                  <p className={`shrink-0 font-semibold tabular-nums ${entry.amount > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {entry.amount > 0 ? '+' : ''}
                    {formatMinutes(entry.amount)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
