# Computer-vision prototypes (drone SAR)

Standalone scripts for the **drone search-and-rescue** track: spot people
and coloured ground markers in aerial / camera footage. They run manually
with an OpenCV display window (`cv2.imshow`) and are **not wired into the
FastAPI backend** — that integration (a `POST /ai/analyze-image` endpoint
feeding the command dashboard) comes later.

## Setup

```bash
cd ml/computer_vision
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
```

`weights/` and `samples/` are git-ignored. Ultralytics downloads the YOLO
weights automatically on first run; drop your own test clips in `samples/`.

## Scripts

| File | Input | Model | What it does |
|---|---|---|---|
| `person_detection_video.py` | webcam **or** a video file (`VIDEO_PATH` env, default `samples/Nepal.mp4`) | YOLO11s @ 1280px | Person-only detection tuned for aerial footage — larger input size for small/distant figures, `FRAME_SKIP` for real-time playback. Draws boxes + live person count + FPS. |
| `person_detection_esp32cam.py` | ESP32-CAM MJPEG stream (`STREAM_URL`) | YOLO11n @ 640px | The drone's on-board camera path. Threaded frame grabber, person detection, prints each person's **centre pixel coordinates** (the hand-off point for geolocation later). |
| `yellow_marker_detection.py` | ESP32-CAM MJPEG stream (`STREAM_URL`) | HSV colour threshold (no ML) | Detects yellow ground markers and emits ordered `(x, y)` **waypoints** — a colour-based navigation aid for the drone. |

Edit `STREAM_URL` at the top of the ESP32 scripts to match your camera's
IP. Press `q` to quit any of them.

## Status / next steps

- Prototypes only — hardcoded display loop, no API surface.
- Integration target: a CV service module under `backend/app/ai/` that takes
  one uploaded frame and returns structured detections
  (`[{label, confidence, bbox}]`) for the command dashboard, so the model
  runs server-side and nothing CV-related ships to the citizen app.
- `person_detection_esp32cam.py`'s centre-coordinate output is the natural
  input to a pixel→GPS projection once drone telemetry is available.
