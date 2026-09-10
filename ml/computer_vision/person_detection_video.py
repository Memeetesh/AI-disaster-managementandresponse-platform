import os
import cv2
import time
from ultralytics import YOLO

# ============================================================
# SETTINGS
# ============================================================

# Weights live in ./weights (git-ignored); ultralytics downloads on first run.
MODEL_PATH = "weights/yolo11s.pt"

# Default test clip in ./samples (git-ignored); override with VIDEO_PATH env var.
VIDEO_PATH = os.environ.get("VIDEO_PATH", "samples/Nepal.mp4")

CONFIDENCE = 0.20

IMG_SIZE = 1280

CAMERA_INDEX = 0

# Process every Nth frame
# 1 = every frame
# 2 = every second frame (recommended)
# 3 = every third frame
FRAME_SKIP = 2


# ============================================================
# LOAD MODEL
# ============================================================

print("Loading YOLO model...")

model = YOLO(MODEL_PATH)

print("Model loaded successfully!")


# ============================================================
# SELECT INPUT
# ============================================================

print("\n======================================")
print("   FAST DRONE HUMAN DETECTION SYSTEM")
print("======================================")
print("1. Use Camera")
print("2. Use Video File")
print("======================================")

choice = input("Enter your choice (1/2): ")


if choice == "1":

    cap = cv2.VideoCapture(CAMERA_INDEX)

elif choice == "2":

    cap = cv2.VideoCapture(VIDEO_PATH)

else:

    print("Invalid choice.")
    exit()


if not cap.isOpened():

    print("ERROR: Could not open video source.")
    exit()


# ============================================================
# VARIABLES
# ============================================================

previous_time = time.time()

frame_count = 0

last_detections = []


# ============================================================
# MAIN LOOP
# ============================================================

while True:

    ret, frame = cap.read()

    if not ret:
        break


    frame_count += 1


    # ========================================================
    # RUN YOLO ONLY ON SELECTED FRAMES
    # ========================================================

    if frame_count % FRAME_SKIP == 0:


        results = model(
            frame,
            conf=CONFIDENCE,
            imgsz=IMG_SIZE,
            classes=[0],      # Person only
            verbose=False
        )


        detections = []


        # ====================================================
        # EXTRACT DETECTIONS
        # ====================================================

        for result in results:

            if result.boxes is None:
                continue


            for box in result.boxes:

                x1, y1, x2, y2 = map(
                    int,
                    box.xyxy[0]
                )


                confidence = float(
                    box.conf[0]
                )


                detections.append(
                    (
                        x1,
                        y1,
                        x2,
                        y2,
                        confidence
                    )
                )


        # Save detections
        last_detections = detections


    # ========================================================
    # USE LAST DETECTIONS ON SKIPPED FRAMES
    # ========================================================

    else:

        detections = last_detections


    # ========================================================
    # DRAW DETECTIONS
    # ========================================================

    human_count = len(detections)


    for detection in detections:

        x1, y1, x2, y2, confidence = detection


        cv2.rectangle(
            frame,
            (x1, y1),
            (x2, y2),
            (0, 255, 0),
            2
        )


        label = f"Person {confidence:.2f}"


        cv2.putText(
            frame,
            label,
            (x1, max(20, y1 - 10)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 0),
            2
        )


    # ========================================================
    # FPS
    # ========================================================

    current_time = time.time()

    fps = 1 / (
        current_time - previous_time
    )

    previous_time = current_time


    # ========================================================
    # DISPLAY INFORMATION
    # ========================================================

    cv2.putText(
        frame,
        f"Humans: {human_count}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 255, 0),
        2
    )


    cv2.putText(
        frame,
        f"FPS: {fps:.1f}",
        (20, 80),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 0),
        2
    )


    cv2.imshow(
        "Fast Drone Human Detection",
        frame
    )


    key = cv2.waitKey(1) & 0xFF


    if key == ord("q"):
        break


# ============================================================
# CLEANUP
# ============================================================

cap.release()

cv2.destroyAllWindows()

print("Program closed.")