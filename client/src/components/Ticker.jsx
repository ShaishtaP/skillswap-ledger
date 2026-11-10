import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { formatMinutes } from '../lib/format.js';

// A slow-scrolling strip of real, recently completed sessions.
export default function Ticker() {
  const { data } = useQuery({ queryKey: ['community', 'recent'], queryFn: () => api('/community/recent') });
  const swaps = data?.swaps ?? [];
  if (swaps.length < 3) return null;

  // The list is rendered twice so the loop scrolls seamlessly.
  const items = [...swaps, ...swaps];
  return (
    <div className="ticker overflow-hidden border-y border-line bg-champagne" aria-label="Recently completed sessions">
      <div className="ticker-track">
        {items.map((s, i) => (
          <span key={`${s.id}-${i}`} className="whitespace-nowrap font-mono text-[13px]">
            <b className="font-medium text-ink">
              {s.teacher} → {s.learner}
            </b>{' '}
            · {s.offerTitle} · {formatMinutes(s.minutes)} <span className="text-gold">✓ settled</span>
          </span>
        ))}
      </div>
    </div>
  );
}
