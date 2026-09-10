import cv2
import numpy as np
import requests
import threading
import time


# ============================================================
# ESP32 CAMERA STREAM
# ============================================================

STREAM_URL = "http://192.168.31.169:81/stream"


# ============================================================
# YELLOW DETECTION SETTINGS
# ============================================================

# Wider but still reasonably selective yellow HSV range
LOWER_YELLOW = np.array([15, 70, 70])
UPPER_YELLOW = np.array([42, 255, 255])

# Area limits
MIN_AREA = 100
MAX_AREA = 100000

# Minimum bounding-box size
MIN_WIDTH = 8
MIN_HEIGHT = 8

# Shape limits
MIN_ASPECT_RATIO = 0.2
MAX_ASPECT_RATIO = 5.0


# ============================================================
# ESP32 MJPEG CAMERA CLASS
# ============================================================

class ESP32Camera:

    def __init__(self, url):
        self.url = url
        self.frame = None
        self.running = True
        self.lock = threading.Lock()


    def start(self):

        thread = threading.Thread(
            target=self.update,
            daemon=True
        )

        thread.start()

        return self


    def update(self):

        print("Connecting to ESP32 camera...")

        try:

            response = requests.get(
                self.url,
                stream=True,
                timeout=(5, None)
            )

            response.raise_for_status()

            print("Camera connected!")
            print("Receiving live stream...")

        except Exception as e:

            print("Camera connection error:")
            print(e)

            self.running = False
            return


        buffer = bytearray()


        try:

            for chunk in response.iter_content(
                chunk_size=4096
            ):

                if not self.running:
                    break

                if not chunk:
                    continue


                # Add received camera data
                buffer.extend(chunk)


                # ------------------------------------------------
                # Extract complete JPEG frames
                # ------------------------------------------------

                while True:

                    start = buffer.find(b'\xff\xd8')

                    if start == -1:

                        # Prevent the buffer growing forever
                        if len(buffer) > 1000000:
                            buffer.clear()

                        break


                    end = buffer.find(
                        b'\xff\xd9',
                        start + 2
                    )


                    if end == -1:
                        break


                    # Extract JPEG frame
                    jpg = buffer[start:end + 2]


                    # Remove processed bytes
                    del buffer[:end + 2]


                    # Convert JPEG bytes
                    image_array = np.frombuffer(
                        jpg,
                        dtype=np.uint8
                    )


                    # Decode image
                    new_frame = cv2.imdecode(
                        image_array,
                        cv2.IMREAD_COLOR
                    )


                    if new_frame is None:
                        continue


                    # Store newest frame only
                    with self.lock:
                        self.frame = new_frame.copy()


        except Exception as e:

            print("Stream error:")
            print(e)


        finally:

            response.close()


    def read(self):

        with self.lock:

            if self.frame is None:
                return None

            return self.frame.copy()


    def stop(self):
        self.running = False


# ============================================================
# START CAMERA
# ============================================================

camera = ESP32Camera(STREAM_URL).start()

print("Waiting for first frame...")


# ============================================================
# WAIT FOR CAMERA
# ============================================================

while camera.running:

    frame = camera.read()

    if frame is not None:
        break

    time.sleep(0.1)


if not camera.running:

    print("Camera connection failed.")

    exit()


print("Live camera started!")
print("Press Q to quit.")


# ============================================================
# VARIABLES
# ============================================================

previous_time = time.time()
frame_number = 0


# ============================================================
# MAIN LOOP
# ============================================================

while True:


    # --------------------------------------------------------
    # GET NEWEST FRAME
    # --------------------------------------------------------

    frame = camera.read()

    if frame is None:
        time.sleep(0.001)
        continue


    frame_number += 1


    # --------------------------------------------------------
    # RESIZE FOR PROCESSING
    # --------------------------------------------------------

    frame = cv2.resize(
        frame,
        (640, 480)
    )


    # Copy for drawing
    display_frame = frame.copy()


    # ========================================================
    # CONVERT BGR TO HSV
    # ========================================================

    hsv = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2HSV
    )


    # ========================================================
    # CREATE YELLOW MASK
    # ========================================================

    mask = cv2.inRange(
        hsv,
        LOWER_YELLOW,
        UPPER_YELLOW
    )


    # ========================================================
    # MORPHOLOGICAL FILTERING
    # ========================================================

    kernel = np.ones(
        (3, 3),
        np.uint8
    )


    # Remove isolated noise
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        kernel,
        iterations=1
    )


    # Fill small holes in yellow objects
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        kernel,
        iterations=2
    )


    # ========================================================
    # FIND CONTOURS
    # ========================================================

    contours, _ = cv2.findContours(
        mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )


    # ========================================================
    # WAYPOINT LIST
    # ========================================================

    waypoints = []


    # ========================================================
    # PROCESS DETECTED YELLOW OBJECTS
    # ========================================================

    for contour in contours:


        # ----------------------------------------------------
        # AREA
        # ----------------------------------------------------

        area = cv2.contourArea(contour)


        if area < MIN_AREA:
            continue


        if area > MAX_AREA:
            continue


        # ----------------------------------------------------
        # BOUNDING BOX
        # ----------------------------------------------------

        x, y, w, h = cv2.boundingRect(
            contour
        )


        # ----------------------------------------------------
        # SIZE FILTER
        # ----------------------------------------------------

        if w < MIN_WIDTH:
            continue

        if h < MIN_HEIGHT:
            continue


        # ----------------------------------------------------
        # ASPECT RATIO FILTER
        # ----------------------------------------------------

        aspect_ratio = w / float(h)


        if aspect_ratio < MIN_ASPECT_RATIO:
            continue


        if aspect_ratio > MAX_ASPECT_RATIO:
            continue


        # ----------------------------------------------------
        # CENTER
        # ----------------------------------------------------

        cx = x + w // 2
        cy = y + h // 2


        # Store waypoint
        waypoints.append(
            (cx, cy)
        )


        # ----------------------------------------------------
        # DRAW BOUNDING BOX
        # ----------------------------------------------------

        cv2.rectangle(
            display_frame,
            (x, y),
            (x + w, y + h),
            (0, 255, 0),
            2
        )


        # ----------------------------------------------------
        # DRAW CENTER
        # ----------------------------------------------------

        cv2.circle(
            display_frame,
            (cx, cy),
            6,
            (0, 0, 255),
            -1
        )


        # ----------------------------------------------------
        # DRAW LABEL
        # ----------------------------------------------------

        cv2.putText(
            display_frame,
            "YELLOW WAYPOINT",
            (x, max(y - 10, 20)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (0, 255, 0),
            2
        )


    # ========================================================
    # SORT WAYPOINTS
    # ========================================================

    waypoints.sort(
        key=lambda point: (
            point[0],
            point[1]
        )
    )


    # ========================================================
    # CALCULATE FPS
    # ========================================================

    current_time = time.time()

    fps = 1 / max(
        current_time - previous_time,
        0.0001
    )

    previous_time = current_time


    # ========================================================
    # DISPLAY INFORMATION
    # ========================================================

    cv2.putText(
        display_frame,
        f"Yellow Waypoints: {len(waypoints)}",
        (20, 35),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 0, 0),
        2
    )


    cv2.putText(
        display_frame,
        f"FPS: {fps:.1f}",
        (20, 65),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 0, 0),
        2
    )


    cv2.putText(
        display_frame,
        f"Frame: {frame_number}",
        (20, 95),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (0, 255, 0),
        2
    )


    # ========================================================
    # SHOW WAYPOINT COORDINATES
    # ========================================================

    text_y = 125

    for i, point in enumerate(waypoints):

        cv2.putText(
            display_frame,
            f"WP {i + 1}: {point}",
            (20, text_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),
            1
        )

        text_y += 25


    # ========================================================
    # DISPLAY WINDOWS
    # ========================================================

    cv2.imshow(
        "ESP32 Live Camera",
        display_frame
    )

    cv2.imshow(
        "Yellow Mask",
        mask
    )


    # ========================================================
    # KEYBOARD CONTROL
    # ========================================================

    key = cv2.waitKey(1) & 0xFF


    if key == ord("q"):

        break


# ============================================================
# CLEANUP
# ============================================================

print("Stopping camera...")

camera.stop()

cv2.destroyAllWindows()