# SkillSwap Ledger: Specification

A time-credit marketplace for peer learning. People teach what they know, earn time credits, and spend those credits to learn from others. Every credit movement is recorded in an append-only, double-entry ledger.

## Goals

1. Publish teaching offers and book available learning sessions.
2. Record attendance and award time credits only after **both** parties confirm.
3. Support cancellations, disputes and a searchable learning history.
4. Guarantee that credits are never created, lost or awarded twice, even under retries and simultaneous requests.

Credits are fictional and never connected to real money.

## Credits

- 1 credit = 1 minute of teaching. Stored as **whole numbers** (no decimals, no rounding errors).
- Every new user receives **120 minutes** on signup.
- A session costs its duration, e.g. a 60-minute session costs 60 credits.

## Accounts

| Account | Key | Can go negative? |
|---|---|---|
| Mint (source of all credits) | `mint` | Yes. Its balance is minus the total credits issued |
| User wallet | `user:<userId>` | No |
| Booking escrow | `escrow:<bookingId>` | No. Must return to 0 once the booking is closed |

## Ledger rules

1. **Append-only.** Entries are inserted, never updated or deleted.
2. **Double-entry.** Every transaction has two or more legs that sum to zero.
3. **Idempotent.** Each transaction has a unique key (e.g. `settle:<bookingId>`). Writing the same key twice is a no-op.
4. **No overdraft.** Spending checks and subtracts the balance in a single atomic operation.
5. **Atomic.** All legs of a transaction, plus any related document change (e.g. booking status), commit together or not at all (MongoDB transactions).

### Invariants (checked by tests and the admin endpoint)

- Sum of all ledger entries = 0
- Each account's stored balance = sum of its entries
- No account except `mint` is negative
- A closed booking's escrow balance = 0

## Booking lifecycle

```
           book (credits → escrow)
  [open slot] ──────────────► BOOKED
                                │
       ┌────────────────────────┼─────────────────────────┐
       │ cancel                 │ both confirm             │ either party disputes
       ▼                        ▼                          ▼
   CANCELLED               COMPLETED                   DISPUTED
 (refund per policy)   (escrow → teacher)                  │
                                            ┌──────────────┴──────────────┐
                                            │ mutual agreement             │ admin decision
                                            ▼                              ▼
                                         RESOLVED (escrow split as agreed/decided)
```

### Cancellation policy

- Cancelled **more than 24 hours** before the session starts → learner gets a **full refund**.
- Cancelled **within 24 hours** → learner gets **50%** back, the teacher receives the other 50%.
- If the **teacher** cancels → learner always gets a full refund.

### Disputes

Either party can open a dispute on a `BOOKED` session after its start time. Credits stay frozen in escrow.

1. **Mutual agreement:** one party proposes an outcome (`REFUND_LEARNER`, `PAY_TEACHER`, or `SPLIT`). If the other party accepts, it is applied.
2. **Admin decision:** if they can't agree, an admin reviews the notes and decides. The admin's decision is final.

## Video calls

- 1-to-1 WebRTC calls between the teacher and the learner, with screen sharing. Media flows browser to browser (encrypted); the server only relays connection details (signaling) over Socket.IO.
- The call is open from **10 minutes before** the start to **15 minutes after** the end, only for the two people in a `BOOKED` booking.
- **Attendance:** the server records connect and disconnect times (server clock) for each person. Only time inside the scheduled session counts.
- If both were connected for at least half the session, the app **suggests** confirming. It never confirms on its own; credits only move when a person confirms.
- Nothing is recorded except those times.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite), React Router, TanStack Query, Tailwind CSS |
| Backend | Node.js, Express 5, Mongoose 9, Zod validation, JWT auth |
| Realtime | Socket.IO (booking updates pushed to each user) |
| Database | MongoDB Atlas (replica set, required for transactions) |
| Tests | Vitest, Supertest, mongodb-memory-server |
| Hosting | Render (one service: API + website), MongoDB Atlas (database) |
| CI | GitHub Actions (tests + frontend build on every push) |

