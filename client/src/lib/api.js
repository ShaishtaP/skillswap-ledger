// One place for every request to the backend. It adds the login token,
// sends/reads JSON, and turns error responses into ApiError objects.
const TOKEN_KEY = 'skillswap.token';

export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Storage can be blocked (e.g. private mode). The app still works until refresh.
    }
  },
};

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details ?? [];
  }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export async function api(path, { method = 'GET', body } = {}) {
  const token = tokenStore.get();
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    // An expired or invalid token: log out so the user can sign in again.
    if (res.status === 401 && token) onUnauthorized();
    const error = data?.error;
    throw new ApiError(error?.message ?? `Request failed (${res.status})`, res.status, error?.code, error?.details);
  }
  return data;
}

// { email: 'Enter a valid email', ... } for showing errors under each field.
export function fieldErrors(error) {
  return Object.fromEntries((error?.details ?? []).map((d) => [d.field, d.message]));
}

export function queryString(params) {
  const clean = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return clean.length ? `?${new URLSearchParams(clean)}` : '';
}
