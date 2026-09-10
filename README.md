# Aasha Setu — Disaster Intelligence, Response & Situational Awareness

A disaster-management platform built around one loop: a citizen sees their
live local risk, raises a report or an SOS, and a command centre verifies it
and dispatches help — all in real time. Demo hazard: **urban flooding**.

Two front ends over one API:

- **Aasha Setu** (citizen) — a Next.js PWA and a native Android app: live
  risk map, hazard forecasts, SOS, "I am safe" check-ins, nearest
  shelter/hospital, offline map, family safety, a support companion.
- **Command Centre** (responder/admin) — a web dashboard: prioritised
  incident queue, verify/reject, nearest-responder dispatch with routing,
  rescue-operation tracking, area-wide alerts.

Full design, schema and roadmap: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Status

### Working — citizen app (~90% of the demo scope)

| Area | What's live |
|---|---|
| Auth | JWT + server-side roles. The web citizen app **auto-signs-in** as a seeded resident (no login screen); operators sign in at `/login`. |
| Realtime | Server-Sent Events on `GET /api/v1/stream` — in-process pub/sub broker, role-filtered, auto-reconnect. No Redis, no WebSocket. |
| Home | Live risk map (PostGIS risk zones + shelters), most-severe area alert banner. |
| Hazard forecasts | Location-based **rainfall, flood (GloFAS river discharge), cyclone (wind + pressure indicator), landslide (slope × rainfall)** cards — Open-Meteo free APIs, cached 15 min server-side, graceful fallback to demo data on provider failure. |
| Emergency | SOS with photo/audio, "I am Safe" check-in, offline downloadable interactive map (Leaflet + baked tiles). |
| Reports | Submit a non-emergency hazard report; track its status live in "My Reports". |
| Places | Real nearby shelters + nearest hospital from OpenStreetMap (Overpass). |
| Support | Authority-messages feed, and "Talk to Someone" — an LLM support companion (Gemini) with crisis guardrails. Lost & Found / coping exercises are labelled demo. |
| Family Safety | Add people by phone → they **accept/decline** → owner sees their live status (from the member's own check-ins / SOS). Separate opt-in **live location sharing** with distance + map. |

### Working — command dashboard (~70%)

Prioritised incident queue, verify/reject, nearest-available-responder
dispatch, OSRM safe route with a straight-line fallback, rescue-operation
lifecycle, alert composer, live stats, shelter management — all updating
over the same SSE stream.

### Deterministic engines (no AI, auditable)

Risk-zone scoring, incident priority (severity + people affected + zone
risk + report age), safe routing.

### Deferred — the AI layer

CV on incident photos, NLP extraction from free-text SOS, speech-to-text,
LLM situation summary, and the confidence-scoring pipeline that would move
an incident `reported → ai_verified → verified`. Design is settled
(human-in-the-loop — AI only ever produces a scored *recommendation* a
human approves). Prototypes live in [`ml/`](ml/); `backend/app/ai/` is a
stub. Drone search-and-rescue footage analysis belongs to the
command-dashboard track.

---

## Architecture

```
        Next.js PWA  ─┐                         ┌─  Open-Meteo (weather/flood/elevation)
                      ├─► FastAPI ──────────────┼─  OpenStreetMap Overpass (POIs)
     Android (Compose)─┘   │   │                ├─  OSRM (routing)  ── haversine fallback
                           │   │                └─  Gemini (support chat) ── canned fallback
                           │   └─ in-process SSE broker ─► live updates to every client
                           │
                           └─► PostgreSQL + PostGIS   (ST_Distance / ST_DWithin, GIST-indexed)
```

Principles worth knowing:

1. **API-first.** Every feature is a FastAPI endpoint; the three clients are
   pure consumers of the same typed contract.
2. **Every external integration sits behind the backend.** No third-party
   key ever reaches a client, and each integration degrades
   (real → cache → demo data) instead of failing the page.
3. **Server-authoritative auth.** The JWT's `role` claim is minted and
   re-checked server-side on every request; a client's claimed role has no
   authority.
4. **Realtime without infrastructure.** One authenticated SSE endpoint + an
   in-process broker. The broker contract is a drop-in point for Redis when
   horizontal scale is needed.
5. **Deterministic where lives are involved.** Risk and priority are pure
   functions. AI, when added, only recommends.

---

## Repository layout

```
backend/     FastAPI app — API, ORM models, auth, GIS, risk, routing, SSE, weather/places/chat
frontend/    Next.js 16 PWA — citizen app + command dashboard
android/     Native Kotlin / Jetpack Compose citizen app (in progress)
ml/          Standalone CV + NLP prototypes (not wired into the app)
simulator/   Disaster-simulation panel backend
docs/        Architecture, Android plan, SOS demo script
DEPLOY.md    Vercel + Render + Supabase runbook
render.yaml  Render Blueprint for the backend
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, TanStack Query v5, `@microsoft/fetch-event-source`, MapLibre GL |
| Android | Kotlin, Jetpack Compose, Hilt, Room, DataStore, WorkManager, OkHttp (SSE) |
| Backend | FastAPI, Uvicorn, SQLAlchemy 2.0 (sync) + GeoAlchemy2, Alembic, Pydantic v2, python-jose + bcrypt, httpx |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| Realtime | Server-Sent Events + in-process broker |
| Hosting | Vercel (frontend) · Render (backend) · Supabase (managed Postgres + PostGIS) |
| External APIs | Open-Meteo, OpenStreetMap Overpass, OSRM, Google Gemini — all behind FastAPI, all with a fallback |

---

## Quick start (local)

### Prerequisites

- Node.js 20+ and npm
- Python 3.12+ (tested to 3.14)
- PostgreSQL 14+ with the **PostGIS** extension. Easiest: a free
  [Supabase](https://supabase.com) project (PostGIS pre-enabled), or
  `docker compose up -d postgres`.

### 1. Environment

```bash
cp .env.example .env      # edit DATABASE_URL + JWT_SECRET; everything else has a default
```

Generate a secret: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`

### 2. Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate     # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head                                  # creates postgis + all tables
python -m app.scripts.seed_demo_data                  # risk grid, shelters, responders, alerts, demo users
uvicorn app.main:app                                  # http://localhost:8000  (docs at /docs)
```

Health: `GET /api/v1/health` → `{"status":"ok","database":"ok"}`. The app
boots and serves this even when the DB is down, so "app up" and "DB down"
are distinguishable at a glance.

> Run `uvicorn` **without** `--reload` if you're testing SSE — `--reload`
> hangs on shutdown while a stream is open.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
```

Set `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000/api/v1`).

### 4. Demo logins

Seeded by `seed_demo_data.py`:

| Role | Phone | Password | Notes |
|---|---|---|---|
| Citizen | `9000000000` | `drishtidemo` | the web citizen app auto-signs-in as this |
| Admin | `9000000001` | `drishtiops` | sign in at `/login` → `/dashboard` |

Allow location access on the citizen home page — the hazard cards, nearest
shelter/hospital and risk zone are all based on your coordinates.

---

## Tests

```bash
cd backend && source venv/bin/activate
pytest -q            # 103 tests — needs a reachable Postgres+PostGIS (uses a scratch "<db>_test", never prod)
```

`tests/test_risk_engine.py` is pure and DB-free. Frontend: `npm run build`
type-checks and `npx eslint src` lints. Android: `./gradlew test`.

---

## Docker (all services)

```bash
docker compose up --build
docker compose exec backend alembic upgrade head     # once, after first start
```

Brings up Postgres+PostGIS, Redis (reserved for future SSE scale-out),
backend and frontend.

---

## Deployment

See [`DEPLOY.md`](DEPLOY.md). In short: Supabase for the database (use the
**Session pooler**, port 5432), Render for the backend via `render.yaml`
(self-migrates and self-seeds on boot, self-pings to stay warm), Vercel for
the frontend (root directory `frontend`). `.github/workflows/keepalive.yml`
is an external cron that also wakes the free-tier backend from sleep.

---

## External-API failure strategy

Every integration degrades rather than crashing the page:
**real API → server-side cache → demo/mock**. Weather returns a 502 the
frontend catches; Overpass returns `[]`; OSRM falls back to a haversine
estimate; the chat companion falls back to a fixed supportive message with
helplines. No key ever reaches a client.
