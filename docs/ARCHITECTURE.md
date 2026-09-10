# Aasha Setu — Architecture

AI-Powered Disaster Intelligence, Response & Situational Awareness System.
Demonstration disaster: **urban flooding**. Architecture is disaster-type-agnostic
(new hazards are new `incident.type` / `alert.type` values, not new tables).

## A. System architecture

```
                        USER / CITIZEN
                              │
                     Next.js PWA (frontend)
                              │  HTTPS / WSS
                              ▼
                    ┌──────────────────────┐
                    │   FastAPI (backend)   │
                    │   API Gateway layer   │
                    │  auth · incidents ·   │
                    │  sos · alerts ·       │
                    │  responders           │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
     ┌────────────────┐ ┌─────────────┐ ┌──────────────────┐
     │   AI/ML layer   │ │  Decision    │ │  GIS / Routing    │
     │ CV (YOLO) · NLP │ │  Engine      │ │  PostGIS queries  │
     │ STT · risk model│ │ priority ·   │ │  OSRM safe route  │
     │ anomaly detect  │ │ allocation · │ │                   │
     └────────┬────────┘ │ shelter rec  │ └─────────┬─────────┘
              │           └──────┬──────┘           │
              └──────────────────┼───────────────────┘
                                  ▼
                     PostgreSQL + PostGIS (Supabase)
                                  ▲
              ┌───────────────────┼───────────────────┐
              │                   │                    │
         IMD weather        SACHET/CAP alerts    OSM tiles / OSRM
        (cache→simulator)   (cache→mock)          (fallback graph)
```

Every external system (IMD, SACHET, OSRM, an LLM) sits **behind** FastAPI.
The frontend never calls them directly and never holds their credentials.
Each integration follows the same fallback chain (see §32 of the brief):

```
real API → cache → simulator/mock
```

so a dead external API degrades a feature, it never crashes the demo.

## B. Technology decisions

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js + TS + Tailwind + MapLibre GL | App Router gives PWA-friendly routing/SSR; MapLibre+OSM is free/open, no Google Maps key needed; Tailwind keeps the "ops center" look consistent without a component-library aesthetic. |
| Backend | FastAPI (Python) | Async-capable, automatic OpenAPI docs (`/docs`), Pydantic validation at every boundary, and the same language as the AI/ML stack (YOLO, transformers) so AI services aren't a separate microservice with its own deploy story. |
| DB | PostgreSQL + PostGIS (Supabase) | PostGIS gives real spatial types/queries (`ST_DWithin`, `ST_Distance`, GIST indexes) instead of hand-rolled haversine math; Supabase removes the "install Postgres+PostGIS locally" friction — a hosted connection string is enough. |
| ORM/migrations | SQLAlchemy 2.0 (sync) + Alembic | Sync sessions were chosen over async SQLAlchemy deliberately: this is a hackathon MVP, and sync keeps the ORM/session/migration story simple. FastAPI runs sync `def` routes in a threadpool, so it doesn't block the event loop the WebSocket layer needs. |
| Auth | JWT (python-jose) + bcrypt (passlib) | Stateless tokens are enough for a demo-scale deployment; role is minted server-side into the token and re-checked on every request — the frontend's claimed role is never trusted (see `app/core/deps.py`). |
| Routing | OSRM, with a straight-line/graph fallback | OSRM gives real road-network routing; when it's unreachable the routing service falls back to a simplified cost-graph so "safe route" still returns *something* during a demo. |
| Realtime | FastAPI WebSockets (+ Redis pub/sub, optional) | Native to FastAPI, no extra infra required for a single-instance demo; Redis is a drop-in upgrade if the app is horizontally scaled later. |
| CV | YOLO (Ultralytics) | Pretrained COCO classes (person, car, boat, truck) already cover most of the flood-scene detections needed; no custom training required for an MVP. |
| NLP | LLM API (pluggable), behind FastAPI | Structured extraction (victims, urgency, hazard) from free-text SOS messages; kept behind the backend so the key is never exposed, and swappable/mockable when no key is configured. |

## C. Repository structure

```
aasha-setu/
├── frontend/                 Next.js PWA (citizen app + responder dashboard)
│   ├── src/app/               routes (App Router)
│   ├── src/components/
│   ├── src/hooks/
│   ├── src/lib/                api client, map helpers
│   ├── src/services/
│   └── src/types/
├── backend/
│   ├── app/
│   │   ├── api/                 routers: health, auth, incidents, sos, alerts, ...
│   │   ├── models/               SQLAlchemy models (1 file per table)
│   │   ├── schemas/              Pydantic request/response schemas
│   │   ├── services/             business logic called by routers
│   │   ├── ai/                   CV / NLP / STT service wrappers
│   │   ├── gis/                  PostGIS spatial query helpers
│   │   ├── risk/                 risk-score engine
│   │   ├── routing/               safe-route engine (OSRM client + fallback)
│   │   ├── websocket/             connection manager, event broadcast
│   │   └── core/                  security (JWT/password), auth deps
│   ├── alembic/                  migrations
│   └── tests/
├── ml/
│   ├── computer_vision/          YOLO wrapper, class-label mapping
│   ├── nlp/                      report-extraction prompts/schemas
│   ├── risk_model/                 risk formula, weight config
│   └── datasets/                  sample/demo images for the CV pipeline
├── simulator/                    disaster-simulation scripts/panel backend
├── docs/                         this file, ER diagram, API notes
├── docker-compose.yml
├── .env.example
└── README.md
```

## D. Database schema (ER overview)

```
users ──< incidents (reported_by) ──< incident_evidence
   │           │
   │           └──< rescue_operations >── responders
   │
   └── (role: citizen | responder | admin)

alerts            (independent — external feed, spatially tagged via affected_area)
shelters          (independent — queried by proximity to incidents/citizens)
resources         (independent — allocated to rescue_operations by the decision engine)
risk_zones        (independent grid/polygons — scored by the risk engine, read by the map)
```

Key relationships:
- `incidents.reported_by → users.id` (nullable — mesh/anonymous reports may arrive without a known user)
- `incident_evidence.incident_id → incidents.id` (1 incident : many evidence items — image/video/audio can each add evidence)
- `rescue_operations.incident_id → incidents.id`, `rescue_operations.responder_id → responders.id`
- `alerts`, `shelters`, `resources`, `risk_zones` are spatially joined at query time (PostGIS `ST_DWithin`/`ST_Intersects`), not via foreign keys — that's the point of using PostGIS instead of a rigid relational join.

Every location-bearing table carries both plain `latitude`/`longitude` floats (simple to read/display) **and** a PostGIS `Geometry(POINT/POLYGON/LINESTRING, 4326)` column (kept in sync by the service layer) with a GIST index — floats for convenience, geometry for real spatial queries.

Full DDL: `backend/alembic/versions/0001_initial_schema.py`. Models: `backend/app/models/`.

## E. API architecture

```
Next.js  →  FastAPI router (validates via Pydantic schema)
              →  app/core/deps (auth + role check)
              →  app/services/* (business logic)
                    →  app/gis / app/risk / app/routing / app/ai (as needed)
                    →  SQLAlchemy session → PostgreSQL/PostGIS
              ←  Pydantic response schema
```

Routers stay thin: parse/validate input, enforce auth, call a service function,
shape the response. All spatial math, priority scoring, and allocation logic
lives in `app/services` / `app/gis` / `app/risk` / `app/routing` — never in
route handlers, and never in the frontend.

Phase 1 implements `GET /health`, `POST /auth/register`, `POST /auth/login`,
`GET /auth/me`. Later phases add the full surface listed in the brief
(`/incidents`, `/sos`, `/reports`, `/alerts`, `/risk-map`, `/shelters`,
`/responders`, `/resources`, `/rescue-operations`, `/analytics`,
`/ai/analyze-image`, `/ai/analyze-report`, `/routes/safe`, `WS /ws`) — each
as its own module under `app/api`, registered in `app/api/router.py`.
Auto-generated OpenAPI docs live at `/docs` once the server is running.

## F. AI architecture

```
Input (image / voice / text)
        │
        ▼
AI processing (app/ai/*)
  CV → YOLO detection + confidence per object
  STT → transcript
  NLP → structured extraction (type, victims, urgency, hazard) + confidence
        │
        ▼
Confidence scoring (combines AI confidence + corroborating signals:
  nearby reports, weather, risk-zone score, report count)
        │
        ▼
Decision engine (app/risk, app/services/priority)
  risk score · incident priority · resource/route recommendation
        │
        ▼
Human verification (command-center operator: approve / reject)
        │
        ▼
Operational action (rescue_operations row created/updated)
```

AI never writes directly to an operational action — every AI output lands as
a `confidence`-scored *recommendation* attached to an incident, explicitly
labeled "AI-generated — requires human verification" in the UI, and a human
(the command-center operator) is the one who flips an incident from
`ai_verified`/`human_review` to `verified` and triggers dispatch.

## G. 48-hour hackathon build plan

Prioritized per the brief's MUST/SHOULD/NICE tiers, mapped to hours:

**Hours 0–6 — Foundation (done in this session)**
Repo structure, FastAPI skeleton, PostGIS schema + migration, JWT auth
(register/login/me), Next.js skeleton, docker-compose, `.env.example`.

**Hours 6–16 — Core data + map (MUST HAVE)**
Incident/SOS/report APIs, PostGIS-backed proximity queries, MapLibre map
with incidents/shelters layers, risk-zone grid + risk formula (static weights
first).

**Hours 16–24 — Simulator + AI (MUST HAVE)**
Disaster simulator panel (rainfall/water level/SOS-count sliders driving
risk scores and synthetic incidents), YOLO image analysis endpoint
(`/ai/analyze-image`), wired into incident evidence.

**Hours 24–32 — Verification + priority + allocation (MUST HAVE)**
Confidence scoring, human verify/reject flow, priority formula, nearest
available responder + safe route (OSRM, with fallback), responder dashboard
queue.

**Hours 32–40 — Realtime + polish (SHOULD HAVE)**
WebSocket live updates, AI situation summary (LLM, clearly labeled
"requires human verification"), shelter intelligence, basic analytics
charts.

**Hours 40–46 — Resilience features (SHOULD/NICE, time-permitting)**
Offline mode (local queue + sync banner), mesh-relay prototype (simulated
multi-hop SOS forwarding), drone-feed simulation.

**Hours 46–48 — Demo rehearsal**
Run the full scenario end-to-end (§28 of the brief) twice, fix rough edges,
prepare the "before/after" recovery view.

If time runs out, cut from the bottom of this list first — mesh and drone
are explicitly NICE TO HAVE and must never block the MUST HAVE path.
