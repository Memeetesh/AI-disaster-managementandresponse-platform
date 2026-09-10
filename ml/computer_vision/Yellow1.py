"""
ESP32-CAM Yellow Waypoint Detection System
===========================================

Pipeline:
    ESP32 MJPEG stream -> requests -> JPEG extraction -> cv2.imdecode
        -> resize -> HSV (adaptive S/V thresholds) -> mask
        -> morphology -> contours -> polygon/solidity/aspect filtering
        -> temporal tracking (multi-frame confirmation) -> display

Designed so that YOLO-based robot detection and path planning can be
plugged in later without restructuring anything (see RobotDetector,
Waypoint, RobotState, and the "FUTURE PIPELINE STAGES" section in main()).

Controls:
    q  - quit
    t  - toggle the live-tuning trackbar window
"""

import time
import threading
from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Dict

import cv2
import numpy as np
import requests


# =========================================================================
# CONFIGURATION  (everything you'd want to tune lives here)
# =========================================================================

STREAM_URL = "http://192.168.31.169:81/stream"

FRAME_WIDTH = 640
FRAME_HEIGHT = 480

SHOW_TRACKBARS = True  # live-tunable window; press 't' to toggle at runtime
DEBUG_STREAM = True    # print frame-decode diagnostics to the terminal

CFG: Dict = {
    # ---- Hue: kept reasonably wide, since hue is fairly lighting-stable ----
    "hue_min": 18,
    "hue_max": 40,

    # ---- Saturation / Value: BASE requirement, adapted per-frame below ----
    "sat_min_base": 90,
    "val_min_base": 90,
    "sat_max": 255,
    "val_max": 255,

    # ---- Adaptive S/V compensation for changing lighting ----
    # Real requirement each frame = base * (median_brightness / 128),
    # clamped between floor and ceiling. This is what lets the same
    # config work whether the room is bright or dim, without you having
    # to re-tune HSV every time the lighting changes.
    "use_adaptive_sv": True,
    "adaptive_sat_floor": 55,
    "adaptive_val_floor": 55,
    "adaptive_sat_ceil": 150,
    "adaptive_val_ceil": 150,

    # ---- Optional local-contrast normalization (helps with shadows) ----
    "use_clahe": False,
    "clahe_clip_limit": 2.0,
    "clahe_tile_grid": 8,

    # ---- Morphology (cleans the mask before contour extraction) ----
    "morph_open_k": 5,
    "morph_close_k": 9,
    "morph_open_iter": 1,
    "morph_close_iter": 2,

    # ---- Shape filtering (this is what actually rejects fake yellow) ----
    "min_area": 700,          # px^2, reject small noise speckles
    "max_area": 60000,        # px^2, reject huge blown-out regions
    "min_solidity": 0.85,     # contour_area / convex_hull_area
                               # rejects concave / blobby shapes (reflections,
                               # shadows bleeding into background, etc.)
    "min_extent": 0.55,       # contour_area / bounding_rect_area
                               # rejects thin slivers / L-shapes
    "aspect_ratio_max": 3.0,  # normalized so ratio is always >= 1.0
                               # (long_side / short_side of minAreaRect)
    "poly_epsilon_factor": 0.03,  # approxPolyDP tolerance, as % of perimeter
    "poly_vertex_min": 4,
    "poly_vertex_max": 6,     # allow slight rounding / compression artifacts

    # ---- Temporal filtering (multi-frame confirmation) ----
    # A raw per-frame detection is only "tentative". It must be seen
    # near the same location for several frames before we trust it as
    # a real waypoint. This is what kills flickering reflections/shadows
    # that a single-frame filter can't distinguish from the real box.
    "max_match_distance": 60,     # px, centroid distance to call it "same" object
    "min_confirm_hits": 4,        # consecutive-ish hits needed to confirm
    "max_misses_before_drop": 8,  # frames a track can go unseen before dropping
}


# =========================================================================
# MJPEG STREAM READER
# =========================================================================

class MJPEGStream:
    """
    Pulls MJPEG frames from the ESP32-CAM in a background thread and always
    exposes only the *latest* decoded frame. This avoids the classic
    "processing falls behind the stream and lag builds up" problem: we
    never process a backlog, only ever the most recent frame available.
    """

    def __init__(self, url: str, timeout: float = 5.0):
        self.url = url
        self.timeout = timeout
        self._latest_frame: Optional[np.ndarray] = None
        self._lock = threading.Lock()
        self._stop = False
        self._thread = threading.Thread(target=self._reader_loop, daemon=True)

    def start(self) -> "MJPEGStream":
        self._thread.start()
        return self

    def _reader_loop(self):
        header_key = b"Content-Length:"
        frame_count = 0

        while not self._stop:
            try:
                resp = requests.get(self.url, stream=True, timeout=self.timeout)
                if resp.status_code != 200:
                    print(f"[MJPEGStream] HTTP {resp.status_code} from {self.url}")
                    time.sleep(1.0)
                    continue

                buf = b""
                for chunk in resp.iter_content(chunk_size=4096):
                    if self._stop:
                        break
                    if not chunk:
                        continue
                    buf += chunk

                    # Parse the actual multipart structure using the
                    # Content-Length header rather than sniffing raw JPEG
                    # markers. Marker-sniffing (searching for FFD8/FFD9)
                    # breaks if the JPEG contains an embedded EXIF
                    # thumbnail with its own FFD8/FFD9 pair (common on
                    # OV3660) -- it desyncs the buffer on the first such
                    # frame and every frame after silently fails to
                    # decode, which looks exactly like a frozen feed.
                    while True:
                        idx = buf.find(header_key)
                        if idx == -1:
                            if len(buf) > 2_000_000:
                                buf = buf[-65536:]  # avoid unbounded growth
                            break

                        line_end = buf.find(b"\r\n", idx)
                        header_end = buf.find(b"\r\n\r\n", idx)
                        if line_end == -1 or header_end == -1:
                            break  # header not fully received yet

                        try:
                            content_length = int(buf[idx + len(header_key):line_end].strip())
                        except ValueError:
                            buf = buf[header_end + 4:]
                            continue

                        jpeg_start = header_end + 4
                        jpeg_end = jpeg_start + content_length
                        if len(buf) < jpeg_end:
                            break  # full image not received yet, wait for more chunks

                        jpg = buf[jpeg_start:jpeg_end]
                        frame = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)
                        if frame is not None:
                            with self._lock:
                                self._latest_frame = frame
                            frame_count += 1
                            if DEBUG_STREAM and frame_count % 30 == 0:
                                print(f"[MJPEGStream] {frame_count} frames decoded so far")
                        elif DEBUG_STREAM:
                            print(f"[MJPEGStream] got {content_length} bytes but imdecode failed")

                        buf = buf[jpeg_end:]
            except Exception as e:
                print(f"[MJPEGStream] connection error: {e}. Retrying in 1s...")
                time.sleep(1.0)

    def read(self) -> Optional[np.ndarray]:
        with self._lock:
            if self._latest_frame is None:
                return None
            return self._latest_frame.copy()

    def stop(self):
        self._stop = True


# =========================================================================
# YELLOW MASK CONSTRUCTION
# =========================================================================

def build_yellow_mask(frame: np.ndarray, cfg: Dict) -> Tuple[np.ndarray, np.ndarray]:
    """
    Returns (binary_mask, hsv_frame).

    Key idea: hue range stays fixed and reasonably wide, but the
    saturation/value minimums are computed adaptively from the frame's
    own brightness, so bright rooms and dim rooms don't need different
    hand-tuned constants.
    """
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

    if cfg["use_clahe"]:
        h, s, v = cv2.split(hsv)
        clahe = cv2.createCLAHE(
            clipLimit=cfg["clahe_clip_limit"],
            tileGridSize=(cfg["clahe_tile_grid"], cfg["clahe_tile_grid"]),
        )
        v = clahe.apply(v)
        hsv = cv2.merge([h, s, v])

    if cfg["use_adaptive_sv"]:
        median_v = float(np.median(hsv[:, :, 2]))
        brightness_factor = median_v / 128.0
        sat_min = int(
            np.clip(
                cfg["sat_min_base"] * brightness_factor,
                cfg["adaptive_sat_floor"],
                cfg["adaptive_sat_ceil"],
            )
        )
        val_min = int(
            np.clip(
                cfg["val_min_base"] * brightness_factor,
                cfg["adaptive_val_floor"],
                cfg["adaptive_val_ceil"],
            )
        )
    else:
        sat_min = cfg["sat_min_base"]
        val_min = cfg["val_min_base"]

    lower = np.array([cfg["hue_min"], sat_min, val_min])
    upper = np.array([cfg["hue_max"], cfg["sat_max"], cfg["val_max"]])
    mask = cv2.inRange(hsv, lower, upper)

    open_k = max(1, cfg["morph_open_k"])
    close_k = max(1, cfg["morph_close_k"])
    open_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (open_k, open_k))
    close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_k, close_k))

    mask = cv2.morphologyEx(
        mask, cv2.MORPH_OPEN, open_kernel, iterations=cfg["morph_open_iter"]
    )
    mask = cv2.morphologyEx(
        mask, cv2.MORPH_CLOSE, close_kernel, iterations=cfg["morph_close_iter"]
    )

    return mask, hsv


# =========================================================================
# SHAPE / GEOMETRY FILTERING  (this is what rejects fake yellow)
# =========================================================================

@dataclass
class RawDetection:
    center: Tuple[float, float]
    box_points: np.ndarray  # 4x2 rotated-rect corner points
    area: float


def find_yellow_candidates(mask: np.ndarray, cfg: Dict) -> List[RawDetection]:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    results: List[RawDetection] = []

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < cfg["min_area"] or area > cfg["max_area"]:
            continue

        # --- Polygon approximation: real rectangles collapse to ~4 verts ---
        peri = cv2.arcLength(cnt, True)
        if peri <= 0:
            continue
        approx = cv2.approxPolyDP(cnt, cfg["poly_epsilon_factor"] * peri, True)
        if not (cfg["poly_vertex_min"] <= len(approx) <= cfg["poly_vertex_max"]):
            continue

        # --- Solidity: rejects concave / blobby shapes (reflections etc.) ---
        hull = cv2.convexHull(cnt)
        hull_area = cv2.contourArea(hull)
        if hull_area <= 0:
            continue
        solidity = area / hull_area
        if solidity < cfg["min_solidity"]:
            continue

        # --- Extent: rejects thin slivers / stray L-shaped noise ---
        x, y, w, h = cv2.boundingRect(cnt)
        rect_area = w * h
        if rect_area <= 0:
            continue
        extent = area / rect_area
        if extent < cfg["min_extent"]:
            continue

        # --- Aspect ratio via rotated rect: works regardless of rotation ---
        rot_rect = cv2.minAreaRect(cnt)
        (rw, rh) = rot_rect[1]
        if rw <= 0 or rh <= 0:
            continue
        long_side, short_side = max(rw, rh), min(rw, rh)
        aspect_ratio = long_side / short_side
        if aspect_ratio > cfg["aspect_ratio_max"]:
            continue

        box_points = cv2.boxPoints(rot_rect).astype(np.int32)
        M = cv2.moments(cnt)
        if M["m00"] == 0:
            continue
        cx = M["m10"] / M["m00"]
        cy = M["m01"] / M["m00"]

        results.append(RawDetection(center=(cx, cy), box_points=box_points, area=area))

    return results


# =========================================================================
# TEMPORAL TRACKING  (multi-frame confirmation)
# =========================================================================

@dataclass
class WaypointTrack:
    id: int
    center: Tuple[float, float]
    box_points: np.ndarray
    hits: int = 1
    misses: int = 0
    confirmed: bool = False


class WaypointTracker:
    """
    Simple greedy nearest-centroid tracker. A raw detection only becomes a
    trusted waypoint after being seen near the same location for several
    frames (min_confirm_hits). Tracks that stop being seen are dropped
    after max_misses_before_drop frames of absence.
    """

    def __init__(self, cfg: Dict):
        self.cfg = cfg
        self.tracks: List[WaypointTrack] = []
        self._next_id = 0

    def update(self, detections: List[RawDetection]):
        unmatched_dets = list(range(len(detections)))
        unmatched_tracks = list(range(len(self.tracks)))

        # Build all (track, detection) distance pairs, then greedily
        # assign the closest pairs first.
        pairs = []
        for ti in unmatched_tracks:
            for di in unmatched_dets:
                d = _dist(self.tracks[ti].center, detections[di].center)
                if d <= self.cfg["max_match_distance"]:
                    pairs.append((d, ti, di))
        pairs.sort(key=lambda p: p[0])

        matched_tracks = set()
        matched_dets = set()
        for d, ti, di in pairs:
            if ti in matched_tracks or di in matched_dets:
                continue
            track = self.tracks[ti]
            det = detections[di]
            track.center = det.center
            track.box_points = det.box_points
            track.hits += 1
            track.misses = 0
            if track.hits >= self.cfg["min_confirm_hits"]:
                track.confirmed = True
            matched_tracks.add(ti)
            matched_dets.add(di)

        # Unmatched existing tracks: increment miss counter, drop if stale
        surviving_tracks = []
        for ti, track in enumerate(self.tracks):
            if ti not in matched_tracks:
                track.misses += 1
                if track.misses > self.cfg["max_misses_before_drop"]:
                    continue  # drop
            surviving_tracks.append(track)
        self.tracks = surviving_tracks

        # Unmatched detections: start new tentative tracks
        for di, det in enumerate(detections):
            if di not in matched_dets:
                self.tracks.append(
                    WaypointTrack(
                        id=self._next_id,
                        center=det.center,
                        box_points=det.box_points,
                    )
                )
                self._next_id += 1

    def get_confirmed(self) -> List[WaypointTrack]:
        return [t for t in self.tracks if t.confirmed]


def _dist(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    return float(np.hypot(a[0] - b[0], a[1] - b[1]))


# =========================================================================
# DRAWING
# =========================================================================

def draw_results(frame: np.ndarray, tracks: List[WaypointTrack]):
    for t in tracks:
        color = (0, 255, 0) if t.confirmed else (0, 165, 255)  # green vs orange
        cv2.drawContours(frame, [t.box_points], 0, color, 2)
        cx, cy = int(t.center[0]), int(t.center[1])
        cv2.circle(frame, (cx, cy), 4, color, -1)
        label = f"WP{t.id}" if t.confirmed else f"WP{t.id}?"
        cv2.putText(
            frame, f"{label} ({cx},{cy})", (cx + 8, cy - 8),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2,
        )


# =========================================================================
# LIVE TUNING TRACKBARS
# =========================================================================

_TRACKBAR_WINDOW = "Tuning"


def create_trackbars(cfg: Dict):
    cv2.namedWindow(_TRACKBAR_WINDOW, cv2.WINDOW_NORMAL)
    cv2.createTrackbar("Hue Min", _TRACKBAR_WINDOW, cfg["hue_min"], 179, lambda v: None)
    cv2.createTrackbar("Hue Max", _TRACKBAR_WINDOW, cfg["hue_max"], 179, lambda v: None)
    cv2.createTrackbar("Sat Min Base", _TRACKBAR_WINDOW, cfg["sat_min_base"], 255, lambda v: None)
    cv2.createTrackbar("Val Min Base", _TRACKBAR_WINDOW, cfg["val_min_base"], 255, lambda v: None)
    cv2.createTrackbar("Min Area (x10)", _TRACKBAR_WINDOW, cfg["min_area"] // 10, 2000, lambda v: None)
    cv2.createTrackbar("Min Solidity (x100)", _TRACKBAR_WINDOW, int(cfg["min_solidity"] * 100), 100, lambda v: None)
    cv2.createTrackbar("Max Aspect (x10)", _TRACKBAR_WINDOW, int(cfg["aspect_ratio_max"] * 10), 100, lambda v: None)


def read_trackbars(cfg: Dict):
    cfg["hue_min"] = cv2.getTrackbarPos("Hue Min", _TRACKBAR_WINDOW)
    cfg["hue_max"] = cv2.getTrackbarPos("Hue Max", _TRACKBAR_WINDOW)
    cfg["sat_min_base"] = cv2.getTrackbarPos("Sat Min Base", _TRACKBAR_WINDOW)
    cfg["val_min_base"] = cv2.getTrackbarPos("Val Min Base", _TRACKBAR_WINDOW)
    cfg["min_area"] = max(1, cv2.getTrackbarPos("Min Area (x10)", _TRACKBAR_WINDOW) * 10)
    cfg["min_solidity"] = cv2.getTrackbarPos("Min Solidity (x100)", _TRACKBAR_WINDOW) / 100.0
    cfg["aspect_ratio_max"] = max(1.0, cv2.getTrackbarPos("Max Aspect (x10)", _TRACKBAR_WINDOW) / 10.0)


# =========================================================================
# FUTURE EXTENSION POINTS (YOLO robot detection + path planning)
# =========================================================================
# These are intentionally left as stubs. Wire them into main() later
# without touching the waypoint-detection code above.

@dataclass
class Waypoint:
    id: int
    x: float
    y: float


@dataclass
class RobotState:
    x: float
    y: float
    heading_deg: Optional[float] = None


def get_confirmed_waypoints(tracker: WaypointTracker) -> List[Waypoint]:
    return [Waypoint(id=t.id, x=t.center[0], y=t.center[1]) for t in tracker.get_confirmed()]


class RobotDetector:
    """
    Placeholder for future YOLO-based robot detection.

    Later:
        from ultralytics import YOLO
        self.model = YOLO(model_path)
        ... run self.model(frame) each loop, extract the robot's bbox
        center (and ideally orientation) as a RobotState.
    """

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path
        self.model = None  # TODO: load YOLO model here

    def detect(self, frame: np.ndarray) -> Optional[RobotState]:
        # TODO: run YOLO inference here
        return None


def find_nearest_waypoint(robot: RobotState, waypoints: List[Waypoint]) -> Optional[Waypoint]:
    if not waypoints:
        return None
    return min(waypoints, key=lambda w: np.hypot(w.x - robot.x, w.y - robot.y))


# =========================================================================
# MAIN LOOP
# =========================================================================

def main():
    stream = MJPEGStream(STREAM_URL).start()
    tracker = WaypointTracker(CFG)
    robot_detector = RobotDetector()  # unused for now, wired in later

    trackbars_visible = SHOW_TRACKBARS
    if trackbars_visible:
        create_trackbars(CFG)

    print(f"Connecting to {STREAM_URL} ... press 'q' to quit, 't' to toggle tuning window.")

    prev_time = time.time()
    fps = 0.0

    while True:
        frame = stream.read()
        if frame is None:
            time.sleep(0.01)
            continue

        frame = cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT))

        if trackbars_visible:
            read_trackbars(CFG)

        # ---- Yellow waypoint detection pipeline ----
        mask, _hsv = build_yellow_mask(frame, CFG)
        raw_detections = find_yellow_candidates(mask, CFG)
        tracker.update(raw_detections)
        confirmed_waypoints = get_confirmed_waypoints(tracker)

        # ---- FUTURE PIPELINE STAGES (not active yet) ----
        # robot_state = robot_detector.detect(frame)
        # if robot_state is not None and confirmed_waypoints:
        #     target = find_nearest_waypoint(robot_state, confirmed_waypoints)
        #     # ... compute heading, send ESP-NOW command ...

        display = frame.copy()
        draw_results(display, tracker.tracks)

        now = time.time()
        dt = now - prev_time
        prev_time = now
        if dt > 0:
            inst_fps = 1.0 / dt
            fps = inst_fps if fps == 0 else (0.9 * fps + 0.1 * inst_fps)

        cv2.putText(display, f"FPS: {fps:.1f}", (10, 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.putText(display, f"Waypoints: {len(confirmed_waypoints)}", (10, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        cv2.imshow("Camera Feed", display)
        cv2.imshow("Yellow Mask", mask)

        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break
        elif key == ord("t"):
            trackbars_visible = not trackbars_visible
            if trackbars_visible:
                create_trackbars(CFG)
            else:
                cv2.destroyWindow(_TRACKBAR_WINDOW)

    stream.stop()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()