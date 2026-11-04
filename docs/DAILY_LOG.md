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
