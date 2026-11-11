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

## Day 3: Deployed

**Live at https://skillswap-ledger.onrender.com**

- MongoDB Atlas free cluster, database `skillswap`, loaded with the demo community (`npm run seed -- --reset`); ledger health OK.
- Render Blueprint (`render.yaml`) builds the React app and runs one Node service for the API, website and Socket.IO. Every push to `main` redeploys.
- Made the seed script safe on a shared cluster: it refuses to run without a database name (MongoDB would silently use `test`) and refuses to wipe a database holding another app's collections. The first guard caught a real mistake during setup.
- Checked the live site: health, API, auth (401 without login), SPA routes, static assets, HTTPS security headers, Socket.IO endpoint.

## Day 4: Redesign

The whole site was redesigned in an editorial "riso print" style: ivory paper, oxblood and antique-gold inks, Playfair Display headings. The look was chosen from several prototypes, combining a riso-zine layout, newspaper colours, and the spacious feel of premium retail sites.

### Frontend
- **Design tokens** in `client/src/index.css` (`bg-ivory`, `text-ox`, `font-display`…) so every page shares one palette.
- **Animated hero** (`Hero.jsx`): riso ink shapes slide into "registration" and drift; the headline rises line by line; a gold sheen and a hand-drawn underline; floating ledger receipts; live member and seat counts. A soft glow keeps the text readable, and everything is disabled for `prefers-reduced-motion`.
- **Riso artworks** (`RisoArt.jsx`): each session gets an original two-ink print picked from its skills or craft, with a stable fallback for anything new.
- **Gallery grid** (`SessionCard.jsx`): taped prints, member-pick and new badges, "You'll leave with…" revealed on hover (always shown on touch screens).
- **Session page** works like a shop product page: times chosen like sizes, one booking button, balance before and after, reassurance under the button.
- **Your desk**: greeting, big balance, and the one session that needs confirming shown as an "admit one" ticket.
- Landing sections: how the minutes move, features, comparison table, FAQ, closing call to action.

### Backend
- Offers gained `category` (the craft) and `outcome` ("You'll leave with…").
- Listings include `taughtCount`, `memberPick` (the two most-booked offers) and `isNew` (created this week).
- Public `/api/community/stats` and `/api/community/recent` power the hero numbers and the "recently swapped" strip.

### Checked
All pages in the browser at desktop and phone width. Fixed: every menu link showing as active (hash links), and the admin grid overflowing on phones (grid items need `min-width: 0` to shrink).

### Tests: 60 passing

## Day 5: Video calls

**Goal:** sessions happen inside the app, and the call itself becomes evidence for the ledger.

### Built
- **Signaling** (`services/callSignaling.js`): Socket.IO events to join a call room, relay offers, answers and ICE candidates only to the other person, and report connection state. Access is checked on join: right person, `BOOKED`, inside the window (10 min before → 15 min after).
- **Attendance** (`models/CallAttendance.js`, `services/calls.js`): connect and disconnect times per person; overlapping intervals are merged and clipped to the session, giving each person's minutes and the minutes both were on together.
- **`useCall` hook**: one `RTCPeerConnection` per call using the "perfect negotiation" pattern (the learner is the polite side), ICE restart when the network changes, screen sharing by swapping the video track, rejoining after a server reconnect, and receive-only mode for people without a camera or mic.
- **Call page**: pre-join screen (camera preview, mic level meter, device pickers), then a full-screen call with mute, camera, share screen and leave, a session timer and connection status.
- **Booking page call card**: join button, time on the call per person, and "Looks like it happened. Confirm?" when both were there for at least half the session.
- **Your desk**: a "Happening now · Join the call" ticket, and Join buttons on upcoming sessions once the call opens.
- One shared Socket.IO connection (`SocketContext`) used by notifications and calls.

### Tested
- 8 new tests (68 total): time window edges, strangers refused, cancelled bookings closed, attendance maths (late arrival, a dropped connection, time outside the session ignored), and real two-client signaling where a stranger's messages go nowhere and closing the tab ends attendance.
- In the browser with two users in two tabs: join, wait, connect (WebRTC reported *connected*), attendance recorded, leave, rejoin.
- **Real devices on the live site:** a phone on mobile data and a laptop on Wi-Fi saw and heard each other; the server recorded both joining at the same second and leaving a minute later. This connected directly, without a TURN relay.
- Not yet tested: a strict network (office or college Wi-Fi) that blocks direct connections and needs a TURN relay.

## Day 6: Rules the database enforces itself

**Goal:** close the classic "MongoDB isn't strict enough for money" gap by moving key ledger rules from the app into the database.

### Built
- **Schema validators** (`server/src/dbRules.js`): MongoDB `$jsonSchema` rules on `accounts` (whole-minute balances, never negative except the mint, valid account names) and `ledgerentries` (known type, valid account, whole non-zero amount, required fields). A write that breaks them fails with error 121, even when it skips the app entirely.
- Installed on startup: created with new collections, added to existing ones with `collMod`. Without permission for `collMod` the server logs a warning and keeps running.
- **Admin health check** now reports whether the database rules are on.
- README screenshots refreshed with the new design (7 pages).

### Fixed while testing
- On a brand-new database the accounts rule was silently missing: Mongoose creates collections by itself while connecting, so it could create `accounts` between our "does it exist?" check and our create. Now "already exists" falls back to `collMod`, with a test for the race.
- On the live site the admin health check failed: Atlas's free tier rejects `$in` inside a `listCollections` filter (local MongoDB accepts it). The check now lists all collections and filters in code. The rules themselves were installed on the live database correctly.

### Limits (on purpose)
Validators check what a document looks like, not whether it was changed. Editing or deleting a valid ledger entry is still blocked by the app, not the database, and the invariant checks would detect it.

### Tests: 78 passing
10 new tests write straight to MongoDB with the raw driver (skipping Mongoose) and confirm the database refuses bad data, while everything the app writes normally is still accepted.
