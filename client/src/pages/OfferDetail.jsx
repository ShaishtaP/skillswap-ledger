import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Avatar, Button, Card, Dialog, EmptyState, ErrorNote, Loading, SkillTags } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import { formatDay, formatMinutes, formatTime } from '../lib/format.js';

function groupByDay(slots) {
  const groups = new Map();
  for (const slot of slots) {
    const key = new Date(slot.startsAt).toDateString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(slot);
  }
  return [...groups.values()];
}

export default function OfferDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);

  const { data, isLoading, error } = useQuery({ queryKey: ['offer', id], queryFn: () => api(`/offers/${id}`) });
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: () => api('/wallet'), enabled: Boolean(user) });

  const book = useMutation({
    mutationFn: (slotId) => api(`/slots/${slotId}/book`, { method: 'POST' }),
    onSuccess: ({ booking }) => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      navigate(`/bookings/${booking.id}`);
    },
    onError: (err) => {
      setSelected(null);
      toast({ title: 'Could not book', description: err.message, tone: 'error' });
      queryClient.invalidateQueries({ queryKey: ['offer', id] });
    },
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorNote error={error} />;

  const offer = data.offer;
  const isOwn = user?.id === offer.teacher.id;
  const balance = wallet.data?.balance ?? 0;
  const cost = offer.durationMinutes;
  const canAfford = balance >= cost;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div>
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-700">
          ← All sessions
        </Link>
        <div className="mt-4">
          <SkillTags skills={offer.skills} />
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{offer.title}</h1>
          <p className="mt-2 text-slate-500">
            {formatMinutes(offer.durationMinutes)} session · costs {cost} credits
          </p>
        </div>

        {offer.description && <p className="mt-6 whitespace-pre-line leading-relaxed text-slate-700">{offer.description}</p>}

        <Card className="mt-8 flex gap-4 p-5">
          <Avatar name={offer.teacher.name} size="lg" />
          <div>
            <p className="text-sm text-slate-500">Your teacher</p>
            <p className="font-semibold text-slate-900">{offer.teacher.name}</p>
            {offer.teacher.bio && <p className="mt-1 text-sm text-slate-600">{offer.teacher.bio}</p>}
            {offer.teacher.skills?.length > 0 && (
              <div className="mt-2">
                <SkillTags skills={offer.teacher.skills} />
              </div>
            )}
          </div>
        </Card>

        <Card className="mt-4 bg-slate-50 p-5 text-sm text-slate-600">
          <p className="font-medium text-slate-800">How payment works</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Booking moves {cost} credits from your balance into a safe holding account (escrow).</li>
            <li>After the session, you both confirm it happened and the teacher receives the credits.</li>
            <li>Cancel more than 24 hours before for a full refund. Later than that, you get half back.</li>
            <li>Something went wrong? Open a dispute and the credits stay frozen until it is sorted out.</li>
          </ul>
        </Card>
      </div>

      <aside>
        <Card className="p-5 lg:sticky lg:top-24">
          <h2 className="font-semibold text-slate-900">Available times</h2>
          {user && !isOwn && (
            <p className={`mt-1 text-sm ${canAfford ? 'text-slate-500' : 'text-amber-700'}`}>
              Your balance: {formatMinutes(balance)}
              {!canAfford && ` · you need ${formatMinutes(cost - balance)} more. Teach a session to earn credits.`}
            </p>
          )}

          {isOwn && (
            <p className="mt-3 rounded-lg bg-teal-50 p-3 text-sm text-teal-800">
              This is your offer. Manage its times on the <Link to="/teach" className="font-medium underline">Teach</Link> page.
            </p>
          )}

          {offer.slots.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No open times right now">Check back soon. The teacher may add more.</EmptyState>
            </div>
          ) : (
            <div className="mt-4 space-y-5">
              {groupByDay(offer.slots).map((slots) => (
                <div key={slots[0].id}>
                  <p className="text-sm font-medium text-slate-700">{formatDay(slots[0].startsAt)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {slots.map((slot) => (
                      <Button
                        key={slot.id}
                        variant="secondary"
                        size="sm"
                        disabled={isOwn || (user && !canAfford)}
                        onClick={() => (user ? setSelected(slot) : navigate(`/login?next=/offers/${id}`))}
                      >
                        {formatTime(slot.startsAt)}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!user && offer.slots.length > 0 && <p className="mt-4 text-sm text-slate-500">Log in to book a time.</p>}
        </Card>
      </aside>

      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Confirm your booking"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Not yet
            </Button>
            <Button loading={book.isPending} onClick={() => book.mutate(selected.id)}>
              Book for {cost} credits
            </Button>
          </>
        }
      >
        {selected && (
          <>
            <p>
              <strong className="text-slate-800">{offer.title}</strong> with {offer.teacher.name}
              <br />
              {formatDay(selected.startsAt)} at {formatTime(selected.startsAt)}
            </p>
            <p className="mt-3">
              {cost} credits will be held from your balance ({formatMinutes(balance)} → {formatMinutes(balance - cost)}). {offer.teacher.name.split(' ')[0]} receives
              them once you both confirm the session happened.
            </p>
          </>
        )}
      </Dialog>
    </div>
  );
}
