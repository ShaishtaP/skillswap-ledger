import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { initials } from '../lib/format.js';

const cx = (...classes) => classes.filter(Boolean).join(' ');

const BUTTON = {
  primary: 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm',
  danger: 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
};
const SIZE = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm' };

export function Button({ variant = 'primary', size = 'md', loading, className, children, to, ...props }) {
  const classes = cx(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
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
    <div className={cx('rounded-xl border border-slate-200 bg-white shadow-sm', className)} {...props}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const TONES = {
  slate: 'bg-slate-100 text-slate-700',
  teal: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  sky: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  rose: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
};

export function Badge({ tone = 'slate', children, className }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-slate-500/10', TONES[tone], className)}>
      {children}
    </span>
  );
}

const STATUS = {
  BOOKED: ['sky', 'Booked'],
  COMPLETED: ['emerald', 'Completed'],
  CANCELLED: ['slate', 'Cancelled'],
  DISPUTED: ['amber', 'Disputed'],
  RESOLVED: ['violet', 'Resolved'],
  OPEN: ['teal', 'Open'],
  CLOSED: ['slate', 'Closed'],
};

export function StatusBadge({ status }) {
  const [tone, label] = STATUS[status] ?? ['slate', status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function RoleBadge({ role }) {
  return role === 'teacher' ? <Badge tone="violet">Teaching</Badge> : <Badge tone="teal">Learning</Badge>;
}

export function SkillTags({ skills = [] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <span key={skill} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {skill}
        </span>
      ))}
    </div>
  );
}

export function Avatar({ name, size = 'md' }) {
  const sizes = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-base' };
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full bg-teal-100 font-semibold text-teal-800', sizes[size])}>
      {initials(name)}
    </span>
  );
}

const inputClass =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50';

export function Field({ label, error, hint, children, htmlFor }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      {children}
      {error ? <p className="text-sm text-rose-600">{error}</p> : hint && <p className="text-sm text-slate-500">{hint}</p>}
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
    <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorNote({ error, className }) {
  if (!error) return null;
  return <div className={cx('rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700', className)}>{error.message ?? String(error)}</div>;
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
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
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      <div className="p-6">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <div className="mt-3 text-sm text-slate-600">{children}</div>
      </div>
      <div className="flex justify-end gap-3 rounded-b-xl bg-slate-50 px-6 py-4">{footer}</div>
    </dialog>
  );
}
