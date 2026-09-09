# DRISHTI — Citizen Android app

Native Android client that replicates the web citizen app
(`frontend/src/app/(citizen)`), backed by the same FastAPI API
(`backend/`). Full plan: [`../docs/ANDROID_APP_PLAN.md`](../docs/ANDROID_APP_PLAN.md).

**Status: Phase 7 — realtime hardening.**

- **Phase 1 (auth & session):** Retrofit/OkHttp/kotlinx.serialization stack,
  `AuthInterceptor` + `TokenAuthenticator` (401 → sign-out), `ApiError` for
  FastAPI's `{detail}` / `[{msg}]` shapes, JWT in `EncryptedSharedPreferences`,
  `SessionManager` with `GET /auth/me` hydration, `AuthScreen`, `DrishtiRoot`.
- **Phase 2 (Home):** `LocationProvider` (one fix, DataStore cache) + runtime
  permission; `HomeViewModel` fans out risk-map / alerts / weather×4 /
  shelters / places; ports of `Geo`, `zoneAt`, `Alerts.topAlert`, `RiskCards`;
  `HomeScreen` (hero, alert banner, 4 sparkline risk cards, nearby shelters +
  OSM fallback, river-discharge card, pull-to-refresh); offline reads via
  `ResponseCache` (Room JSON-snapshot) + `cachedResource` →
  `DataResult.Fresh/Stale/Failure`; cache wiped on sign-out.
- **Phase 3 (Report):**
  - `ReportScreen` — type chips, people-affected stepper, description,
    Photo Picker image, `MediaRecorder` voice note (`RECORD_AUDIO`);
    `@Multipart POST /reports` (`MediaPartFactory` turns the picked `Uri` /
    recorded `File` into parts). Inline confirmation polls
    `GET /incidents/{id}` every 5 s until a responder decision.
  - `MyReportsScreen` (real) — `GET /incidents` (citizen-scoped), severity +
    status badges (`Incidents` label/tone maps ported from the web), Coil
    evidence thumbnails (`MediaUrls` strips `/api/v1` for the static mount),
    pull-to-refresh, empty/offline states. Reached via the `report` route
    (not a tab); the app bar shows a back arrow on non-tab routes.
- **Phase 4 (Emergency):**
  - `EmergencyScreen` — red hero, **hold-to-send** SOS button (`pointerInput`
    press/release drives a 3 s progress ring in `EmergencyViewModel`) →
    `@Multipart POST /sos` (CRITICAL server-side). On a network error the SOS
    is handed to **WorkManager** (`SosUploadWorker`, `CONNECTED` constraint,
    linear backoff, expedited + a "SOS queued" foreground notification) and
    auto-sends on reconnect; the dialog is explicit that a queued SOS has
    *not* reached responders.
  - Quick actions — dial `112`, nearest hospital (call `phone` or `geo:`),
    nearest rescue centre (`geo:`), open area map; "I am Safe" →
    `POST /check-in`, reflecting `GET /check-in/me` (cached).
  - Hilt-provided WorkManager (`DrishtiApp : Configuration.Provider`, default
    initializer disabled in the manifest). `POST_NOTIFICATIONS` requested on
    screen entry.
- **Phase 5 (Family):**
  - `FamilyScreen` — navy hero with Safe / Awaiting / Need-help counts,
    incoming-request accept/decline, circle cards (initials avatar,
    `FamilyMembers` status tone/detail-line ports, Call, Remove, and a
    shared-location line → `geo:` intent), inline add-member form,
    empty/offline states, 60 s refetch backstop.
  - **Location sharing** — the toggle calls `PUT /family/location-sharing`
    and starts/stops `LocationSharingService`, a real foreground service
    (`foregroundServiceType="location"`, `FOREGROUND_SERVICE_LOCATION`) that
    `POST /family/location-sharing/ping`s the user's fix every ~2 min with a
    persistent notification. Re-attaches on app restart if the server says
    sharing is still on. The web can only ping while the page is open.
- **Phase 6 (Support):**
  - `SupportScreen` — a 3-tab screen (`TabRow`). **Authority Messages** is
    the live `/alerts` timeline (reuses `AlertsRepository`, severity chips,
    60 s poll backstop, offline note). **Lost & Found** and **Emotional
    Support** are `SupportSamples` — static content ported from the web,
    clearly labelled "sample data", never wired to an API.
  - **Talk to Saathi** — a `ModalBottomSheet` chat; `SupportViewModel` seeds
    the greeting, sends only real turns to `POST /chat/support`, and shows
    the crisis-fallback copy (112 / helplines) if the call fails.
  - `core/util/Intents.kt` — shared `dialNumber` / `openLocationOnMap`
    (Emergency and Family refactored onto it).
- **Phase 7 (Realtime):**
  - `SseClient` — one OkHttp `EventSource` to `GET /stream` (`okhttp-sse`,
    read-timeout 0, Bearer via the shared interceptor), driven by
    `SessionManager.state` (connect on `SignedIn`, cancel on `SignedOut`).
    3 s reconnect backoff; a `ConnectivityManager` default-network callback
    reconnects immediately when the network returns. Lives process-scoped
    (injected into `DrishtiApp`).
  - `RealtimeEvent.fromSse` maps the citizen-visible events
    (`incident.*` / `rescue.updated` → `IncidentChanged(id)`, `risk.updated`,
    `shelter.updated`, `alert.*`, `family.updated`); operator events dropped.
    `RealtimeBus` fans them out (`events` SharedFlow + `connected` StateFlow).
  - Home / My Reports / Family / Support / Report ViewModels collect the bus
    and silently reload on the matching event and on `Reconnected` (a full
    refetch). Family & Support keep a 120 s poll as a backstop only.
  - `AppRoot` shows a slim "Reconnecting to live updates…" strip (3 s
    delayed) while the stream is down.

Unit tests (`./gradlew :app:testDevDebugUnitTest`, 62 total): adds
`RealtimeEventTest` (SSE mapping) and `RealtimeBusTest`.

Next: **Phase 8** — push notifications (FCM; needs a small backend addition
for `POST /devices` + broker fan-out).

## Prerequisites

- **Android Studio Ladybug (2024.2.1) or newer** — bundles JDK 17 and Gradle.
- Android SDK Platform 35 + Build-Tools (Android Studio installs these on
  first sync).

The Gradle wrapper (`gradlew` + `gradle/wrapper/gradle-wrapper.jar`, Gradle
8.13) is present — build from the CLI or open the folder in Android Studio.

## Build & run

1. Start the backend and seed it (see the repo `README.md`):
   ```bash
   cd ../backend && source venv/bin/activate
   uvicorn app.main:app --reload
   python -m app.scripts.seed_demo_data
   ```
2. In Android Studio pick the **`devDebug`** build variant.
3. Run on an emulator. The `dev` flavor points `BASE_URL` at
   `http://10.0.2.2:8000/api/v1/` — `10.0.2.2` is how the emulator reaches
   `localhost` on your machine. On a physical device, change it to your
   machine's LAN IP in `app/build.gradle.kts`.

Command line (after the wrapper exists):
```bash
./gradlew :app:assembleDevDebug
./gradlew :app:installDevDebug
```

## Layout

```
app/src/main/java/com/drishti/citizen/
├── DrishtiApp.kt              @HiltAndroidApp
├── MainActivity.kt            single-activity Compose host
├── core/
│   ├── auth/                  TokenStore, SessionManager, AuthState, SessionEvents
│   ├── network/               ApiService stack, ApiError(+Parser), DataResult, cachedResource
│   ├── cache/                 ResponseCache (Room JSON-snapshot store)
│   ├── location/              LocationProvider, LatLon, LocationUiState, LastLocationStore
│   ├── geo/                   haversine + point-in-polygon (ports geo.ts)
│   ├── media/                 MediaPartFactory (Uri→part), VoiceRecorder
│   ├── sos/                   SosUploadWorker, SosQueue, SosNotifications
│   ├── familyshare/           LocationSharingService (foreground)
│   ├── realtime/              SseClient, RealtimeBus, RealtimeEvent
│   ├── util/                  Intents (dial / open-map)
│   ├── di/                    AppScope, Hilt bindings, Data/Location modules
│   └── ui/theme|component/    palette, Sparkline, StatusBadge, HeroBanner
├── data/
│   ├── model/                 ports (RiskCards, Alerts, Incidents, FamilyMembers, SupportSamples, zoneAt)
│   ├── remote/                ApiService + DTOs
│   └── repository/            Auth, Risk, Alerts, Weather, Shelters, Places, Incidents, CheckIn, Family, Chat
└── feature/
    ├── root/                  RootViewModel, DrishtiRoot (auth ↔ app switch)
    ├── auth/                  AuthScreen + AuthViewModel
    ├── home/                  HomeScreen + HomeViewModel (live)
    ├── report/                ReportScreen + ReportViewModel (submit + confirmation)
    ├── reports/               MyReportsScreen + MyReportsViewModel (live)
    ├── emergency/             EmergencyScreen + EmergencyViewModel (SOS + check-in)
    ├── family/                FamilyScreen + FamilyViewModel (circle + sharing)
    ├── support/               SupportScreen + SupportViewModel (alerts + Saathi chat)
    └── navigation/            AppRoot, NavHost, bottom bar, tab enum, report route
```

The `dev` flavor talks HTTP to `10.0.2.2:8000`; cleartext for that host is
allowed via `app/src/dev/res/xml/network_security_config.xml`. The `prod`
flavor keeps Android's HTTPS-only default — set the real host in
`app/build.gradle.kts` before a release build.
