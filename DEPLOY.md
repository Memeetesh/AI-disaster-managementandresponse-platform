# How to put DRISHTI online

You will use three free websites:

- **Supabase** — the database
- **Render** — the backend (the API)
- **Vercel** — the frontend (what people see)

Total time: about 15 minutes. No credit card needed.

Do the steps in order. Where it says **COPY THIS**, keep the value handy — you
paste it into a later step.

---

## Step 0 — Push your code to GitHub

The other sites read your code from GitHub, so it must be up to date.

```
git push origin main
```

---

## Step 1 — Database (Supabase)

1. Go to **https://supabase.com** and sign in with GitHub.
2. Click **New project**.
   - Give it a name (e.g. `drishti`).
   - Set a **database password** and save it somewhere.
   - Pick the region closest to you.
   - Click **Create new project** and wait ~2 minutes.
3. In the left sidebar: **Project Settings** (gear icon) → **Database**.
4. Find **Connection string**, choose the **URI** tab, and click copy.
   It looks like:
   `postgresql://postgres.abcd:YOUR-PASSWORD@aws-0-xxx.pooler.supabase.com:6543/postgres`
5. If the string shows `[YOUR-PASSWORD]`, replace that part with the password
   from step 2.

**COPY THIS** — call it `DATABASE_URL`.

---

## Step 2 — Backend (Render)

1. Go to **https://render.com** and sign in with GitHub.
2. Click **New +** (top right) → **Blueprint**.
3. Choose your `AI-disaster-management...` repository → click **Connect**.
4. Render finds the `render.yaml` file and shows a service called
   **drishti-api**. Click **Apply** / **Create**.
5. The first build will fail or wait — that's fine, you haven't added the
   database yet. Now add it:
   - Open the **drishti-api** service → **Environment** (left menu).
   - Click **Add Environment Variable** and add:
     | Key | Value |
     |-----|-------|
     | `DATABASE_URL` | the value you copied in Step 1 |
     | `LLM_API_KEY` | your Gemini key (optional — skip to disable the chatbot) |
   - Click **Save Changes**. Render redeploys automatically.
6. Watch **Logs**. Wait until you see `Application startup complete`.
7. Add the demo data. Open the service → **Shell** tab → run:
   ```
   python -m app.scripts.seed_demo_data
   ```
   It should print lines like `seeded 25 risk zones`.
8. At the top of the service page, copy its address, e.g.
   `https://drishti-api.onrender.com`.

**COPY THIS** — call it `BACKEND_URL`.

Quick check: open `BACKEND_URL/api/v1/health` in a browser. You should see
`{"status":"ok","database":"ok"}`.

---

## Step 3 — Frontend (Vercel)

1. Go to **https://vercel.com** and sign in with GitHub.
2. Click **Add New...** → **Project** → import the same repository.
3. On the setup screen:
   - **Root Directory** → click **Edit** → choose **`frontend`**.
   - Open **Environment Variables** and add one:
     | Key | Value |
     |-----|-------|
     | `NEXT_PUBLIC_API_URL` | your `BACKEND_URL` **plus `/api/v1`** — e.g. `https://drishti-api.onrender.com/api/v1` |
4. Click **Deploy** and wait ~1 minute.
5. Vercel gives you a link like `https://drishti-xxxx.vercel.app`.

**COPY THIS** — call it `FRONTEND_URL`.

---

## Step 4 — Connect the two (CORS)

Right now the backend blocks the frontend. Fix it:

1. Back in **Render** → **drishti-api** → **Environment**.
2. Add one more variable:
   | Key | Value |
   |-----|-------|
   | `CORS_ORIGINS` | your `FRONTEND_URL` — e.g. `https://drishti-xxxx.vercel.app` |
3. **Save Changes**. Render redeploys.

Now open your `FRONTEND_URL`. Register an account and log in — the home page
should show risk cards and nearby shelters.

---

## Step 5 — Make a command-center login

Normal sign-up only creates a "citizen" account. To see the dashboard:

1. Register a citizen account in the app (use your phone number).
2. In **Supabase** → **SQL Editor** → **New query**, run (put your phone in):
   ```sql
   update users set role = 'admin' where phone = '9990001111';
   ```
3. Log out and log back in. You now land on `/dashboard`.

Done. Your site is live.

---

## Things to know about the free tiers

- **The backend sleeps after ~15 minutes of no traffic.** The next visit takes
  30–60 seconds to wake it up, then it's fast again. Live updates reconnect
  on their own. Upgrade Render, or use Railway / Fly.io, if you need it always
  awake.
- **Uploaded photos disappear on each redeploy** (the backend has no permanent
  disk on the free plan). Fine for a demo.
- The map uses free OpenStreetMap tiles — fine for demo traffic.

## Updating later

- Push to `main` → Vercel and Render redeploy by themselves.
- To reset the demo data: Render → **Shell** →
  `python -m app.scripts.seed_demo_data --force`
