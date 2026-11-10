import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Button, Card, ErrorNote, Field, Input } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { fieldErrors } from '../lib/api.js';
import { safeNext } from './Login.jsx';

export default function Signup() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  if (user) return <Navigate to={safeNext(params)} replace />;

  async function submit(e) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await signup(form);
      navigate(safeNext(params), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  const errors = fieldErrors(error);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-8 text-center">
        <span className="eyebrow">Join SkillSwap</span>
        <h1 className="mt-1 font-display text-4xl text-ink">
          Your first <span className="gold-text">two hours</span> are on us
        </h1>
      </div>
      <Card className="p-7 sm:p-9">
        <p className="text-muted">No card needed. Spend your 120 free minutes on any session, and teach to earn more.</p>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <Field label="Your name" htmlFor="name" error={errors.name}>
            <Input id="name" autoComplete="name" value={form.name} onChange={set('name')} required />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email}>
            <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password} hint="At least 8 characters">
            <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} required />
          </Field>
          {error && !error.details?.length && <ErrorNote error={error} />}
          <Button type="submit" loading={pending} className="w-full">
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-ox hover:underline">
            Log in
          </Link>
        </p>
      </Card>
    </div>
  );
}
