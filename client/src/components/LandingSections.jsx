import { Button, Frame, SectionHead } from './ui.jsx';

// The explanatory sections of the public homepage: how it works, features,
// comparison, FAQ and the closing call to action.

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 pt-28 sm:px-7">
      <SectionHead
        className="reveal"
        eyebrow="Simple process"
        title={<>How the <em className="italic">minutes</em> move</>}
        lead="Book a seat and the ledger records it instantly. Both sides of every movement are written down, so the books always balance."
      />
      <div className="reveal grid items-center gap-6 md:grid-cols-[1fr_70px_1fr]">
        <div>
          <h4 className="mb-3.5 text-center label text-gold">You book</h4>
          <Frame label="book a seat">
            <div className="grid gap-2.5 p-4">
              {[
                ['Session', 'Guitar Chords in One Sitting'],
                ['Teacher', 'Daniel Brooks'],
                ['When', 'Sun 9 Nov · 13:00'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-line bg-ivory px-3 py-2">
                  <small className="label block !text-[10px] text-muted">{k}</small>
                  <span className="text-[15px] text-ink">{v}</span>
                </div>
              ))}
              <div className="rounded-lg border border-gold-2 bg-[#fbf3e0] px-3 py-2">
                <small className="label block !text-[10px] text-muted">Cost</small>
                <span className="text-[15px] text-ink">60 minutes · held until you both confirm</span>
              </div>
            </div>
          </Frame>
        </div>
        <div className="mx-auto grid h-12 w-12 rotate-90 place-items-center rounded-full border border-gold-2 bg-gold-soft text-xl text-gold md:rotate-0">→</div>
        <div>
          <h4 className="mb-3.5 text-center label text-gold">The ledger writes</h4>
          <Frame label="ledger · entry #19">
            <div className="p-5 font-mono text-[13px]">
              <div className="flex justify-between border-b border-dashed border-line py-2.5"><span>user:aisha</span><span className="text-ox">−60</span></div>
              <div className="flex justify-between border-b border-dashed border-line py-2.5"><span>escrow:booking-19</span><span className="text-ok">+60</span></div>
              <div className="mt-1.5 flex justify-between border-t-[3px] border-double border-ink pt-2.5 text-ink"><span>total</span><span>0</span></div>
              <p className="mt-3.5 font-serif text-sm text-muted">After you both confirm, escrow pays Daniel 60. Once, even if someone clicks twice.</p>
            </div>
          </Frame>
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  ['Escrow on every booking', 'Your minutes are set aside for that one session, not spent until it happens.', <><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>],
  ['Paid when both confirm', 'Teacher and learner each say it happened. Then, and only then, the minutes move.', <path d="M4 12l5 5L20 6" />],
  ['Fair cancellation', 'More than a day ahead: everything back. Last minute: half to the teacher.', <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>],
  ['Disputes, settled calmly', 'Propose a split, accept one, or let an admin decide. Minutes stay frozen meanwhile.', <path d="M12 4v16M5 8h14M7 8l-3 6h6zM17 8l-3 6h6z" />],
  ['Live updates', 'When the other person books, cancels or confirms, your page changes on its own.', <><path d="M4 12a8 8 0 0 1 14-5M20 12a8 8 0 0 1-14 5" /><path d="M18 3v4h-4M6 21v-4h4" /></>],
  ['A record that can’t be edited', 'Every minute in and out is kept forever, so your history is always searchable.', <><path d="M5 4h11l3 3v13H5z" /><path d="M8 10h8M8 14h8M8 18h5" /></>],
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 pt-28 sm:px-7">
      <SectionHead className="reveal" eyebrow="Everything you need" title={<>Built to be <em className="italic">fair</em></>} lead="The rules are simple, and the software makes sure nobody can bend them." />
      <div className="reveal mx-auto grid max-w-[900px] overflow-hidden rounded-2xl border border-line bg-card shadow-soft md:grid-cols-2">
        {FEATURES.map(([title, text, icon]) => (
          <div key={title} className="feature flex gap-4.5 p-7">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[#ead7aa] bg-gold-soft text-gold">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[22px] w-[22px]">{icon}</svg>
            </span>
            <div>
              <h5 className="font-display text-[19px] text-ink">{title}</h5>
              <p className="mt-1 text-[15px] leading-normal">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const COMPARE = [
  ['Cost per hour', '₹500 – ₹2,000', '60 minutes you earned'],
  ['You can teach and earn too', false, true],
  ['Held safely until it happens', false, true],
  ['Refund if you cancel a day ahead', 'Sometimes', '✓ always'],
  ['Help if it goes wrong', 'Rarely', '✓ disputes'],
  ['Every minute on record', false, true],
];
const cell = (v) => (v === true ? <span className="text-ok">✓</span> : v === false ? <span className="text-[#c66]">✕</span> : v);

function Compare() {
  return (
    <section className="mx-auto max-w-6xl px-5 pt-28 sm:px-7">
      <SectionHead className="reveal" eyebrow="Why swap?" title={<>Paid tutoring <em className="italic">vs</em> SkillSwap</>} />
      <div className="reveal mx-auto max-w-[820px] overflow-hidden rounded-2xl border border-line bg-card shadow-soft">
        <table className="w-full border-collapse text-[15px] max-sm:text-[13px]">
          <thead>
            <tr className="font-display text-base text-ink">
              <th className="border-r border-b border-line px-5 py-3.5 text-left font-semibold max-sm:px-3">What you get</th>
              <th className="border-b border-line px-5 py-3.5 font-semibold max-sm:px-3">Paid tutoring</th>
              <th className="border-b border-line bg-[#f6ecd8] px-5 py-3.5 font-semibold text-ox max-sm:px-3">SkillSwap</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE.map(([what, them, us]) => (
              <tr key={what} className="border-b border-line last:border-0">
                <td className="border-r border-line px-5 py-3.5 max-sm:px-3">{what}</td>
                <td className="px-5 py-3.5 text-center max-sm:px-3">{cell(them)}</td>
                <td className="bg-[#f6ecd8] px-5 py-3.5 text-center font-semibold text-gold max-sm:px-3">{cell(us)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const FAQ = [
  ["What's a credit worth?", "One minute of someone's time. A 60-minute session costs 60 credits, whether it's Python or watercolour."],
  ['What if I need to cancel?', 'More than 24 hours before: everything back. Later than that: half back, half to the teacher for keeping the slot.'],
  ['What if the session went badly?', 'Open a dispute. The minutes stay frozen while you two agree on a split, or an admin decides.'],
  ['Is any of this real money?', "No. Credits are fictional and can't be bought or cashed out. They only measure time."],
];

function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-6xl scroll-mt-20 px-5 pt-28 sm:px-7">
      <SectionHead className="reveal" eyebrow="Fair questions" title={<>Before you <em className="italic">start</em></>} />
      <div className="reveal mx-auto max-w-[760px] space-y-3">
        {FAQ.map(([q, a], i) => (
          <details key={q} open={i === 0} className="group rounded-xl border border-line bg-card px-6 py-4.5">
            <summary className="flex cursor-pointer list-none justify-between gap-3 font-display text-lg text-ink [&::-webkit-details-marker]:hidden">
              {q}
              <span className="font-mono text-gold group-open:hidden">+</span>
              <span className="hidden font-mono text-gold group-open:inline">–</span>
            </summary>
            <p className="mt-2.5 leading-relaxed">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="relative mt-28 overflow-hidden border-t border-line bg-champagne px-5 py-20 text-center">
      <span className="blob -top-20 -left-28 h-80 w-80 bg-ox opacity-[.16]" aria-hidden="true" />
      <span className="blob -right-16 -bottom-28 h-64 w-64 bg-gold opacity-[.28]" aria-hidden="true" />
      <div className="reveal relative">
        <h2 className="font-display text-4xl leading-tight text-ink sm:text-[52px]">
          Your first <span className="gold-text">two hours</span>
          <br />
          are on us.
        </h2>
        <p className="mx-auto mt-3.5 mb-7 max-w-xl text-lg">Sign up, book something you've always wanted to try, and teach something back when you're ready.</p>
        <Button to="/signup" size="lg">
          Create your account →
        </Button>
      </div>
    </section>
  );
}

export default function LandingSections() {
  return (
    <>
      <HowItWorks />
      <Features />
      <Compare />
      <Faq />
      <Closing />
    </>
  );
}
