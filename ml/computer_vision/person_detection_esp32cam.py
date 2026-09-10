import cv2
import numpy as np
import requests
import threading
import time

from ultralytics import YOLO


# ============================================================
# SETTINGS
# ============================================================

STREAM_URL = "http://192.168.31.169:81/stream"

# YOLO model — weights/ is git-ignored; ultralytics downloads on first run.
MODEL_PATH = "weights/yolo11n.pt"

# Lower value = more sensitive
# Start with 0.15
CONFIDENCE_THRESHOLD = 0.15

# YOLO inference resolution
YOLO_IMAGE_SIZE = 640

# Display resolution
DISPLAY_WIDTH = 640
DISPLAY_HEIGHT = 480


# ============================================================
# LOAD YOLO MODEL
# ============================================================

print("Loading YOLO model...")

model = YOLO(MODEL_PATH)

print("YOLO model loaded!")
print("Person class only enabled.")


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

        response = None

        while self.running:

            try:

                response = requests.get(
                    self.url,
                    stream=True,
                    timeout=(5, None)
                )

                response.raise_for_status()

                print("Camera connected!")
                print("Receiving live stream...")

                buffer = bytearray()


                for chunk in response.iter_content(
                    chunk_size=4096
                ):

                    if not self.running:

                        break


                    if not chunk:

                        continue


                    # Add new camera data

                    buffer.extend(chunk)


                    # ====================================================
                    # EXTRACT COMPLETE JPEG FRAMES
                    # ====================================================

                    while True:

                        start = buffer.find(
                            b'\xff\xd8'
                        )


                        if start == -1:

                            # Prevent unlimited memory usage

                            if len(buffer) > 1000000:

                                buffer.clear()


                            break


                        end = buffer.find(
                            b'\xff\xd9',
                            start + 2
                        )


                        if end == -1:

                            break


                        # Extract JPEG

                        jpg = buffer[
                            start:end + 2
                        ]


                        # Remove processed data immediately
                        # This helps prevent old frames building up

                        del buffer[:end + 2]


                        # Convert JPEG to numpy

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


                        # ====================================================
                        # STORE ONLY NEWEST FRAME
                        # ====================================================

                        with self.lock:

                            self.frame = new_frame


                # If stream ends, reconnect

                if response is not None:

                    response.close()


            except Exception as e:

                print("Camera connection error:")
                print(e)

                print("Reconnecting in 2 seconds...")

                if response is not None:

                    try:

                        response.close()

                    except:

                        pass


                time.sleep(2)


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

camera = ESP32Camera(
    STREAM_URL
).start()


print("Waiting for first frame...")


# ============================================================
# WAIT FOR FIRST FRAME
# ============================================================

while camera.running:

    frame = camera.read()


    if frame is not None:

        break


    time.sleep(0.1)


print("Live camera started!")
print("Human detection active!")
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


    # ========================================================
    # GET NEWEST CAMERA FRAME
    # ========================================================

    frame = camera.read()


    if frame is None:

        time.sleep(0.001)

        continue


    frame_number += 1


    # ========================================================
    # RESIZE FOR DISPLAY
    # ========================================================

    frame = cv2.resize(
        frame,
        (
            DISPLAY_WIDTH,
            DISPLAY_HEIGHT
        ),
        interpolation=cv2.INTER_LINEAR
    )


    # Copy for drawing

    display_frame = frame.copy()


    # ========================================================
    # YOLO HUMAN DETECTION
    # ========================================================

    results = model.predict(

        source=frame,

        # COCO class 0 = person
        classes=[0],

        # More sensitive detection
        conf=CONFIDENCE_THRESHOLD,

        # Larger inference size
        imgsz=YOLO_IMAGE_SIZE,

        # Remove YOLO terminal spam
        verbose=False
    )


    # ========================================================
    # STORE HUMAN POSITIONS
    # ========================================================

    humans = []


    # ========================================================
    # PROCESS RESULTS
    # ========================================================

    for result in results:


        if result.boxes is None:

            continue


        for box in result.boxes:


            # ------------------------------------------------
            # GET CONFIDENCE
            # ------------------------------------------------

            confidence = float(
                box.conf[0].cpu().numpy()
            )


            # ------------------------------------------------
            # GET CLASS
            # ------------------------------------------------

            class_id = int(
                box.cls[0].cpu().numpy()
            )


            # Only person

            if class_id != 0:

                continue


            # ------------------------------------------------
            # GET BOUNDING BOX
            # ------------------------------------------------

            coordinates = box.xyxy[0].cpu().numpy()


            x1 = int(
                coordinates[0]
            )

            y1 = int(
                coordinates[1]
            )

            x2 = int(
                coordinates[2]
            )

            y2 = int(
                coordinates[3]
            )


            # ------------------------------------------------
            # CLAMP COORDINATES
            # ------------------------------------------------

            x1 = max(
                0,
                min(
                    DISPLAY_WIDTH - 1,
                    x1
                )
            )


            y1 = max(
                0,
                min(
                    DISPLAY_HEIGHT - 1,
                    y1
                )
            )


            x2 = max(
                0,
                min(
                    DISPLAY_WIDTH - 1,
                    x2
                )
            )


            y2 = max(
                0,
                min(
                    DISPLAY_HEIGHT - 1,
                    y2
                )
            )


            # ------------------------------------------------
            # CHECK BOX SIZE
            # ------------------------------------------------

            width = x2 - x1

            height = y2 - y1


            if width <= 5:

                continue


            if height <= 5:

                continue


            # ------------------------------------------------
            # CALCULATE CENTER
            # ------------------------------------------------

            cx = (
                x1 + x2
            ) // 2


            cy = (
                y1 + y2
            ) // 2


            # Store human

            humans.append({

                "x1": x1,

                "y1": y1,

                "x2": x2,

                "y2": y2,

                "cx": cx,

                "cy": cy,

                "confidence": confidence

            })


    # ========================================================
    # DRAW HUMAN BOXES
    # ========================================================

    for human in humans:


        x1 = human["x1"]

        y1 = human["y1"]

        x2 = human["x2"]

        y2 = human["y2"]

        cx = human["cx"]

        cy = human["cy"]

        confidence = human["confidence"]


        # ----------------------------------------------------
        # DRAW BOX
        # ----------------------------------------------------

        cv2.rectangle(

            display_frame,

            (
                x1,
                y1
            ),

            (
                x2,
                y2
            ),

            (
                0,
                255,
                0
            ),

            2
        )


        # ----------------------------------------------------
        # DRAW CENTER
        # ----------------------------------------------------

        cv2.circle(

            display_frame,

            (
                cx,
                cy
            ),

            6,

            (
                0,
                0,
                255
            ),

            -1
        )


        # ----------------------------------------------------
        # DRAW PERSON LABEL
        # ----------------------------------------------------

        label = (
            f"PERSON {confidence * 100:.1f}%"
        )


        cv2.putText(

            display_frame,

            label,

            (
                x1,
                max(
                    y1 - 10,
                    25
                )
            ),

            cv2.FONT_HERSHEY_SIMPLEX,

            0.6,

            (
                0,
                255,
                0
            ),

            2
        )


        # ----------------------------------------------------
        # DRAW CENTER COORDINATES
        # ----------------------------------------------------

        coordinate_text = (
            f"Center: {cx}, {cy}"
        )


        cv2.putText(

            display_frame,

            coordinate_text,

            (
                x1,
                min(
                    y2 + 20,
                    DISPLAY_HEIGHT - 10
                )
            ),

            cv2.FONT_HERSHEY_SIMPLEX,

            0.45,

            (
                0,
                255,
                255
            ),

            1
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

        f"Humans: {len(humans)}",

        (
            20,
            35
        ),

        cv2.FONT_HERSHEY_SIMPLEX,

        0.7,

        (
            255,
            0,
            0
        ),

        2
    )


    cv2.putText(

        display_frame,

        f"FPS: {fps:.1f}",

        (
            20,
            65
        ),

        cv2.FONT_HERSHEY_SIMPLEX,

        0.7,

        (
            255,
            0,
            0
        ),

        2
    )


    cv2.putText(

        display_frame,

        f"Frame: {frame_number}",

        (
            20,
            95
        ),

        cv2.FONT_HERSHEY_SIMPLEX,

        0.7,

        (
            0,
            255,
            0
        ),

        2
    )


    # ========================================================
    # SHOW HUMAN COORDINATES
    # ========================================================

    text_y = 125


    for i, human in enumerate(
        humans
    ):


        cv2.putText(

            display_frame,

            f"Human {i + 1}: ({human['cx']}, {human['cy']})",

            (
                20,
                text_y
            ),

            cv2.FONT_HERSHEY_SIMPLEX,

            0.5,

            (
                255,
                255,
                255
            ),

            1
        )


        text_y += 25


    # ========================================================
    # SHOW CAMERA
    # ========================================================

    cv2.imshow(

        "ESP32 Human Detection",

        display_frame
    )


    # ========================================================
    # KEYBOARD
    # ========================================================

    key = cv2.waitKey(
        1
    ) & 0xFF


    if key == ord("q"):

        break


# ============================================================
# CLEANUP
# ============================================================

print("Stopping camera...")


camera.stop()


cv2.destroyAllWindows()