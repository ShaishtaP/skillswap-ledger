import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import RisoArt from '../components/RisoArt.jsx';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Loading, PageHeader, Select, SkillTags, StatusBadge, Textarea } from '../components/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api, fieldErrors } from '../lib/api.js';
import { formatDateTime, formatMinutes, toLocalInputValue } from '../lib/format.js';

const DURATIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240];
// Same list as the server (server/src/models/Offer.js).
const CATEGORIES = ['Programming', 'Languages', 'Music', 'Art', 'Productivity', 'Communication', 'Games', 'Other'];

function useRefreshOffers() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['my-offers'] });
    queryClient.invalidateQueries({ queryKey: ['offers'] });
    queryClient.invalidateQueries({ queryKey: ['offer'] });
  };
}

function NewOfferForm({ onDone }) {
  const refresh = useRefreshOffers();
  const [form, setForm] = useState({ title: '', description: '', outcome: '', category: 'Programming', skills: '', durationMinutes: 60 });
  const create = useMutation({
    mutationFn: (body) => api('/offers', { method: 'POST', body }),
    onSuccess: () => {
      refresh();
      onDone();
    },
  });
  const errors = fieldErrors(create.error);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <Card className="mb-10 p-7">
      <span className="label text-gold">New session</span>
      <h2 className="mt-1 font-display text-2xl text-ink">What will you teach?</h2>
      <form
        className="mt-6 grid gap-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({
            title: form.title,
            description: form.description,
            outcome: form.outcome,
            category: form.category,
            durationMinutes: Number(form.durationMinutes),
            skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
          });
        }}
      >
        <div className="sm:col-span-2">
          <Field label="Title" htmlFor="title" error={errors.title}>
            <Input id="title" value={form.title} onChange={set('title')} placeholder="e.g. Intro to Photography" required />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="You'll leave with" htmlFor="outcome" error={errors.outcome} hint="One line on what the learner walks away with, e.g. a photo they're proud of.">
            <Input id="outcome" value={form.outcome} onChange={set('outcome')} maxLength={160} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Description" htmlFor="description" error={errors.description}>
            <Textarea id="description" rows={3} value={form.description} onChange={set('description')} />
          </Field>
        </div>
        <Field label="Craft" htmlFor="category" error={errors.category}>
          <Select id="category" value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Skills" htmlFor="skills" error={errors.skills} hint="Comma separated, e.g. photography, art">
          <Input id="skills" value={form.skills} onChange={set('skills')} />
        </Field>
        <Field label="Length = price in credits" htmlFor="duration" error={errors.durationMinutes}>
          <Select id="duration" value={form.durationMinutes} onChange={set('durationMinutes')}>
            {DURATIONS.map((m) => (
              <option key={m} value={m}>
                {formatMinutes(m)}
              </option>
            ))}
          </Select>
        </Field>
        {create.error && !create.error.details.length && <ErrorNote error={create.error} className="sm:col-span-2" />}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" loading={create.isPending}>
            Publish session
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function OfferManager({ offer }) {
  const refresh = useRefreshOffers();
  const toast = useToast();
  const tomorrowEvening = new Date();
  tomorrowEvening.setDate(tomorrowEvening.getDate() + 1);
  tomorrowEvening.setHours(18, 0, 0, 0);
  const [when, setWhen] = useState(toLocalInputValue(tomorrowEvening));

  const onError = (err) => toast({ title: 'That did not work', description: err.message, tone: 'error' });
  const addSlot = useMutation({
    // datetime-local gives local time; toISOString converts it to UTC for the server.
    mutationFn: () => api(`/offers/${offer.id}/slots`, { method: 'POST', body: { startsAt: new Date(when).toISOString() } }),
    onSuccess: refresh,
    onError,
  });
  const removeSlot = useMutation({ mutationFn: (id) => api(`/slots/${id}`, { method: 'DELETE' }), onSuccess: refresh, onError });
  const toggle = useMutation({
    mutationFn: () => api(`/offers/${offer.id}`, { method: 'PATCH', body: { active: !offer.active } }),
    onSuccess: refresh,
    onError,
  });

  return (
    <Card className={offer.active ? 'overflow-hidden' : 'overflow-hidden opacity-75'}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-6">
        <div className="flex gap-5">
          <RisoArt offer={offer} className="hidden h-24 w-20 shrink-0 rounded-lg sm:block" glyphScale={0.9} />
          <div>
            <span className="label text-ox">{offer.category}</span>
            <div className="mt-1 flex items-center gap-2">
              <Link to={`/offers/${offer.id}`} className="font-display text-xl text-ink hover:text-ox">
                {offer.title}
              </Link>
              {!offer.active && <Badge>Paused</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted">{formatMinutes(offer.durationMinutes)} · earns {offer.durationMinutes} credits per session</p>
            {offer.outcome && <p className="mt-1 text-sm italic">You'll leave with: {offer.outcome}</p>}
            <div className="mt-2">
              <SkillTags skills={offer.skills} />
            </div>
          </div>
        </div>
        <Button variant="secondary" size="sm" loading={toggle.isPending} onClick={() => toggle.mutate()}>
          {offer.active ? 'Pause offer' : 'Activate'}
        </Button>
      </div>

      <div className="p-6">
        <p className="label text-muted">Upcoming times</p>
        {offer.slots.length === 0 ? (
          <p className="mt-1 text-sm text-muted">No times yet. Add one so learners can book you.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {offer.slots.map((slot) => (
              <li key={slot.id} className="flex items-center gap-2 rounded-lg border border-line py-1 pl-3 pr-1 text-sm">
                {formatDateTime(slot.startsAt)}
                <StatusBadge status={slot.status} />
                {slot.status === 'OPEN' && (
                  <button
                    onClick={() => removeSlot.mutate(slot.id)}
                    className="rounded px-1.5 text-muted hover:bg-champagne hover:text-rose-600"
                    aria-label="Remove this time"
                    title="Remove this time"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {offer.active && (
          <form
            className="mt-4 flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addSlot.mutate();
            }}
          >
            <Field label="Add a time" htmlFor={`when-${offer.id}`}>
              <Input id={`when-${offer.id}`} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
            </Field>
            <Button type="submit" variant="secondary" loading={addSlot.isPending}>
              Add time
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}

export default function Teach() {
  const [creating, setCreating] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ['my-offers'], queryFn: () => api('/offers/mine') });

  return (
    <div>
      <PageHeader
        eyebrow="Teach"
        title={<>Share what you <em className="italic">know</em></>}
        subtitle="Publish a session, add times, and earn a credit for every minute you teach."
        action={!creating && <Button onClick={() => setCreating(true)}>New session</Button>}
      />
      {creating && <NewOfferForm onDone={() => setCreating(false)} />}

      <ErrorNote error={error} />
      {isLoading ? (
        <Loading />
      ) : data?.offers.length === 0 ? (
        !creating && (
          <EmptyState title="You aren't teaching anything yet" action={<Button onClick={() => setCreating(true)}>Create your first session</Button>}>
            Everyone knows something worth sharing: a language, an instrument, a tool you use at work.
          </EmptyState>
        )
      ) : (
        <div className="space-y-4">
          {data?.offers.map((offer) => (
            <OfferManager key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </div>
  );
}
