# NLP / LLM prototypes

**`gemini_situation_summary.js`** — a standalone Node.js prototype (raw
`http` server, not Express) exploring the "AI situation summary" concept
from the spec: given weather/flood/seismic telemetry for a lat/lon, it
prompts Gemini (`gemini-2.5-flash`, `GEMINI_API_KEY` env var) for a
structured `{risk_level, headline, actionable_warnings}` JSON response,
exposed at `POST /api/v1/analyze-location`.

> Note: `gemini-2.5-flash` on the `v1beta` endpoint now 404s for new keys.
> The backend chat service (`backend/app/services/chat.py`) uses
> `gemini-3.6-flash` on `/v1/` with an `x-goog-api-key` header — copy that
> setup if you revive this prototype.

**Incomplete as committed** — `runAIAgent` calls `fetchWeather`,
`fetchFlood`, and `fetchSeismic`, but none of the three are defined in this
file (the comment above them says "keep the existing ... functions here",
implying they existed in a version that wasn't saved). Running this as-is
will throw `ReferenceError` on the first request. Left as originally
written rather than fixed here — whoever picks this up needs to either
paste those three functions back in or wire it into the real weather
service instead (`backend/app/services/weather.py` already has working
rainfall/flood/cyclone/landslide fetchers with provider-down fallback —
likely a better source than rebuilding these standalone).

Not wired into the FastAPI backend or the frontend. If this direction is
pursued, the natural integration point is a `POST /ai/analyze-report`
endpoint in `backend/app/api/` (per the spec's API list) that calls an LLM
service module the same way `app/ai/` (once it exists, per Phase 5) calls
a CV model — never called directly from the frontend, so the API key never
leaves the server.
