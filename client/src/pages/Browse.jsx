import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Avatar, Button, Card, EmptyState, ErrorNote, Input, Loading, SkillTags } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api, queryString } from '../lib/api.js';
import { formatDateTime, formatMinutes } from '../lib/format.js';

function Hero() {
  return (
    <section className="mb-10 overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 px-6 py-12 text-white sm:px-10">
      <p className="text-sm font-medium uppercase tracking-wider text-teal-100">Peer learning, paid in time</p>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Teach an hour. Learn an hour.</h1>
      <p className="mt-4 max-w-xl text-teal-50">
        Share what you know and earn time credits. Spend them learning from others. Every minute is tracked in a tamper-proof ledger,
        so credits are never lost or paid twice.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button to="/signup" className="bg-white !text-teal-800 hover:bg-teal-50">
          Get 2 free hours
        </Button>
        <Button to="/login" variant="ghost" className="text-white hover:bg-white/10">
          Try a demo account
        </Button>
      </div>
      <div className="mt-10 grid max-w-2xl gap-4 text-sm sm:grid-cols-3">
        {[
          ['1. Book', 'Credits are held safely until the session happens.'],
          ['2. Meet', 'Learn together over a call or in person.'],
          ['3. Confirm', 'When you both confirm, the teacher gets paid.'],
        ].map(([title, text]) => (
          <div key={title} className="rounded-lg bg-white/10 p-4">
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-teal-50">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function OfferCard({ offer }) {
  return (
    <Link to={`/offers/${offer.id}`} className="group">
      <Card className="flex h-full flex-col p-5 transition-shadow group-hover:shadow-md">
        <SkillTags skills={offer.skills} />
        <h3 className="mt-3 font-semibold text-slate-900 group-hover:text-teal-700">{offer.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{offer.description}</p>
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
          <Avatar name={offer.teacher?.name} size="sm" />
          {offer.teacher?.name}
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
          <span className="font-medium text-slate-700">{formatMinutes(offer.durationMinutes)}</span>
          {offer.openSlots > 0 ? (
            <span className="text-teal-700">
              Next: {formatDateTime(offer.nextSlotAt)}
            </span>
          ) : (
            <span className="text-slate-400">No open times</span>
          )}
        </div>
      </Card>
    </Link>
  );
}

export default function Browse() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const skill = params.get('skill') ?? '';
  const [draft, setDraft] = useState(q);

  const offers = useQuery({ queryKey: ['offers', { q, skill }], queryFn: () => api(`/offers${queryString({ q, skill })}`) });
  // Unfiltered list, used to show the most common skills as quick filters.
  const all = useQuery({ queryKey: ['offers', {}], queryFn: () => api('/offers') });

  const counts = new Map();
  for (const offer of all.data?.offers ?? []) for (const s of offer.skills) counts.set(s, (counts.get(s) ?? 0) + 1);
  const popular = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([s]) => s);

  const update = (next) => setParams(Object.fromEntries(Object.entries({ q, skill, ...next }).filter(([, v]) => v)));

  return (
    <div>
      {!user && <Hero />}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{user ? `What do you want to learn, ${user.name.split(' ')[0]}?` : 'Browse sessions'}</h2>
          <p className="mt-1 text-slate-500">Book a time that suits you. You only pay when the session happens.</p>
        </div>
        <form
          className="flex w-full gap-2 sm:w-auto"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: draft.trim() });
          }}
        >
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search Python, guitar, Excel…" className="sm:w-72" aria-label="Search" />
          <Button type="submit">Search</Button>
        </form>
      </div>

      {popular.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {popular.map((s) => (
            <button
              key={s}
              onClick={() => update({ skill: skill === s ? '' : s })}
              className={`rounded-full px-3 py-1 text-sm ring-1 ring-inset transition-colors ${
                skill === s ? 'bg-teal-600 text-white ring-teal-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300'
              }`}
            >
              {s}
            </button>
          ))}
          {(q || skill) && (
            <button
              onClick={() => {
                setDraft('');
                setParams({});
              }}
              className="px-2 text-sm text-slate-500 underline hover:text-slate-700"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      <ErrorNote error={offers.error} />
      {offers.isLoading ? (
        <Loading label="Finding sessions…" />
      ) : offers.data?.offers.length === 0 ? (
        <EmptyState title="No sessions match your search" action={user && <Button to="/teach" variant="secondary">Offer to teach it yourself</Button>}>
          Try a different word, or clear the filters.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offers.data?.offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </div>
  );
}
