import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import RisoArt from '../components/RisoArt.jsx';
import { Avatar, Badge, Button, EmptyState, ErrorNote, Loading, SkillTags, cx } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import { formatMinutes, formatTime } from '../lib/format.js';

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

function Accordion({ title, open, children }) {
  return (
    <details open={open} className="group border-b border-line">
      <summary className="flex cursor-pointer list-none justify-between py-5 label text-ink [&::-webkit-details-marker]:hidden">
        {title}
        <span className="text-base leading-none text-gold group-open:hidden">+</span>
        <span className="hidden text-base leading-none text-gold group-open:inline">−</span>
      </summary>
      <div className="pb-5 text-[15px] leading-relaxed">{children}</div>
    </details>
  );
}

// A session page works like a product page in a clothes shop: big artwork
// on the left, and on the right you pick a time the way you'd pick a size.
export default function OfferDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [chosenId, setChosenId] = useState(null);

  const { data, isLoading, error } = useQuery({ queryKey: ['offer', id], queryFn: () => api(`/offers/${id}`) });
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: () => api('/wallet'), enabled: Boolean(user) });

  const book = useMutation({
    mutationFn: (slotId) => api(`/slots/${slotId}/book`, { method: 'POST' }),
    onSuccess: ({ booking }) => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      navigate(`/bookings/${booking.id}`);
    },
    onError: (err) => {
      toast({ title: 'Could not book', description: err.message, tone: 'error' });
      queryClient.invalidateQueries({ queryKey: ['offer', id] });
    },
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorNote error={error} />;

  const offer = data.offer;
  const isOwn = user?.id === offer.teacher.id;
  const cost = offer.durationMinutes;
  const balance = wallet.data?.balance ?? 0;
  const canAfford = balance >= cost;
  const chosen = offer.slots.find((s) => s.id === chosenId) ?? offer.slots[0];
  const firstName = offer.teacher.name.split(' ')[0];

  return (
    <div>
      <Link to="/" className="label text-muted hover:text-ox">
        ← All sessions
      </Link>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        {/* Left: the artwork and two small facts */}
        <div className="space-y-5">
          <div className="tape">
            <div className="print">
              <RisoArt offer={offer} className="aspect-[4/5]" glyphScale={1.15} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col justify-between rounded-2xl bg-ink p-6 text-ivory">
              <span className="label text-gold-2">You'll leave with</span>
              <p className="mt-4 font-display text-xl leading-snug italic">{offer.outcome || 'A new skill and a friendly teacher.'}</p>
            </div>
            <div className="rounded-2xl border border-line bg-champagne p-6">
              <span className="label text-muted">So far</span>
              <p className="mt-3 font-display text-5xl text-ox">{offer.taughtCount}×</p>
              <p className="mt-1 text-sm">taught on SkillSwap</p>
            </div>
          </div>
        </div>

        {/* Right: everything needed to decide and book */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <span className="label text-muted">
            {offer.category} / {offer.skills[0] ?? 'session'}
          </span>
          <div className="mt-3 flex flex-wrap gap-2">
            {offer.memberPick && <Badge tone="gold">Member pick</Badge>}
            {offer.isNew && <Badge tone="ox">New</Badge>}
          </div>
          <h1 className="mt-3 font-display text-4xl leading-[1.05] text-ink sm:text-5xl">{offer.title}</h1>
          <p className="mt-3 text-[15px] text-muted">
            with <span className="text-ink">{offer.teacher.name}</span>
            {offer.taughtCount > 0 && ` · taught ${offer.taughtCount} ${offer.taughtCount === 1 ? 'time' : 'times'}`}
          </p>
          <p className="mt-6 text-lg text-ink">
            {formatMinutes(cost)} <span className="ml-2 text-sm text-muted">= {cost} credits</span>
          </p>
          {offer.description && <p className="mt-4 max-w-md leading-relaxed whitespace-pre-line">{offer.description}</p>}

          {isOwn ? (
            <div className="mt-8 rounded-xl border border-gold-2 bg-gold-soft/60 p-4 text-sm">
              This is your session. Manage its times on the{' '}
              <Link to="/teach" className="font-semibold text-ox underline">
                Teach
              </Link>{' '}
              page.
            </div>
          ) : offer.slots.length === 0 ? (
            <div className="mt-8">
              <EmptyState title="No open times right now">{firstName} may add more soon.</EmptyState>
            </div>
          ) : (
            <>
              <div className="mt-10 mb-3.5 flex justify-between label text-muted">
                <span>Choose a time</span>
                <span>{offer.slots.length} open</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {offer.slots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => setChosenId(slot.id)}
                    className={cx(
                      'rounded-lg border bg-card px-4 py-3.5 text-left transition',
                      slot.id === chosen.id ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-ink',
                    )}
                  >
                    <b className="block text-[15px] font-medium text-ink">{dayFmt.format(new Date(slot.startsAt))}</b>
                    <span className="text-sm text-muted">
                      {formatTime(slot.startsAt)} – {formatTime(slot.endsAt)}
                    </span>
                  </button>
                ))}
              </div>

              {user ? (
                <>
                  <Button size="lg" className="mt-6 w-full" disabled={!canAfford} loading={book.isPending} onClick={() => book.mutate(chosen.id)}>
                    Book this seat · {formatMinutes(cost)}
                  </Button>
                  <div className="mt-3 flex justify-between text-sm text-muted">
                    <span>Your balance {formatMinutes(balance)}</span>
                    <span className={canAfford ? '' : 'text-ox'}>
                      {canAfford ? `After booking ${formatMinutes(balance - cost)}` : `You need ${formatMinutes(cost - balance)} more`}
                    </span>
                  </div>
                </>
              ) : (
                <Button size="lg" className="mt-6 w-full" to={`/login?next=/offers/${id}`}>
                  Log in to book · {formatMinutes(cost)}
                </Button>
              )}

              <ul className="mt-7 border-t border-line">
                {[
                  'Your minutes are held, not spent, until you both confirm.',
                  'Cancel 24 hours ahead and every minute comes back.',
                  'If something goes wrong, the minutes stay frozen until it’s settled.',
                ].map((line) => (
                  <li key={line} className="flex gap-3.5 border-b border-line py-3.5 text-sm">
                    <i className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                    {line}
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-6">
            <Accordion title="You'll leave with" open>
              {offer.outcome || 'Ask your teacher what to expect. Every session ends with something you can use.'}
            </Accordion>
            <Accordion title={`About ${firstName}`}>
              <div className="flex gap-4">
                <Avatar name={offer.teacher.name} size="lg" />
                <div>
                  <p>{offer.teacher.bio || `${firstName} hasn't written a bio yet.`}</p>
                  {offer.teacher.skills?.length > 0 && (
                    <div className="mt-3">
                      <SkillTags skills={offer.teacher.skills} />
                    </div>
                  )}
                </div>
              </div>
            </Accordion>
            <Accordion title="Cancellations & disputes">
              More than 24 hours ahead: full refund. Later: half back, half to {firstName} for holding the time. If the session goes wrong, either of you can open a dispute and
              the minutes stay frozen until it's settled.
            </Accordion>
          </div>
        </div>
      </div>
    </div>
  );
}
