# DRISHTI — Native Android App Implementation Plan

A native Android client that replicates the **citizen website** — the
`frontend/src/app/(citizen)` route group of the Next.js PWA — screen for
screen, backed by the **same FastAPI API** (`backend/`) with no rewrite of
server logic. The responder/admin dashboard (`/dashboard`) is explicitly
out of scope; self-registration only ever mints a `citizen` account
(`backend/app/api/auth.py`), so the app never needs operator surfaces.

> Scope note: if "Citizen" here means the US public-safety app
> (citizen.com) rather than our own citizen UI, the feature set still maps
> onto what DRISHTI already exposes (live incident map, area alerts, SOS,
> safety check-ins). This plan targets **our** citizen UI + API; deviations
> for the other reading are called out inline as *"Citizen.com parity"*.

---

## A. What we are replicating (web → Android parity map)

| Web route | Android screen | Backend endpoints | Notes |
|---|---|---|---|
| `/login`, `/register` | `AuthScreen` (login / register tabs) | `POST /auth/login`, `POST /auth/register`, `GET /auth/me` | phone + password → JWT; role forced to `citizen` server-side |
| `(citizen)/` (Home) | `HomeScreen` | `GET /risk-map`, `GET /alerts`, `GET /shelters/nearest`, `GET /weather/{rainfall,flood,cyclone,landslide}`, `GET /places/nearby?kind=shelter` | hero + live alert banner + 4 risk cards w/ sparklines + nearby shelters + river-discharge card |
| `(citizen)/emergency` | `EmergencyScreen` + `SosSheet` | `POST /sos` (multipart), `POST /check-in`, `GET /check-in/me`, `GET /places/nearby?kind=hospital`, `GET /shelters/nearest` | big SOS button (hold-to-send), quick actions (dial 112, nearest hospital/shelter, offline map), "I am Safe" |
| `(citizen)/report` | `ReportScreen` + `ReportConfirmationScreen` | `POST /reports` (multipart), `GET /incidents/{id}` | type picker, people affected, description, photo + voice note; confirmation reflects live status |
| `(citizen)/reports` | `MyReportsScreen` | `GET /incidents` (citizen sees only own rows) | list w/ severity + status badges, evidence thumbnails from `/uploads` |
| `(citizen)/family` | `FamilyScreen` + `AddMemberSheet` + `MemberLocationScreen` | `GET/POST/DELETE /family`, `GET /family/requests`, `POST /family/requests/{id}/respond`, `GET/PUT /family/location-sharing`, `POST /family/location-sharing/ping` | circle w/ derived status, invites, opt-in location sharing + periodic ping, member last-location on map |
| `(citizen)/support` | `SupportScreen` (3 tabs) | `GET /alerts`, `POST /chat/support` | Authority Messages = live `/alerts`; Lost & Found + Emotional Support are **sample-data-only** on web — keep as static/local for parity, mark clearly |
| app-wide realtime | `RealtimeService` (SSE) | `GET /stream` (Bearer header) | events: `incident.*`, `risk.updated`, `shelter.updated`, `alert.*`, `family.updated` (citizen-visible subset per `backend/app/api/stream.py`) |
| bottom nav | `BottomBar` | — | Home · Reports · **SOS** · Family · Support (mirrors `mobileNavItems` in `layout.tsx`) |

**Data contracts** are already enumerated in `frontend/src/types/index.ts`
and the `frontend/src/lib/*-api.ts` clients — port these verbatim as Kotlin
`@Serializable` data classes. Field names are snake_case on the wire.

---

## B. Technology decisions

| Layer | Choice | Why |
|---|---|---|
| Language / UI | **Kotlin + Jetpack Compose + Material 3** | "Native Android" as asked; Compose maps cleanly onto the web's component tree and state hooks |
| Min / target SDK | `minSdk 26` (Android 8.0), `targetSdk 36`, `compileSdk 36` | 26 unlocks `java.time`, notification channels, foreground-service APIs; ~99% device reach |
| Architecture | MVVM + unidirectional data flow; `:app` + feature-free single module to start, split later | one `ViewModel` per screen exposing a `StateFlow<UiState>`, mirroring each web page's `useQuery`/`useMutation` set |
| DI | **Hilt** | standard, low ceremony |
| Networking | **Retrofit + OkHttp + kotlinx.serialization** (`retrofit2-kotlinx-serialization-converter`) | one `ApiService` interface = the union of `frontend/src/lib/*-api.ts`; OkHttp interceptor attaches `Authorization: Bearer` exactly like `apiFetch` |
| Multipart | Retrofit `@Multipart` for `/sos` and `/reports` | field names `latitude`, `longitude`, `people_affected`, `type`, `description`, `image`, `audio` (see `incidents-api.ts`) |
| Realtime | **OkHttp-SSE** (`com.squareup.okhttp3:okhttp-sse`) | native `EventSource` can't set headers; web uses `@microsoft/fetch-event-source` for the same reason. Parse `event:`/`data:` frames, dispatch to repositories |
| Async | Coroutines + Flow | |
| Local cache | **Room** (incidents, alerts, family, shelters snapshots) + **DataStore** (token, settings, last known location) | offline reads + a resilience story the web only fakes |
| Offline write queue | **WorkManager** | queue SOS / reports when offline, retry with backoff, surface a "pending sync" banner (web `docs/ARCHITECTURE.md` §"Offline mode" is a NICE-TO-HAVE we can actually deliver) |
| Secure storage | DataStore + **Tink / Jetpack Security** (`EncryptedFile`/`EncryptedSharedPreferences`) for the JWT | web keeps it in `localStorage`; native should encrypt at rest |
| Location | **Play Services Location** (`FusedLocationProviderClient`) | replaces `navigator.geolocation`; `useLocation.ts` semantics = one high-accuracy fix, then cache |
| Family location sharing | **foreground service** + periodic ping while sharing is ON | web can only ping "while the page is open"; native does it properly with a persistent notification and user-visible control |
| Maps | **MapLibre Native Android SDK** (`org.maplibre.gl:android-sdk`) | web uses MapLibre GL + OSM, no API key — same raster/vector style, risk-zone polygons from `/risk-map` GeoJSON, shelter/incident pins |
| Static maps / member location | MapLibre snapshot **or** `geo:`/Google Maps intent | web embeds an OSM iframe + "Open in Maps" link; native gets a real map or an intent hand-off |
| Images | **Coil** | evidence thumbnails from `${API_ORIGIN}${image_url}` (strip `/api/v1`, as `reports/page.tsx` does) |
| Charts / sparklines | hand-drawn Compose `Canvas` (the `trend: number[]` arrays are tiny) or **Vico** | matches `LineChart` in `components/citizen/Charts.tsx` |
| Media capture | **CameraX** (photo) + `MediaRecorder` (voice note) + **Photo Picker** (`ACTION_PICK_IMAGES`) | web uses `<input type=file accept=image/*|audio/*>` |
| Push | **Firebase Cloud Messaging** | *new capability, needs a small backend addition* — see §E |
| Navigation | **Navigation Compose**, single-activity | routes ≈ web routes; deep links for push payloads (`drishti://incident/{id}`, `drishti://alerts`) |
| Config | Gradle **build flavors** `dev` / `prod` → `BASE_URL` in `BuildConfig` (`.../api/v1/`) | replaces `NEXT_PUBLIC_API_URL` |
| Testing | JUnit5, Turbine (Flow), MockWebServer (API), Compose UI tests, Paparazzi (screenshot) | |
| Static analysis | ktlint + detekt | |
| CI | GitHub Actions: assemble + lint + unit tests on PR; signed `:app:bundleProdRelease` on tag | |

---

## C. Project structure

New top-level `android/` directory in this monorepo (sibling of
`frontend/` and `backend/`), its own Gradle build:

```
android/
├── settings.gradle.kts
├── gradle/libs.versions.toml            version catalog
├── app/
│   ├── build.gradle.kts                 flavors: dev | prod
│   └── src/main/java/com/drishti/citizen/
│       ├── DrishtiApp.kt                @HiltAndroidApp
│       ├── MainActivity.kt             single-activity host
│       ├── core/
│       │   ├── network/                OkHttp, Retrofit, AuthInterceptor, TokenAuthenticator (401→logout)
│       │   ├── auth/                   SessionManager, EncryptedTokenStore
│       │   ├── realtime/               SseClient, RealtimeEventBus, event models
│       │   ├── location/               LocationProvider, permission helpers
│       │   ├── sync/                   WorkManager workers (SosUploadWorker, ReportUploadWorker)
│       │   ├── notifications/          FCM service, channels, deep-link routing
│       │   ├── media/                  CameraX capture, audio recorder, file cache
│       │   └── ui/                     theme (colors ported from Tailwind palette), shared composables, Sparkline
│       ├── data/
│       │   ├── remote/                 ApiService (Retrofit), DTOs (@Serializable, snake_case)
│       │   ├── local/                  Room DB, DAOs, DataStore
│       │   ├── model/                  domain models
│       │   └── repository/             Auth, Risk, Alerts, Weather, Shelters, Places, Incidents, Family, CheckIn, Chat
│       └── feature/
│           ├── auth/                   AuthScreen + ViewModel
│           ├── home/                   HomeScreen + ViewModel
│           ├── emergency/              EmergencyScreen, SosSheet + ViewModel
│           ├── report/                 ReportScreen, ConfirmationScreen + ViewModel
│           ├── reports/                MyReportsScreen + ViewModel
│           ├── family/                 FamilyScreen, AddMemberSheet, MemberLocationScreen + ViewModel
│           ├── support/               SupportScreen (tabs) + ViewModel
│           └── navigation/            NavHost, routes, BottomBar
└── .github/workflows/android.yml
```

---

## D. API layer — port from `frontend/src/lib`

One `ApiService` Retrofit interface, one DTO file per resource. Direct
translations (path → Kotlin signature):

- **Auth** (`auth-api.ts`): `POST /auth/register {name,phone,email?,password}`,
  `POST /auth/login {phone,password}` → `{access_token, token_type, user}`;
  `GET /auth/me` → `User`.
- **Incidents** (`incidents-api.ts`): `GET /incidents?sort=&limit=`,
  `GET /incidents/{id}`; `@Multipart POST /sos`
  (`latitude, longitude, people_affected, description?, image?, audio?`);
  `@Multipart POST /reports` (adds `type`, `people_affected` optional).
- **Risk** (`risk-api.ts`): `GET /risk-map` → GeoJSON `FeatureCollection`;
  `GET /risk-zones`.
- **Shelters** (`shelters-api.ts`): `GET /shelters`,
  `GET /shelters/nearest?lat&lon&limit`.
- **Alerts** (`alerts-api.ts`): `GET /alerts` → `List<Alert>`.
- **Weather** (`weather-api.ts`): `GET /weather/{rainfall|flood|cyclone|landslide}?lat&lon`.
- **Places** (`places-api.ts`): `GET /places/nearby?lat&lon&kind&radius_km?&limit?`.
- **Check-in** (`checkin-api.ts`): `POST /check-in {status,latitude?,longitude?}`,
  `GET /check-in/me` → `CheckIn?`.
- **Family** (`family-api.ts`): `GET /family?lat&lon`, `POST /family {name,phone,relation?}`,
  `DELETE /family/{id}`, `GET /family/requests`,
  `POST /family/requests/{id}/respond {accept}`,
  `GET /family/location-sharing`, `PUT /family/location-sharing {enabled}`,
  `POST /family/location-sharing/ping {latitude,longitude}`.
- **Chat** (`chat-api.ts`): `POST /chat/support {messages:[{role,content}]}` → `{reply,source}`.

**Error mapping**: replicate `ApiError` from `api.ts` — non-2xx → parse
`{detail}` (string or `[{msg}]`), surface `.message`; 204 → `Unit`; 401 →
`TokenAuthenticator` clears session and routes to `AuthScreen`.

**Realtime cache invalidation**: `realtime.tsx` maps each SSE event to
TanStack-Query key invalidations. Reproduce as a `RealtimeEventBus` that
repositories collect from and re-fetch the matching endpoints:

| SSE event | Refetch |
|---|---|
| `incident.created` / `incident.updated` | `/incidents`, `/incidents/{id}` if open |
| `risk.updated` | `/risk-map` |
| `shelter.updated` | `/shelters`, `/shelters/nearest` |
| `alert.created` / `alert.updated` | `/alerts` |
| `family.updated` | `/family`, `/family/requests` |

On (re)connect, refetch everything realtime-backed once (web:
`invalidateRealtimeQueries`).

---

## E. Backend changes required

The API is reused **as-is** for every screen. The only additions are for
native-only capabilities:

1. **Push (FCM)** — *needed only if we ship notifications (recommended).*
   - `POST /devices` `{fcm_token, platform:"android"}` (auth'd) — upsert a
     `device_tokens` row keyed by `user_id`.
   - `DELETE /devices/{token}` on logout.
   - Server-side: when the event broker (`backend/app/events/broker.py`)
     publishes an event visible to a citizen (`alert.*`, their own
     `incident.*`, `family.updated`), also fan out an FCM data message to
     that user's tokens. ~1 new module (`app/services/push.py`) + a hook in
     the broker. No schema churn beyond one table + migration.
2. **Token lifetime / refresh** — tokens are 24h with no refresh
   (`config.py: ACCESS_TOKEN_EXPIRE_MINUTES`). Acceptable for a demo: app
   treats 401 as "log in again". *Optional:* add `POST /auth/refresh` if we
   want silent re-auth.
3. **CORS** — irrelevant to a native client (no `Origin`); no change.
4. **(Nice) `GET /alerts?lat&lon`** — the web query keys are
   location-tagged but `listAlerts` sends no coords; if we want
   area-filtered alerts on device, add optional params. Not blocking.

Everything else — multipart uploads, SSE with a Bearer header, `/uploads`
static files — already works for a non-browser client.

---

## F. Cross-cutting concerns

- **Session / auth**: `SessionManager` exposes `StateFlow<AuthState>`
  (`Loading` → `SignedOut` / `SignedIn(user)`). On launch: read encrypted
  token, call `GET /auth/me` to validate (mirrors `auth-context.tsx`
  `hydrate()`), drop it on failure. `MainActivity` routes on state.
- **Location**: request `ACCESS_FINE_LOCATION` (+ coarse) with a rationale
  screen. `LocationProvider.currentFix()` = one `getCurrentLocation()` call;
  cache last fix in DataStore so screens render immediately.
  `ACCESS_BACKGROUND_LOCATION` **not** required — family pings run in a
  foreground service while the toggle is on.
- **Realtime lifecycle**: `SseClient` runs in a process-scoped
  `CoroutineScope`, connects when `SignedIn` + network available, retries
  with 3s backoff (web `RETRY_MS`), disconnects on `SignedOut`.
- **Offline & resilience**:
  - Reads: repositories are Room-backed; screens show cached data with a
    stale indicator when offline.
  - Writes: `POST /sos` and `POST /reports` go through WorkManager. SOS is
    expedited + retried aggressively; a persistent notification shows
    "SOS queued — will send when back online".
  - Connectivity banner in the app scaffold.
  - "Offline map" quick action: MapLibre offline region download around the
    user (shelters + nearest hospital as pins) — a real version of the
    web's HTML-file hack (`lib/offline-map.ts`).
- **Media**: capture to app cache dir, attach as `image`/`audio` parts.
  Enforce `MAX_UPLOAD_BYTES` (15 MB, `config.py`) client-side; downscale
  photos.
- **Design system**: port the Tailwind palette
  (`navy`, `danger`, `safe`, `warn`, `support`, `slate2`) into a Compose
  `ColorScheme` + typography; recreate the card / badge / hero-gradient
  look. Dark theme optional (web is light-only).
- **Accessibility**: content descriptions on icon buttons, 48dp touch
  targets, `TalkBack` pass on SOS + Report, dynamic type.
- **Analytics/crash** (optional): Firebase Crashlytics.

---

## G. Phased build plan

Each phase is independently demoable. Estimates assume one developer
familiar with Compose.

### Phase 0 — Foundation (2–3 days)
Gradle project + version catalog + flavors; Hilt; OkHttp/Retrofit/
serialization; `BuildConfig.BASE_URL`; `AuthInterceptor` + `ApiError`
mapping; base theme (palette, typography, `Card`, `Badge`, `HeroGradient`,
`Sparkline`); single-activity `NavHost` + `BottomBar` shell; MockWebServer
harness; CI workflow (assemble + lint + test).

### Phase 1 — Auth & session (2–3 days)
`AuthScreen` (login/register); `EncryptedTokenStore`; `SessionManager`;
`GET /auth/me` hydration; `TokenAuthenticator` 401→logout; routing between
auth and main graphs. **Demo:** register → land on an empty Home.

### Phase 2 — Home (4–5 days)
Location permission + rationale flow; `LocationProvider`; `HomeViewModel`
composing `/risk-map`, `/alerts`, `/weather/*` (×4), `/shelters/nearest`,
`/places/nearby`; 4 risk cards with sparklines + live badge; point-in-
polygon to resolve the user's current risk zone (port `lib/geo.ts`); live
alert banner; nearby-shelters section (app + OSM fallback); river-discharge
card. Room caching for offline read. **Demo:** full Home parity with the
web against a seeded backend.

### Phase 3 — Report & My Reports (3–4 days)
`ReportScreen` (type, people affected, description, photo via Photo Picker/
CameraX, voice note via `MediaRecorder`); `@Multipart POST /reports`;
`ReportConfirmationScreen` polling `GET /incidents/{id}` + SSE patch;
`MyReportsScreen` list with badges + Coil evidence thumbnails. **Demo:**
submit a report with a photo, watch status flip live when a responder
verifies it.

### Phase 4 — Emergency / SOS (3–4 days)
`EmergencyScreen`: hold-to-send SOS button (3s progress ring, port
`SOSModal.tsx`), `@Multipart POST /sos`; quick actions — dial `112`
(`Intent.ACTION_DIAL`), nearest hospital (call/`geo:`), nearest rescue
shelter, offline-map download; "I am Safe" → `POST /check-in`, reflect
`GET /check-in/me`. Wire SOS through WorkManager so it survives a dead
connection. **Demo:** offline SOS queues + auto-sends on reconnect.

### Phase 5 — Family (5–6 days)
`FamilyScreen`: circle list with derived status chips, summary counts,
incoming requests accept/decline; `AddMemberSheet`; remove; location-
sharing toggle backed by a **foreground service** that pings
`POST /family/location-sharing/ping` every ~2 min (web `PING_INTERVAL_MS`)
while ON; `MemberLocationScreen` (MapLibre pin + "Open in Maps" intent).
`refetchInterval` 60s backstop (web parity) + `family.updated` SSE.
**Demo:** two devices/accounts — accept an invite, toggle sharing, see the
other's point and status.

### Phase 6 — Support (2–3 days)
Tabbed screen: **Authority Messages** = live `/alerts` timeline;
**Lost & Found** + **Emotional Support** = ported static/sample content
(clearly labelled "sample data", matching the web); `SupportChat` sheet →
`POST /chat/support` with the Saathi greeting + crisis-fallback copy.
**Demo:** chat round-trips; alerts tab updates live.

### Phase 7 — Realtime hardening (2 days)
`SseClient` reconnection, `RealtimeEventBus`, repository invalidation table
(§D), lifecycle + network awareness, on-reconnect full refetch. **Demo:**
kill/restore network, confirm every screen self-heals.

### Phase 8 — Push notifications (3–4 days, incl. backend)
Backend `POST /devices` + broker→FCM fan-out (§E); Android FCM service,
notification channels (Alerts / My Reports / Family), deep links
(`drishti://alerts`, `drishti://incident/{id}`, `drishti://family`);
`POST_NOTIFICATIONS` runtime permission (Android 13+); token lifecycle on
login/logout/refresh. **Demo:** command center issues an alert → phone
buzzes → tap opens the Support/alerts screen.

### Phase 9 — Polish & release (3–5 days)
Empty/error/loading states across all screens; connectivity + pending-sync
banners; screenshot tests (Paparazzi) for the 7 screens; TalkBack pass;
app icon + splash; Play Console listing, privacy policy (location + media),
data-safety form; signed AAB via CI on tag; internal testing track.

**Rough total:** ~7–8 weeks for one developer, or ~4 weeks parallelised
(Auth+Home / Report+SOS / Family+Support as three tracks after Phase 0).
For a course deadline, Phases 0–4 deliver a convincing, gradeable app;
5–6 complete citizen parity; 7–9 are production hardening.

---

## H. Testing strategy

- **Unit**: repositories (MockWebServer — success, `ApiError` shapes, 401,
  204, network failure), `SessionManager` state machine, risk-zone point-
  in-polygon, sparkline scaling, offline-queue worker logic (Robolectric +
  `WorkManagerTestInitHelper`).
- **ViewModel**: Turbine on each `UiState` flow — loading → data → error,
  SSE-driven refresh, optimistic mutation + rollback.
- **UI**: Compose tests for SOS hold-to-send, Report form validation +
  submit, Family invite accept/decline, bottom-nav.
- **Screenshot**: Paparazzi per screen in light theme.
- **Contract**: a small test that deserializes recorded backend responses
  (capture from `backend` `/docs` or a seeded run) into the DTOs, so
  server schema drift breaks CI. Re-seed with
  `python -m app.scripts.seed_demo_data` (see `README.md`).
- **Manual E2E**: run `backend` + seed, two accounts, walk the demo
  scenario end to end (report → verify → dispatch visible to citizen;
  SOS; family sharing; live alert).

---

## I. Risks & open decisions

| Item | Recommendation |
|---|---|
| **Native vs cross-platform** | Plan assumes Kotlin/Compose ("native"). If reach matters more than native feel, KMP or Flutter would reuse the DTO/repo layer — say so and this plan's §C/§G restructure. |
| **Map SDK** | MapLibre Native for web parity + no key. Google Maps SDK is faster to integrate if a key is acceptable. |
| **Push in scope?** | Recommended (it's the main thing a native app adds over the PWA) but it's the only item needing backend work. Cut to Phase 8-optional if backend is frozen. |
| **Lost & Found / Emotional Support** | Web ships these as sample data with a visible disclaimer. Match that — do **not** invent a backend. |
| **Family location sharing** | Web only pings while the page is open. Native foreground-service pinging is better UX but adds a persistent notification + a Play data-safety disclosure. Keep it strictly opt-in and mirrored to `PUT /family/location-sharing`. |
| **Token security** | Encrypt at rest (Jetpack Security). Consider certificate pinning for the API host in `prod`. |
| **Offline SOS expectations** | Be explicit in-UI that a queued SOS is *not yet delivered*; never imply responders were notified until the upload succeeds. |
| **Repo layout** | `android/` in this monorepo keeps DTO/enum parity with `frontend/src/types` and `backend/app/models/enums.py` reviewable in one PR. Split to its own repo only if release cadence diverges. |

---

## J. First concrete steps

1. `android/` Gradle scaffold + version catalog + `dev`/`prod` flavors,
   `BASE_URL` → `http://10.0.2.2:8000/api/v1/` (dev emulator) / prod URL.
2. Port `frontend/src/types/index.ts` → `data/remote/dto/*.kt`
   (`@Serializable`, `@SerialName` for snake_case).
3. `ApiService` + OkHttp stack + `AuthInterceptor` + `ApiError`; one
   MockWebServer test proving `GET /auth/me` and the `{detail}` error path.
4. Theme from the Tailwind palette; `NavHost` + `BottomBar` with 5
   placeholder screens.
5. Phase 1 auth end to end against a locally running `backend`.
