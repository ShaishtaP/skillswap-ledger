import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Button, Card, ErrorNote, Field, Input } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { fieldErrors } from '../lib/api.js';

// Accounts created by the demo data (server/src/seed/demoData.js).
const DEMO_PASSWORD = 'password123';
const DEMO_ACCOUNTS = [
  { email: 'aisha@skillswap.test', label: 'Aisha', note: 'learner with a session to confirm' },
  { email: 'rohan@skillswap.test', label: 'Rohan', note: 'has a dispute with a proposal' },
  { email: 'meera@skillswap.test', label: 'Meera', note: 'teaches Python & DSA' },
  { email: 'admin@skillswap.test', label: 'Admin', note: 'resolves disputes, checks the ledger' },
];

export function safeNext(params) {
  const next = params.get('next');
  return next?.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  if (user) return <Navigate to={safeNext(params)} replace />;

  async function submit(credentials) {
    setPending(true);
    setError(null);
    try {
      await login(credentials);
      navigate(safeNext(params), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  const errors = fieldErrors(error);

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-8 text-center">
        <span className="eyebrow">Welcome back</span>
        <h1 className="mt-1 font-display text-4xl text-ink">
          Log in to your <em className="text-ox">desk</em>
        </h1>
      </div>
      <Card className="p-7 sm:p-9">
        <p className="text-muted">Book sessions, confirm the ones you've had, and keep an eye on your minutes.</p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(form);
          }}
        >
          <Field label="Email" htmlFor="email" error={errors.email}>
            <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password}>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </Field>
          {error && !error.details?.length && <ErrorNote error={error} />}
          <Button type="submit" loading={pending} className="w-full">
            Log in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          New here?{' '}
          <Link to="/signup" className="font-semibold text-ox hover:underline">
            Create an account
          </Link>
        </p>
      </Card>

      <Card className="mt-5 p-6">
        <p className="label text-gold">Just looking around?</p>
        <p className="mt-1 font-display text-lg text-ink">Try a demo account</p>
        <div className="mt-4 grid gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              disabled={pending}
              onClick={() => submit({ email: account.email, password: DEMO_PASSWORD })}
              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-ivory px-4 py-2.5 text-left text-sm transition hover:border-gold-2 hover:bg-gold-soft/50 disabled:opacity-50"
            >
              <span className="font-display text-base text-ink">{account.label}</span>
              <span className="text-muted">{account.note}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
