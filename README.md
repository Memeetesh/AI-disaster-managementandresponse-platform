# DRISHTI — AI-Powered Disaster Intelligence, Response & Situational Awareness System

Prototype disaster-management platform. Demo hazard: **urban flooding**.
See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full system design,
schema, and build plan.

Status: **Phase 4** — auth, incidents/SOS/citizen reports, the live risk map
(PostGIS risk zones + shelters), the disaster simulator, real-time updates
(SSE at `/api/v1/stream`), area-wide alerts, citizen safety check-ins,
shelter-proximity search, the incident priority engine, and
dispatch/routing (nearest-responder allocation, OSRM safe routes with a
straight-line fallback, rescue-operation lifecycle) are done. The AI layer
(CV/NLP/STT, LLM situation summary, confidence scoring) is the remaining
"later phase" — every AI-labelled surface in the UI is currently an
explicit placeholder.

## Repository layout

```
backend/    FastAPI app (API, DB models, auth, AI, GIS, risk, routing)
frontend/   Next.js PWA (citizen app + responder dashboard)
ml/         Standalone CV/NLP/risk-model code and demo datasets
simulator/  Disaster-simulation panel backend
docs/       Architecture, ER diagram, API notes
```

## Prerequisites

- Node.js 20+ and npm
- Python 3.12+ (tested against 3.14)
- A PostgreSQL 14+ database with the **PostGIS** extension available.
  Easiest path: a free [Supabase](https://supabase.com) project — no local
  Postgres install needed, PostGIS ships enabled. Alternatively run
  `docker compose up postgres` if you have Docker installed.

## 1. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:
- `DATABASE_URL` → your Supabase/Postgres connection string (use the
  `postgresql+psycopg2://...` form, not the raw `postgres://` Supabase gives you —
  just swap the scheme prefix)
- `JWT_SECRET` → generate one: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`
- Everything else has a working default / is optional for Phase 1.

## 2. Backend setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Run migrations against your database (creates the `postgis` extension and
all 9 tables):

```bash
alembic upgrade head
```

Start the API:

```bash
uvicorn app.main:app --reload
```

- API: http://localhost:8000
- Interactive docs (OpenAPI): http://localhost:8000/docs
- Health check: http://localhost:8000/api/v1/health — reports `{"status":"ok","database":"ok"}`
  once the DB is reachable; the app still boots and serves this endpoint even
  if the DB is down, so you can tell "app is up" from "DB is down" at a glance.

### Seed demo data (risk zones + shelters)

The live risk map has nothing to show until the demo grid and a few
shelters are seeded — this is one-off, idempotent, and safe to re-run:

```bash
cd backend
source venv/bin/activate
python -m app.scripts.seed_demo_data          # skips if already seeded
python -m app.scripts.seed_demo_data --force  # wipes and reseeds
```

This populates a 25-cell synthetic risk grid over central Chennai (the demo
hazard area) and 5 shelters, all named with a `(Demo)` suffix — these are
**not** real IMD/census/shelter-registry data, just deterministic baseline
numbers so the map has something to color in before a real data feed is
wired up.

### Running backend tests

Most tests need a real reachable Postgres+PostGIS database (SQLite can't
represent the Geometry columns) — point `DATABASE_URL` at a scratch
database, never production, since the test suite creates and drops all
tables:

```bash
cd backend
source venv/bin/activate
pytest -v
```

`tests/test_risk_engine.py` is pure (no DB — the risk formula and grid
generator are plain functions) and can run standalone any time:
`pytest tests/test_risk_engine.py -v`.

## 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

- App: http://localhost:3000

## 4. Try it

1. Open http://localhost:8000/docs and use `POST /api/v1/auth/register` to
   create a citizen account (`name`, `phone`, `password`).
2. `POST /api/v1/auth/login` with the same phone/password to get a JWT.
3. Call `GET /api/v1/auth/me` with `Authorization: Bearer <token>` to confirm
   the token round-trips and the role is `citizen` — note that even if you
   pass `"role": "admin"` at registration, the API silently forces `citizen`.
   An existing admin can provision responder/admin accounts via
   `POST /api/v1/users`.
4. Run the demo-data seed (see above), then visit http://localhost:3000,
   sign in, and allow location access — the home page shows your current
   flood-risk zone and nearest shelters; `/sos` and `/report` submit real
   incidents.
5. To see the command-center view, promote a user to `responder` or `admin`
   — either `POST /api/v1/users` as an existing admin, or directly in the
   database: `UPDATE users SET role = 'responder' WHERE phone = '<phone>';`
   — then sign in again and visit `/dashboard` for the live incident feed,
   risk-zone map (click a zone for its score breakdown), and shelter/incident
   pins.

## Docker (optional, all services together)

```bash
docker compose up --build
```

Brings up Postgres+PostGIS, Redis, backend, and frontend together. Run
`docker compose exec backend alembic upgrade head` once, after first start,
to create the schema.

## External API failure strategy

Every external integration (IMD weather, SACHET/CAP alerts, OSRM routing, an
LLM for NLP) is designed to degrade rather than crash the app:
**real API → cache → simulator/mock**. Phase 1 doesn't call any of these yet;
this note documents the pattern later phases follow (see
`docs/ARCHITECTURE.md` §32-equivalent).
