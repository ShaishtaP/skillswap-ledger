import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Avatar, Button, Card, Field, Input, PageHeader, Textarea } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api, fieldErrors } from '../lib/api.js';

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, bio: user.bio ?? '', skills: (user.skills ?? []).join(', ') });

  const save = useMutation({
    mutationFn: (body) => api('/auth/me', { method: 'PATCH', body }),
    onSuccess: (data) => {
      setUser(data.user);
      toast({ title: 'Profile saved', tone: 'success' });
    },
  });
  const errors = fieldErrors(save.error);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Profile" title={<>How learners <em className="italic">see you</em></>} subtitle="Your name, bio and skills appear on every session you teach." />
      <Card className="p-6">
        <div className="mb-6 flex items-center gap-4">
          <Avatar name={form.name} size="lg" />
          <div>
            <p className="font-semibold text-ink">{user.name}</p>
            <p className="text-sm text-muted">
              {user.email}
              {user.role === 'admin' && ' · admin'}
            </p>
          </div>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ name: form.name, bio: form.bio, skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean) });
          }}
        >
          <Field label="Name" htmlFor="name" error={errors.name}>
            <Input id="name" value={form.name} onChange={set('name')} required />
          </Field>
          <Field label="About you" htmlFor="bio" error={errors.bio}>
            <Textarea id="bio" rows={3} value={form.bio} onChange={set('bio')} placeholder="What do you love teaching or learning?" />
          </Field>
          <Field label="Skills" htmlFor="skills" error={errors.skills} hint="Comma separated">
            <Input id="skills" value={form.skills} onChange={set('skills')} />
          </Field>
          <Button type="submit" loading={save.isPending}>
            Save changes
          </Button>
        </form>
      </Card>
    </div>
  );
}
