import { Link } from 'react-router';
import { formatMinutes, formatSlotShort } from '../lib/format.js';
import RisoArt from './RisoArt.jsx';
import { cx } from './ui.jsx';

// One session in the gallery grid: a riso print with a short caption.
// Hovering reveals what you'll walk away with (on touch screens it's always shown).
export default function SessionCard({ offer, tilt = false }) {
  return (
    <Link to={`/offers/${offer.id}`} className={cx('group tape block', tilt && 'tilt')}>
      <div className="print group-hover:-translate-y-1 group-hover:shadow-lift">
        <RisoArt offer={offer} className="aspect-[3/4] group-hover:scale-[1.04]" />
        {offer.memberPick ? (
          <span className="absolute top-3.5 left-3.5 z-[2] rounded-full border border-gold-2 bg-card px-3 py-1 label !text-[10px] text-gold">Member pick</span>
        ) : offer.isNew ? (
          <span className="absolute top-3.5 left-3.5 z-[2] rounded-full bg-ox px-3 py-1 label !text-[10px] text-ivory">New</span>
        ) : null}
        {offer.outcome && (
          <div className="outcome">
            <b className="label mb-0.5 block !text-[10px] font-medium text-gold">You'll leave with</b>
            {offer.outcome}
          </div>
        )}
      </div>
      <div className="mt-4">
        <span className="label text-ox">
          {offer.skills?.[0] ?? offer.category} · {offer.nextSlotAt ? formatSlotShort(offer.nextSlotAt) : 'no open times'}
        </span>
        <h3 className="mt-1.5 mb-1.5 font-display text-[21px] leading-tight text-ink transition-colors group-hover:text-ox">{offer.title}</h3>
        <p className="text-sm text-muted">
          <b className="font-medium text-body">{offer.teacher?.name}</b> · {formatMinutes(offer.durationMinutes)}
          {offer.taughtCount > 0 && ` · taught ${offer.taughtCount}×`}
        </p>
      </div>
    </Link>
  );
}
