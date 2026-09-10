# SOS live demo — Android app → responder dashboard

Send an emergency SOS from the native Android app and watch it appear, live,
on the web command-center dashboard.

**Nothing new is needed for this** — `POST /sos` already publishes an
`incident.created` event on the SSE broker (`backend/app/services/incidents.py`),
the dashboard's realtime layer (`frontend/src/lib/realtime.tsx`) already
refetches the incident list on that event, and Android Phase 4 already sends
the SOS. This doc just wires up the environment.

## Accounts (seeded by `seed_demo_data.py`)

| Role | Phone | Password | Used for |
|---|---|---|---|
| citizen | `9000000000` | `drishtidemo` | the web citizen app auto-signs-in as this; on the phone, register your own citizen or log in as this |
| admin | `9000000001` | `drishtiops` | **the dashboard** — sign in at `/login` |

## 1. Backend

```bash
docker compose up -d postgres                 # PostGIS on :5432 (creds drishti/drishti)
cd backend
python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt   # first time
alembic upgrade head
python -m app.scripts.seed_demo_data --force  # creates BOTH demo users + risk zones/shelters/alerts
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

No `.env` is required — `backend/app/config.py` defaults point at the compose
Postgres and use a dev JWT secret. `--host 0.0.0.0` matters if you'll use a
physical phone (so it's reachable on your LAN).

## 2. Web dashboard (the "auth website")

```bash
cd frontend
npm install        # first time
npm run dev        # http://localhost:3000
```

- The citizen site opens straight away (auto-demo-session).
- Go to **http://localhost:3000/login**, sign in as the **admin**
  (`9000000001` / `drishtiops`) → you land on **`/dashboard`**.
- Keep the **Incidents** list visible. The "Live" indicator (top of the
  dashboard) should be green.

## 3. Android app

```bash
cd android
./gradlew :app:installDevDebug        # emulator or USB device with USB debugging
```

- The `dev` flavor's `BASE_URL` is `http://10.0.2.2:8000/api/v1/` — that's how
  the **emulator** reaches your host's `localhost`. Works out of the box.
- **Physical device:** edit the `dev` flavor `BASE_URL` in
  `android/app/build.gradle.kts` to `http://<your-machine-LAN-IP>:8000/api/v1/`,
  reinstall. (Cleartext to LAN IPs is already allowed for the `dev` flavor via
  `app/src/dev/res/xml/network_security_config.xml` — add your IP there if it
  isn't a `10.0.2.2` / `localhost` host.)
- In the app: **Register** a new citizen (any name / phone / 8+ char password),
  or sign in as `9000000000` / `drishtidemo`.
- When prompted for location, grant **Precise** (not "Approximate"). The SOS
  screen warns if only approximate is on — an SOS point could then be off by a
  kilometre. Being outdoors / near a window gives the best GPS fix.

## 4. Run the demo

1. On the phone: **SOS** tab → press and **hold the SOS button for 3 seconds**.
   The app pulls a fresh high-accuracy GPS fix during the hold, so the SOS
   carries where you are *right now*, not where the screen opened.
2. Dialog shows "SOS sent" with the incident number.
3. On the dashboard:
   - A new **CRITICAL** incident appears at the top of the Incidents list within
     a second — no refresh. `reported_by` is the phone's citizen user;
     `priority` is `critical`.
   - The **map flies to the SOS location** and drops a dark-red incident dot.
     Click the dot for a popup (`#id · type · severity · status`); click
     **"show on map"** on any incident row to re-centre on it.
   - The incident row shows the exact `lat, lon` (5 decimals ≈ 1 m).
4. Optional: on the dashboard, verify/patch the incident → its status flips
   live in the phone's **My Reports** tab (Phase 3 + 7).

### Offline variant (Phase 4 WorkManager queue)

1. Put the phone in airplane mode.
2. Hold SOS → dialog says "SOS queued" and a persistent notification appears
   ("SOS queued — waiting for a connection").
3. Turn networking back on → the queued SOS uploads automatically and lands on
   the dashboard.

## Verified (server side, 2026-09-09)

`POST /sos` as the seeded citizen created incident `#13` (type `flood`,
severity `critical`, `reported_by` = citizen id); an SSE consumer connected as
the admin received the `incident.created` frame immediately, and
`GET /incidents` returned it at the top of the list. The Android emulator leg
wasn't run here (no AVD on the build box) — the curl `POST /sos` uses the same
multipart fields the app sends (`EmergencyViewModel` → `IncidentsRepository.submitSos`).
