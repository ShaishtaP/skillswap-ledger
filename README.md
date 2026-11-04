# SkillSwap Ledger

A time-credit marketplace for peer learning. Teach what you know to earn time credits, then spend them to learn from others. Every credit movement is recorded in an **append-only, double-entry ledger** with **idempotent settlement**, so credits are never created, lost or awarded twice, even when requests are retried or arrive at the same moment.

> 🚧 In progress: 7-day build. See [docs/DAILY_LOG.md](docs/DAILY_LOG.md) for progress.

## Features

- [x] Sign up / log in (JWT), 120 free minutes on signup
- [x] Wallet with balance and full statement
- [x] Ledger invariant checker
- [ ] Publish teaching offers with time slots
- [ ] Book sessions (credits held in escrow)
- [ ] Two-party attendance confirmation → credits released to teacher
- [ ] Cancellations with a 24-hour refund policy
- [ ] Disputes resolved by mutual agreement or admin
- [ ] Searchable learning history
- [ ] Live booking updates (Socket.IO)
- [ ] React frontend
- [ ] Deployed demo

## How the ledger works

Credits are counted in **whole minutes**. Each movement is a transaction made of two or more entries that **sum to zero**:

```
Alice signs up            mint        −120
                          user:alice  +120    → total 0 ✓

Alice books a 60-min session
                          user:alice  −60
                          escrow:b1   +60     → total 0 ✓

Both confirm attendance   escrow:b1   −60
                          user:bob    +60     → total 0 ✓
```

| Guarantee | How |
|---|---|
| Nothing created from thin air | Every transaction must sum to 0, so the whole ledger always sums to 0 |
| History can't be rewritten | Entries are insert-only; updates and deletes are blocked at the model layer |
| No double awards on retry | Each transaction has a unique key (e.g. `settle:<bookingId>`) backed by a unique index |
| No overdraft under concurrency | Balance check and subtraction happen in one atomic conditional update inside a MongoDB transaction |
| Everything or nothing | Ledger entries and related changes commit in one transaction |

`checkInvariants()` verifies all of this at any time: total = 0, every stored balance equals the sum of its entries, and no user is negative.

Full design: [docs/SPEC.md](docs/SPEC.md)

## Tech stack

**Backend:** Node.js, Express 5, MongoDB + Mongoose 9, Zod, JWT, bcrypt
**Frontend:** React (Vite), Tailwind CSS, TanStack Query *(Day 5)*
**Realtime:** Socket.IO *(Day 6)*
**Testing:** Vitest, Supertest, mongodb-memory-server

## Project structure

```
server/
  src/
    config/       environment settings
    models/       User, LedgerEntry, Account
    services/     ledger.js (all credit movements), auth.js
    routes/       HTTP endpoints
    middleware/   auth, validation, error handling
  tests/          API and ledger tests, incl. concurrency
docs/
  SPEC.md         full specification
  DAILY_LOG.md    what was built each day
```

## Running locally

Requirements: Node.js 22+ and a MongoDB Atlas cluster (the free tier works; transactions need a replica set, which Atlas provides).

```bash
cd server
npm install
cp .env.example .env     # then fill in MONGO_URI and JWT_SECRET
npm run dev              # API on http://localhost:4000
```

### Tests

```bash
cd server
npm test
```

Tests run against a temporary in-memory MongoDB replica set, so no database setup is needed.

## API

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | – | Health check |
| POST | `/api/auth/signup` | – | Create account `{ name, email, password }` |
| POST | `/api/auth/login` | – | Log in `{ email, password }` → `{ user, token }` |
| GET | `/api/auth/me` | ✓ | Current user |
| GET | `/api/wallet` | ✓ | Balance and recent ledger entries |

Errors always look like `{ "error": { "code": "EMAIL_TAKEN", "message": "...", "details": [...] } }`.

## License

MIT
