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
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500">Log in to book sessions and manage your credits.</p>

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

        <p className="mt-6 text-center text-sm text-slate-500">
          New here?{' '}
          <Link to="/signup" className="font-medium text-teal-700 hover:underline">
            Create an account
          </Link>
        </p>
      </Card>

      <Card className="mt-4 p-5">
        <p className="text-sm font-medium text-slate-800">Just looking around? Try a demo account</p>
        <div className="mt-3 grid gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              disabled={pending}
              onClick={() => submit({ email: account.email, password: DEMO_PASSWORD })}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-teal-300 hover:bg-teal-50/50 disabled:opacity-50"
            >
              <span className="font-medium text-slate-700">{account.label}</span>
              <span className="text-slate-500">{account.note}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
