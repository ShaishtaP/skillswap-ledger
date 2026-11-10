import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import Hero from '../components/Hero.jsx';
import LandingSections from '../components/LandingSections.jsx';
import SessionCard from '../components/SessionCard.jsx';
import Ticker from '../components/Ticker.jsx';
import { Button, EmptyState, ErrorNote, Frame, Input, Loading, SectionHead, cx } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useReveal } from '../hooks/useReveal.js';
import { api, queryString } from '../lib/api.js';

// Logged-in members skip the marketing hero and get a short welcome instead.
function Welcome({ user, stats }) {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-16 sm:px-7">
      <span className="eyebrow">Welcome back</span>
      <h1 className="mt-1 font-display text-4xl leading-tight text-ink sm:text-[56px]">
        What will you learn, <em className="text-ox">{user.name.split(' ')[0]}?</em>
      </h1>
      {stats && (
        <p className="mt-3 text-muted">
          {stats.openSeats} open seats this week across {stats.crafts} crafts.
        </p>
      )}
    </div>
  );
}

export default function Browse() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const [draft, setDraft] = useState(q);

  const offers = useQuery({ queryKey: ['offers', { q, category }], queryFn: () => api(`/offers${queryString({ q, category })}`) });
  // Unfiltered list, used for the craft buttons and their counts.
  const all = useQuery({ queryKey: ['offers', {}], queryFn: () => api('/offers') });
  const stats = useQuery({ queryKey: ['community', 'stats'], queryFn: () => api('/community/stats') });
  useReveal([offers.data, all.data]);

  const counts = new Map();
  for (const offer of all.data?.offers ?? []) counts.set(offer.category, (counts.get(offer.category) ?? 0) + 1);
  const crafts = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  const update = (next) => setParams(Object.fromEntries(Object.entries({ q, category, ...next }).filter(([, v]) => v)), { preventScrollReset: true });
  const chip = (active) =>
    cx(
      'rounded-full border px-4 py-2 text-sm shadow-[0_2px_6px_-4px_rgba(80,60,20,.3)] transition',
      active ? 'border-ink bg-ink text-ivory' : 'border-line bg-card hover:border-gold-2 hover:text-ox',
    );
  const list = offers.data?.offers ?? [];

  return (
    <div>
      {user ? <Welcome user={user} stats={stats.data} /> : <Hero />}
      {!user && <Ticker />}

      <section id="sessions" className="mx-auto max-w-6xl scroll-mt-20 px-5 pt-16 sm:px-7 sm:pt-24">
        <Frame label="skillswap · sessions" className="reveal mx-auto max-w-[920px]">
          <div className="bg-gradient-to-b from-card to-[#f6eddc] px-5 py-10 text-center sm:px-10">
            <h3 className="font-display text-[26px] leading-snug text-ink sm:text-[34px]">
              <span className="gold-text">{stats.data?.openSeats ?? '…'} open seats</span> across {stats.data?.crafts ?? '…'} crafts, all paid in minutes
            </h3>
            <p className="mx-auto mt-2.5 mb-6 max-w-[520px]">Pick a craft, choose a time that suits you, and your minutes wait safely until the session happens.</p>
            <div className="mb-3.5 label text-gold">Browse by craft</div>
            <div className="flex flex-wrap justify-center gap-2.5">
              <button className={chip(!category)} onClick={() => update({ category: '' })}>
                Everything <small className="ml-1.5 font-mono text-[11px] opacity-70">{all.data?.offers.length ?? ''}</small>
              </button>
              {crafts.map(([name, count]) => (
                <button key={name} className={chip(category === name)} onClick={() => update({ category: category === name ? '' : name })}>
                  {name} <small className="ml-1.5 font-mono text-[11px] opacity-70">{count}</small>
                </button>
              ))}
            </div>
            <form
              className="mx-auto mt-6 flex max-w-md gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                update({ q: draft.trim() });
              }}
            >
              <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Or search: python, guitar, excel…" aria-label="Search sessions" />
              <Button type="submit" variant="secondary">
                Search
              </Button>
            </form>
          </div>
        </Frame>

        <div className="pt-20 sm:pt-24">
          <SectionHead
            className="reveal"
            eyebrow={category || (q ? `Results for “${q}”` : 'This week')}
            title={category || q ? <>Sessions to <em className="italic">book</em></> : <>Picked by <em className="italic">members</em></>}
            lead="Every session tells you what you'll walk away with, so you know exactly what your minutes buy."
          />
          <ErrorNote error={offers.error} />
          {offers.isLoading ? (
            <Loading label="Finding sessions…" />
          ) : list.length === 0 ? (
            <EmptyState
              title="Nothing matches yet"
              action={
                <div className="flex justify-center gap-3">
                  <Button variant="secondary" onClick={() => { setDraft(''); setParams({}); }}>
                    Clear filters
                  </Button>
                  {user && <Button to="/teach">Teach it yourself</Button>}
                </div>
              }
            >
              Try another craft or word.
            </EmptyState>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 lg:grid-cols-4 lg:gap-y-14">
              {list.map((offer, i) => (
                <div key={offer.id} className="reveal">
                  <SessionCard offer={offer} tilt={i % 2 === 1} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {!user && <LandingSections />}
      {user && <div className="pb-24" />}
    </div>
  );
}
