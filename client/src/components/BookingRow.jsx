import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
import { myRole, otherPerson } from '../lib/bookings.js';
import { formatDateTime, formatMinutes, relativeTime } from '../lib/format.js';
import { Avatar, RoleBadge, StatusBadge } from './ui.jsx';

// One booking in a list. `actions` are extra buttons shown on the right.
export default function BookingRow({ booking, actions, showStatus = true }) {
  const { user } = useAuth();
  const role = myRole(booking, user);
  const other = otherPerson(booking, role);

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <Link to={`/bookings/${booking.id}`} className="flex min-w-0 items-start gap-3 hover:opacity-80">
        <Avatar name={other?.name} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-slate-900">{booking.offerTitle}</p>
            <RoleBadge role={role} />
            {showStatus && <StatusBadge status={booking.status} />}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {role === 'teacher' ? 'Teaching' : 'With'} {other?.name} · {formatDateTime(booking.startsAt)} ({relativeTime(booking.startsAt)}) ·{' '}
            {formatMinutes(booking.credits)}
          </p>
        </div>
      </Link>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
