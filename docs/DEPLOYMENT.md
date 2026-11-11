# Deployment

SkillSwap Ledger runs as **one Render web service**. The same Node process serves the API, the Socket.IO connection and the built React website, so there is one URL and no CORS setup. Data lives in **MongoDB Atlas**.

Both have free tiers. Total time: about 20 minutes.

## 1. MongoDB Atlas

1. Sign up at [mongodb.com/atlas](https://www.mongodb.com/atlas) and create a **free M0 cluster**.
2. **Database Access** → *Add New Database User*. Choose a username and a strong password. Save the password somewhere safe.
3. **Network Access** → *Add IP Address* → *Allow access from anywhere* (`0.0.0.0/0`).
   Render's servers don't have fixed IP addresses, so they can't be listed one by one. The database password is what protects it.
4. **Connect** → *Drivers* → copy the connection string. It looks like:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<password>` with your password, and add a database name before the `?`:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/skillswap?retryWrites=true&w=majority
   ```

Atlas clusters are always replica sets, which the app needs for transactions.

## 2. (Optional) Load the demo data

Lets visitors log in with the demo accounts straight away. Run this on your own computer:

```bash
cp server/.env.example server/.env
# open server/.env and paste your connection string as MONGO_URI
cd server
npm run seed -- --reset
```

`--reset` **erases everything** in that database first. Only run it on a database meant for the demo.

## 3. Render

1. Sign up at [render.com](https://render.com) with your GitHub account.
2. **New** → **Blueprint** → choose the `skillswap-ledger` repository.
   Render reads [`render.yaml`](../render.yaml) and sets up the service.
3. When asked for `MONGO_URI`, paste your connection string. `JWT_SECRET` is generated automatically.
4. Click **Apply**. The first build takes a few minutes. It runs:
   - `npm run build`: installs server packages and builds the React app into `client/dist`
   - `npm start`: starts the server, which serves the API and the website
5. Open the `https://skillswap-ledger-xxxx.onrender.com` URL Render shows you.

Every push to `main` redeploys automatically.

### Good to know

- **Free instances sleep** after 15 minutes without visitors. The next visit takes 30–60 seconds to wake it up. Mention this if you share the link with a recruiter, or open it yourself a minute before a demo.
- **Health check:** Render pings `/api/health` to know the app is up.
- Check that it's working: open `/api/health` on your URL. It should show `{"ok":true}`.

## 4. After deploying

- Put the live link at the top of the README (replace "_coming soon_").
- Log in as `admin@skillswap.test` and click **Run checks** on the Admin page. It should say *All checks passed*.

## Database-level rules

When the server starts, it installs MongoDB schema validators on the `accounts` and `ledgerentries` collections, so the database itself rejects negative balances and malformed ledger entries (see [SPEC.md](SPEC.md)).

- On a **new** database this works with any database user that can read and write.
- Adding the rules to collections that **already exist** needs the `collMod` permission, which Atlas's *Read and write to any database* role doesn't include. If it's missing, the server logs `Could not install database rules…` and keeps running with the app's own checks.
- To check: log in as the admin and click **Run checks**. The last line says whether the database rules are on.
- To turn them on for an existing database: in Atlas → **Database Access**, edit the app's user and give it the **Atlas admin** role (or `dbAdmin` on the `skillswap` database), then restart the service on Render.

## Optional: a TURN relay for video calls

Video calls connect the two browsers directly. On most home and mobile networks that just works using a free public STUN server. Some strict networks (offices, some colleges) block direct connections; for those, the call needs a **TURN relay**.

1. Create a free account with a TURN provider (for example Metered) and copy its TURN URLs, username and credential.
2. In Render: your service → **Environment** → add `TURN_URLS` (comma-separated), `TURN_USERNAME`, `TURN_CREDENTIAL` → **Save**. Render redeploys.

The credentials stay on the server and are only sent to the two people in a call, when they join.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | yes | MongoDB connection string (must be a replica set) |
| `JWT_SECRET` | yes in production | Long random string used to sign login tokens |
| `NODE_ENV` | | `production` on Render |
| `PORT` | | Set by Render automatically |
| `JWT_EXPIRES_IN` | | Login lifetime, default `7d` |
| `CLIENT_ORIGIN` | | Only for local development, default `http://localhost:5173` |
| `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` | | Optional TURN relay for video calls on strict networks |
