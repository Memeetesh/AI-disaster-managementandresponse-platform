# DRISHTI — Citizen Android app

Native Android client that replicates the web citizen app
(`frontend/src/app/(citizen)`), backed by the same FastAPI API
(`backend/`). Full plan: [`../docs/ANDROID_APP_PLAN.md`](../docs/ANDROID_APP_PLAN.md).

**Status: Phase 2 — the live Home screen.**

Phase 1 (auth & session): Retrofit + OkHttp + kotlinx.serialization stack
(Hilt-provided), `AuthInterceptor` + `TokenAuthenticator` (401 → sign-out),
`ApiError`/`ApiErrorParser` for FastAPI's `{detail}` / `[{msg}]` shapes, JWT
in `EncryptedSharedPreferences`, `SessionManager` state machine with
`GET /auth/me` hydration, `AuthScreen` (login/register), `DrishtiRoot` switch.

Phase 2 (Home):

- `LocationProvider` over `FusedLocationProviderClient` — one high-accuracy
  fix, cached in DataStore; runtime permission + rationale card. No
  background location.
- `HomeViewModel` composes `/risk-map`, `/alerts`, `/weather/{rainfall,flood,
  cyclone,landslide}`, `/shelters/nearest`, `/places/nearby` in parallel.
- Ported from the web: `Geo` (haversine + ray-cast point-in-polygon),
  `zoneAt` risk-zone resolution, `Alerts.topAlert`, and the `RiskCards`
  computation (static defaults overlaid with live forecasts / the resolved
  zone; `very_high` → `critical`).
- `HomeScreen` — hero, live alert banner, 4 risk cards with sparklines +
  LIVE badges, nearby shelters (registered + OSM fallback), river-discharge
  card, pull-to-refresh.
- Offline reads: `ResponseCache` (Room, one JSON-snapshot table) behind a
  network-first `cachedResource`; results are `DataResult.Fresh/Stale/Failure`
  and a stale snapshot shows an "offline" note. Cache is wiped on sign-out.

Unit tests (`./gradlew :app:testDevDebugUnitTest`, 32 total): `GeoTest`,
`AlertsTest`, `RiskCardsTest`, `AlertsRepositoryTest` (Fresh/Stale/Failure),
plus the Phase 1 `ApiServiceTest` / `ApiErrorParserTest` / `SessionManagerTest`.

Next: **Phase 3** — Report & My Reports (multipart `POST /reports`, photo +
voice note, `GET /incidents`).

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
│   ├── location/              LocationProvider, LatLon, LastLocationStore (DataStore)
│   ├── geo/                   haversine + point-in-polygon (ports geo.ts)
│   ├── di/                    AppScope, Hilt bindings, Data/Location modules
│   └── ui/theme|component/    palette, Sparkline, HeroBanner, PlaceholderScreen
├── data/
│   ├── model/                 domain models + ports (User, RiskCards, Alerts, zoneAt)
│   ├── remote/                ApiService + DTOs
│   └── repository/            Auth, Risk, Alerts, Weather, Shelters, Places
└── feature/
    ├── root/                  RootViewModel, DrishtiRoot (auth ↔ app switch)
    ├── auth/                  AuthScreen + AuthViewModel
    ├── home/                  HomeScreen + HomeViewModel (live)
    ├── navigation/            AppRoot, NavHost, bottom bar, tab enum
    └── reports/ emergency/ family/ support/   placeholder screens
```

The `dev` flavor talks HTTP to `10.0.2.2:8000`; cleartext for that host is
allowed via `app/src/dev/res/xml/network_security_config.xml`. The `prod`
flavor keeps Android's HTTPS-only default — set the real host in
`app/build.gradle.kts` before a release build.
