# DRISHTI — Citizen Android app

Native Android client that replicates the web citizen app
(`frontend/src/app/(citizen)`), backed by the same FastAPI API
(`backend/`). Full plan: [`../docs/ANDROID_APP_PLAN.md`](../docs/ANDROID_APP_PLAN.md).

**Status: Phase 0 — foundation.** Compiles to a 5-tab shell (Home ·
Reports · SOS · Family · Support) with the ported theme and a trend
sparkline. No networking yet — that is Phase 1.

## Prerequisites

- **Android Studio Ladybug (2024.2.1) or newer** — bundles JDK 17 and Gradle.
- Android SDK Platform 35 + Build-Tools (Android Studio installs these on
  first sync).

This module was scaffolded without a local Android toolchain, so the Gradle
wrapper JAR is not committed. Get it one of two ways:

- **Android Studio:** `File > Open` → select this `android/` folder → let it
  sync. It regenerates `gradle/wrapper/gradle-wrapper.jar` and `gradlew`
  automatically.
- **CLI with a system Gradle 8.11+:** `cd android && gradle wrapper`

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
├── core/ui/theme/             palette ported from the web Tailwind config
├── core/ui/component/         Sparkline, HeroBanner, PlaceholderScreen
└── feature/
    ├── navigation/            AppRoot, NavHost, bottom bar, tab enum
    ├── home/ reports/ emergency/ family/ support/   one screen each
```

Next: **Phase 1** adds the Retrofit/OkHttp/Hilt networking layer, the DTO
port of `frontend/src/types/index.ts`, encrypted token storage, and the
login/register flow.
