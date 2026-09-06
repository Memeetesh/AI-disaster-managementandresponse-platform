# Computer Vision prototypes

Early, standalone YOLO person-detection scripts — run manually against a
webcam or video file with `cv2.imshow`, not yet wired into the backend.
They're the starting point for the `/ai/analyze-image` pipeline
(`backend/app/ai/`), which instead analyzes a single uploaded incident
photo and returns structured detections over the API — no display window,
no live video loop.

- **`human_detection.py`** — baseline: YOLOv8n, webcam or a video file,
  detects and boxes people only. Known issue: the video-file branch
  references an undefined `URL` variable and a hardcoded local path
  (`/Users/tanshunishad/Desktop/SIH/video.mp4`) — fix both before running
  option 2.
- **`human_detection_fast_drone.py`** — tuned for aerial/drone footage:
  YOLO11s (more accurate than nano) at a larger 1280px input size for
  small, distant figures, with frame-skipping for real-time playback.
  Also has a hardcoded local video path
  (`/Users/tanshunishad/Desktop/SIH/Nepal.mp4`) to update before running.

Both require `pip install ultralytics opencv-python` (not in
`backend/requirements.txt` — that's a separate, lighter dependency set for
the FastAPI service; see `backend/app/ai/` once it lands).
