import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/index.js';
import { checkInvariants } from '../src/services/ledger.js';

const app = createApp();
const alice = { name: 'Alice', email: 'alice@example.com', password: 'password123' };

describe('POST /api/auth/signup', () => {
  it('creates a user, returns a token and grants 120 minutes', async () => {
    const res = await request(app).post('/api/auth/signup').send(alice).expect(201);

    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({ name: 'Alice', email: 'alice@example.com', role: 'user' });
    expect(res.body.user.passwordHash).toBeUndefined();

    const wallet = await request(app).get('/api/wallet').set('Authorization', `Bearer ${res.body.token}`).expect(200);
    expect(wallet.body.balance).toBe(120);
    expect(wallet.body.entries).toHaveLength(1);
    expect(wallet.body.entries[0]).toMatchObject({ type: 'SIGNUP_GRANT', amount: 120 });
  });

  it('stores a hashed password, never the plain one', async () => {
    await request(app).post('/api/auth/signup').send(alice).expect(201);
    const user = await User.findOne({ email: alice.email }).select('+passwordHash');
    expect(user.passwordHash).not.toBe(alice.password);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('rejects a duplicate email, even with different capitals', async () => {
    await request(app).post('/api/auth/signup').send(alice).expect(201);
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...alice, email: 'ALICE@example.com' })
      .expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('gives only one account and one grant when the same signup is sent twice at once', async () => {
    const results = await Promise.all([1, 2].map(() => request(app).post('/api/auth/signup').send(alice)));

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await User.countDocuments()).toBe(1);
    expect((await checkInvariants()).ok).toBe(true);
  });

  it('lists every invalid field', async () => {
    const res = await request(app).post('/api/auth/signup').send({ name: 'A', email: 'nope', password: '123' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(['email', 'name', 'password']);
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token for the right password', async () => {
    await request(app).post('/api/auth/signup').send(alice);
    const res = await request(app).post('/api/auth/login').send({ email: alice.email, password: alice.password }).expect(200);
    expect(res.body.token).toBeTypeOf('string');
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await request(app).post('/api/auth/signup').send(alice);
    const wrongPassword = await request(app).post('/api/auth/login').send({ email: alice.email, password: 'wrong-pass' }).expect(401);
    const unknownEmail = await request(app).post('/api/auth/login').send({ email: 'bob@example.com', password: 'whatever1' }).expect(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });
});

describe('protected routes', () => {
  it('reject requests without a token', async () => {
    const res = await request(app).get('/api/wallet').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('reject a forged token', async () => {
    await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token').expect(401);
  });

  it('GET /api/auth/me returns the logged-in user', async () => {
    const { body } = await request(app).post('/api/auth/signup').send(alice);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`).expect(200);
    expect(res.body.user.email).toBe(alice.email);
  });
});
