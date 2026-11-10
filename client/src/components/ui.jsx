import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { initials } from '../lib/format.js';

export const cx = (...classes) => classes.filter(Boolean).join(' ');

const BUTTON = {
  primary: 'bg-gold text-white shadow-[0_10px_24px_-12px_rgba(184,137,45,.8)] hover:bg-gold-dark hover:-translate-y-px',
  secondary: 'bg-card text-ink border border-line hover:border-gold-2',
  dark: 'bg-ink text-ivory hover:bg-ox',
  danger: 'bg-card text-ox border border-ox/25 hover:bg-ox/5',
  ghost: 'text-body hover:bg-champagne/70',
};
const SIZE = { sm: 'px-3.5 py-2 text-sm', md: 'px-5 py-3 text-[15px]', lg: 'px-7 py-4 text-base' };

export function Button({ variant = 'primary', size = 'md', loading, className, children, to, ...props }) {
  const classes = cx(
    'inline-flex items-center justify-center gap-2 rounded-md font-semibold tracking-[.01em] transition disabled:pointer-events-none disabled:opacity-50',
    BUTTON[variant],
    SIZE[size],
    className,
  );
  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} {...props} disabled={loading || props.disabled}>
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cx('rounded-2xl border border-line bg-card shadow-soft', className)} {...props}>
      {children}
    </div>
  );
}

// Browser-window style panel with three "traffic light" dots.
export function Frame({ label, className, children }) {
  return (
    <div className={cx('overflow-hidden rounded-2xl border border-line bg-card shadow-soft', className)}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="lights" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        {label && <span className="label text-muted">{label}</span>}
      </div>
      {children}
    </div>
  );
}

// eyebrow · title · gold rule · lead, the heading pattern used on every page
export function SectionHead({ eyebrow, title, lead, className, align = 'center' }) {
  return (
    <div className={cx(align === 'center' ? 'mx-auto max-w-2xl text-center' : '', 'mb-10', className)}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 className="mt-1.5 font-display text-4xl leading-tight text-ink sm:text-[44px] [&_em]:text-ox">{title}</h2>
      <div className={cx('gold-rule', align !== 'center' && 'ml-0')} />
      {lead && <p className="text-[17px] leading-relaxed">{lead}</p>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="mt-1 font-display text-4xl leading-tight text-ink sm:text-5xl [&_em]:text-ox">{title}</h1>
        {subtitle && <p className="mt-2 text-[17px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const TONES = {
  slate: 'bg-champagne text-body',
  gold: 'bg-gold-soft text-gold-dark border border-gold-2',
  ox: 'bg-ox text-ivory',
  sky: 'bg-[#e6eef3] text-[#2c5872]',
  emerald: 'bg-[#e4efe4] text-ok',
  amber: 'bg-[#f6e7c8] text-[#8a5a12]',
  rose: 'bg-[#f6e0dc] text-ox',
  violet: 'bg-[#ebe4f0] text-[#5b3f73]',
  ink: 'bg-ink text-ivory',
};

export function Badge({ tone = 'slate', children, className }) {
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 label !text-[10px]', TONES[tone], className)}>{children}</span>;
}

const STATUS = {
  BOOKED: ['sky', 'Booked'],
  COMPLETED: ['emerald', 'Completed'],
  CANCELLED: ['slate', 'Cancelled'],
  DISPUTED: ['amber', 'Disputed'],
  RESOLVED: ['violet', 'Resolved'],
  OPEN: ['gold', 'Open'],
  CLOSED: ['slate', 'Closed'],
};

export function StatusBadge({ status }) {
  const [tone, label] = STATUS[status] ?? ['slate', status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function RoleBadge({ role }) {
  return role === 'teacher' ? <Badge tone="ink">Teaching</Badge> : <Badge tone="gold">Learning</Badge>;
}

export function SkillTags({ skills = [] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <span key={skill} className="rounded-full border border-line bg-ivory px-2.5 py-0.5 font-mono text-[11px] text-muted">
          {skill}
        </span>
      ))}
    </div>
  );
}

export function Avatar({ name, size = 'md' }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' };
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full border border-gold-2 bg-gold-soft font-display font-bold text-ox', sizes[size])}>
      {initials(name)}
    </span>
  );
}

const inputClass =
  'block w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted/70 transition focus:border-gold-2 focus:outline-none focus:ring-4 focus:ring-gold-soft disabled:opacity-60';

export function Field({ label, error, hint, children, htmlFor }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={htmlFor} className="label block text-muted">
          {label}
        </label>
      )}
      {children}
      {error ? <p className="text-sm text-ox">{error}</p> : hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}

export const Input = ({ className, ...props }) => <input className={cx(inputClass, className)} {...props} />;
export const Textarea = ({ className, ...props }) => <textarea className={cx(inputClass, className)} {...props} />;
export const Select = ({ className, children, ...props }) => (
  <select className={cx(inputClass, 'pr-8', className)} {...props}>
    {children}
  </select>
);

export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={cx('animate-spin text-current', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-24 text-muted">
      <Spinner className="h-5 w-5 text-gold" /> {label}
    </div>
  );
}

export function ErrorNote({ error, className }) {
  if (!error) return null;
  return <div className={cx('rounded-xl border border-ox/20 bg-[#f6e0dc]/60 px-4 py-3 text-sm text-ox', className)}>{error.message ?? String(error)}</div>;
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-gold-2/70 bg-card/60 px-6 py-14 text-center">
      <p className="font-display text-xl text-ink">{title}</p>
      {children && <p className="mx-auto mt-2 max-w-md text-muted">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// A simple modal used for "are you sure?" questions.
export function Dialog({ open, title, children, onClose, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-card p-0 shadow-lift backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
    >
      <div className="p-7">
        <h2 className="font-display text-2xl text-ink">{title}</h2>
        <div className="mt-3 text-[15px] leading-relaxed text-body">{children}</div>
      </div>
      <div className="flex justify-end gap-3 rounded-b-2xl border-t border-line bg-ivory px-7 py-4">{footer}</div>
    </dialog>
  );
}
