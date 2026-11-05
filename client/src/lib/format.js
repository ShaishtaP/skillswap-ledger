// 90 → "1h 30m", 45 → "45 min", -60 → "-1h"
export function formatMinutes(minutes) {
  const sign = minutes < 0 ? '−' : '';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m} min`;
  return `${sign}${h}h${m ? ` ${m}m` : ''}`;
}

const dateTime = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

export const formatDateTime = (d) => dateTime.format(new Date(d));
export const formatDay = (d) => dayLabel.format(new Date(d));
export const formatDate = (d) => shortDate.format(new Date(d));
export const formatTime = (d) => time.format(new Date(d));

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
export function relativeTime(d, now = Date.now()) {
  const diff = new Date(d).getTime() - now;
  const abs = Math.abs(diff);
  if (abs < 60 * 60 * 1000) return relative.format(Math.round(diff / 60_000), 'minute');
  if (abs < 24 * 60 * 60 * 1000) return relative.format(Math.round(diff / 3_600_000), 'hour');
  return relative.format(Math.round(diff / 86_400_000), 'day');
}

// Value for <input type="datetime-local">, which wants local "YYYY-MM-DDTHH:mm".
export function toLocalInputValue(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const initials = (name = '') =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
