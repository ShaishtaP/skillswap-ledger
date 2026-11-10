import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { Button } from './ui.jsx';

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Counts up from 0 once, after the headline has landed.
function CountUp({ value, delay = 1200 }) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));
  useEffect(() => {
    if (value == null || prefersReducedMotion()) return setShown(value);
    let frame;
    const timer = setTimeout(() => {
      const start = performance.now();
      const step = (t) => {
        const p = Math.min((t - start) / 900, 1);
        setShown(Math.round(value * (1 - (1 - p) ** 3)));
        if (p < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [value, delay]);
  return <b className="font-semibold tabular-nums text-ink">{shown ?? '–'}</b>;
}

export default function Hero() {
  const ref = useRef(null);
  const { data: stats } = useQuery({ queryKey: ['community', 'stats'], queryFn: () => api('/community/stats') });

  // The ink shapes follow the mouse a little, which gives a sense of depth.
  useEffect(() => {
    const hero = ref.current;
    if (!hero || prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) return undefined;
    let frame = 0;
    const move = (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = hero.getBoundingClientRect();
        hero.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5) * 2);
        hero.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5) * 2);
      });
    };
    const leave = () => {
      hero.style.setProperty('--mx', 0);
      hero.style.setProperty('--my', 0);
    };
    hero.addEventListener('mousemove', move);
    hero.addEventListener('mouseleave', leave);
    return () => {
      hero.removeEventListener('mousemove', move);
      hero.removeEventListener('mouseleave', leave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={ref} className="hero relative overflow-hidden px-5 pt-20 pb-20 text-center sm:pt-[104px]">
      <div className="absolute inset-0" aria-hidden="true">
        <span className="ink a halftone"><i /></span>
        <span className="ink b halftone"><i /></span>
        <span className="ink c halftone"><i /></span>
        <span className="ink d"><i /></span>
      </div>
      <div className="hero-glow" aria-hidden="true" />

      <div className="receipt left" aria-hidden="true">
        <div className="mb-2 flex justify-between text-[10px] tracking-[.14em] text-muted uppercase"><span>Ledger</span><span>#19</span></div>
        <div className="flex justify-between py-1"><span>Aisha</span><span className="text-ox">−60</span></div>
        <div className="flex justify-between py-1"><span>Held for session</span><span className="text-ok">+60</span></div>
        <div className="mt-1 flex justify-between border-t-[3px] border-double border-ink pt-1.5 text-ink"><span>Total</span><span>0</span></div>
      </div>
      <div className="receipt right" aria-hidden="true">
        <div className="mb-2 flex justify-between text-[10px] tracking-[.14em] text-muted uppercase"><span className="ok text-ok">Settled</span><span>just now</span></div>
        <div className="mb-1.5 font-display text-[15px] text-ink">Guitar Chords in One Sitting</div>
        <div className="flex justify-between py-1"><span>Daniel</span><span className="text-ok">+60 min</span></div>
      </div>

      <div className="relative z-[3] mx-auto max-w-3xl">
        <span className="badge-in inline-flex items-center gap-2 rounded-full border border-gold-2 bg-gold-soft/60 px-4 py-1.5 label text-gold">
          <span className="spark">✦</span> Peer learning, paid in time
        </span>
        <h1 className="mt-6 font-display text-[46px] leading-[1.04] font-extrabold tracking-[-.01em] text-ink sm:text-[78px]">
          <span className="ln"><span>Learn something</span></span>
          <span className="ln"><span className="sheen">from a stranger</span></span>
          <span className="ln">
            <span className="font-semibold text-ox italic">
              this{' '}
              <span className="uw">
                week.
                <svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M2 14 C 40 4, 80 18, 120 9 S 180 6, 198 11" />
                </svg>
              </span>
            </span>
          </span>
        </h1>
        <p className="fade-1 mx-auto mt-6 max-w-[560px] text-[19px] leading-relaxed text-[#3f3b35]">
          Teach what you're good at and earn minutes. Spend them on someone else's skill. No money changes hands, and every minute is written into a ledger nobody can quietly edit.
        </p>
        <div className="fade-2 mt-8 flex flex-wrap justify-center gap-3.5">
          <Button to="/signup" size="lg" className="group">
            Start with 2 free hours <span className="transition-transform group-hover:translate-x-1">→</span>
          </Button>
          <Button variant="secondary" size="lg" onClick={() => document.getElementById('sessions')?.scrollIntoView({ behavior: 'smooth' })}>
            Browse sessions
          </Button>
        </div>
        <p className="fade-3 mt-5 text-[13px] text-muted">
          <CountUp value={stats?.members} /> members · <CountUp value={stats?.openSeats} /> open seats this week ·{' '}
          <b className="font-semibold text-ink">{stats?.unaccountedMinutes ?? 0}</b> minutes unaccounted for
        </p>
        <div className="scroll-cue" aria-hidden="true" />
      </div>
    </section>
  );
}
