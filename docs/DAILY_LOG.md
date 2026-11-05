# Daily Log

## Day 1: Foundation, auth and the ledger

**Goal:** a working API where users can sign up and log in, backed by a tested credit ledger.

### Built
- Project structure: `server/` (Express API) and `docs/`.
- **Models:** `User`, `LedgerEntry` (append-only), `Account` (cached balance per account).
- **Ledger service** (`server/src/services/ledger.js`)
  - `postTransaction()` moves credits between accounts. It enforces double-entry (legs sum to 0), integer amounts, idempotency keys and no overdraft, all inside a MongoDB transaction.
  - `checkInvariants()` verifies the ledger total is 0 and every stored balance matches its entries.
- **Auth:** signup (creates the user and their 120-minute welcome grant in one transaction), login with JWT, `GET /me`. Passwords hashed with bcrypt.
- **Wallet:** `GET /api/wallet` returns balance and recent entries.
- **Validation** with Zod and consistent JSON error responses.

### Tests (20 passing)
- Unbalanced, fractional and keyless transactions are rejected.
- The same idempotency key sent 10 times at once is applied exactly once.
- 5 parallel 50-minute spends from a 120-minute balance: exactly 2 succeed, balance ends at 20.
- Ledger entries can't be updated or deleted through the model.
- The invariant checker catches a balance tampered with directly in the database.
- Duplicate signups (including two at the same moment) create only one user and one grant.

### Decisions
- **Cached balance + ledger.** Summing entries alone is correct but can't stop two parallel spends (both read the same balance before either writes). Updating an `Account` document with a conditional `$inc` in the same transaction makes MongoDB serialize the two spends, so one wins and the other is rejected.
- **Escrow per booking** (`escrow:<bookingId>`) so each booking's held credits can be checked on their own.
- **Express 5** passes errors from async handlers to the error middleware automatically, so routes don't need try/catch.

### Next (Day 2)
Offers, time slots and booking with an escrow hold.

## Day 2: The complete marketplace

**Goal:** finish the whole product in one push: every backend feature, the website, demo data and deployment setup.

### Backend
- **Offers and slots** (`services/offers.js`): publish, pause, search; slots can't overlap for the same teacher.
- **Booking** (`services/bookings.js`): one transaction claims the slot (`OPEN → BOOKED`), creates the booking and moves the price into `escrow:<bookingId>`.
- **Confirmation and settlement:** each side confirms; the second confirmation completes the booking and pays the teacher with the idempotency key `settle:<bookingId>`.
- **Cancellations:** full refund more than 24h ahead or when the teacher cancels; 50/50 inside 24h (odd minute to the learner). A learner's cancelled slot reopens; a teacher's closes.
- **Disputes** (`services/disputes.js`): freeze escrow; either side proposes a split, the other accepts; or an admin decides. Accepting includes the amount seen, so a changed proposal can't be accepted by mistake.
- **Invariants** (`services/invariants.js`): escrow per booking must match its status, on top of Day 1's ledger checks.
- **Realtime** (`services/realtime.js`): Socket.IO with JWT auth; each user has a private room; events are sent only after the transaction commits.
- **Security:** helmet headers, rate limiting on login/signup.
- **Clock injection:** services take an optional `now`, so tests and demo data can create sessions in the past without waiting.
- **Demo data** (`seed/demoData.js`): 8 members and an admin with completed sessions, all three kinds of cancellation, sessions awaiting confirmation, two disputes and 30 open slots, all created through the real services.
- `npm run demo` runs everything on an in-memory database with no setup.

### Frontend (`client/`)
React + React Router + TanStack Query + Tailwind. Pages: Browse, Offer, Login/Signup (with one-click demo accounts), Dashboard, Booking (timeline, cancel preview, dispute panel), Teach, History, Wallet, Profile, Admin.

### Tested in the browser
Walked through every flow as different users: confirm → settle, book → cancel → refund, accept a dispute proposal, admin decision, create an offer and slot, phone layout, production build. Bugs found and fixed:
- "1 completed sessions" grammar
- Cancelled and disputed bookings showed confirmation steps that could never happen
- Logging out sent you to "log in to see your wallet" instead of the home page
- Accepting a proposal showed two notifications for one action
- Demo dates: bookings and dispute notes showed today's date instead of when they happened
- Desktop "Log out" button also appeared in the mobile header

### DevOps
- GitHub Actions runs all tests and builds the frontend on every push.
- `render.yaml` deploys the app as one service; guide in `docs/DEPLOYMENT.md`.

### Tests: 55 passing
New: five learners racing for one slot, rollback when credits are short, ten simultaneous confirmations settle once, every cancellation rule, cancel-vs-cancel race, dispute agreement, stale proposal, agreement-vs-admin race, HTTP flow, Socket.IO notifications, and demo data health.

### Next
Deploy to Render + Atlas and add the live link to the README.
