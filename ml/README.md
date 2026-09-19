# ml/

Research prototypes for Aasha Setu's AI features. **Nothing here is imported by
the deployed app** (`backend/`, `frontend/`) — these are staging grounds for
the pipeline described in `docs/ARCHITECTURE.md` §F.

| Folder | Track | Contents |
|---|---|---|
| `computer_vision/` | Drone search-and-rescue | YOLO person detection (video + ESP32-CAM) and colour-marker waypoint detection. See its README. |
| `nlp/` | AI situation summary | Node.js prototype that prompts Gemini for a structured `{risk_level, headline, actionable_warnings}` from location telemetry. Incomplete as committed. |

Each subfolder manages its own dependencies (`computer_vision/requirements.txt`;
the nlp prototype is plain Node with `fetch`). Model weights and sample media
are git-ignored — see `.gitignore`.
