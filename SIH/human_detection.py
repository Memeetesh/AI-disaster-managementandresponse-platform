import cv2
import time
from ultralytics import YOLO

# ============================================================
# SETTINGS
# ============================================================

# YOLO model
# YOLO11n is small and fast, good for real-time detection
MODEL_PATH = "yolo11n.pt"

# Minimum confidence for detection
CONFIDENCE = 0.40

# Camera number
CAMERA_INDEX = 0


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
print("       HUMAN DETECTION SYSTEM")
print("======================================")
print("1. Use Camera")
print("2. Use Video File")
print("======================================")

choice = input("Enter your choice (1/2): ")


if choice == "1":

    # --------------------------------------------------------
    # CAMERA
    # --------------------------------------------------------

    print("\nOpening camera...")

    cap = cv2.VideoCapture(CAMERA_INDEX)

    if not cap.isOpened():
        print("ERROR: Could not open camera.")
        exit()

    # Optional camera resolution
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)


elif choice == "2":

    # --------------------------------------------------------
    # VIDEO FILE
    # --------------------------------------------------------

    video_path = "/Users/tanshunishad/Desktop/SIH/video.mp4"

    cap = cv2.VideoCapture(URL if video_path.startswith("https://youtube.com/shorts/FQMZbFgXmo4?si=kL-H4OK7XpctN3yk") else video_path)

    if not cap.isOpened():
        print("ERROR: Could not open video file.")
        exit()


else:

    print("Invalid choice.")
    exit()


# ============================================================
# FPS VARIABLES
# ============================================================

previous_time = 0


# ============================================================
# MAIN LOOP
# ============================================================

while True:

    # Read frame
    ret, frame = cap.read()

    if not ret:
        print("\nVideo finished.")
        break


    # --------------------------------------------------------
    # YOLO DETECTION
    # --------------------------------------------------------

    results = model(
        frame,
        conf=CONFIDENCE,
        verbose=False
    )


    # Number of humans
    human_count = 0


    # --------------------------------------------------------
    # PROCESS DETECTIONS
    # --------------------------------------------------------

    for result in results:

        boxes = result.boxes

        for box in boxes:

            # Class ID
            class_id = int(box.cls[0])

            # COCO class 0 = person
            if class_id != 0:
                continue


            # Confidence
            confidence = float(box.conf[0])


            # Bounding box coordinates
            x1, y1, x2, y2 = map(
                int,
                box.xyxy[0]
            )


            human_count += 1


            # ------------------------------------------------
            # DRAW BOUNDING BOX
            # ------------------------------------------------

            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                (0, 255, 0),
                2
            )


            # ------------------------------------------------
            # LABEL
            # ------------------------------------------------

            label = f"Person {confidence:.2f}"


            cv2.putText(
                frame,
                label,
                (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                2
            )


    # ========================================================
    # FPS CALCULATION
    # ========================================================

    current_time = time.time()

    fps = 1 / (current_time - previous_time) \
        if previous_time != 0 else 0

    previous_time = current_time


    # ========================================================
    # DISPLAY INFORMATION
    # ========================================================

    # Person count
    cv2.putText(
        frame,
        f"Humans: {human_count}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 255, 0),
        2
    )


    # FPS
    cv2.putText(
        frame,
        f"FPS: {fps:.1f}",
        (20, 80),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 0),
        2
    )


    # ========================================================
    # DISPLAY VIDEO
    # ========================================================

    cv2.imshow(
        "Real-Time Human Detection",
        frame
    )


    # ========================================================
    # KEYBOARD CONTROL
    # ========================================================

    # Press Q to quit
    key = cv2.waitKey(1) & 0xFF

    if key == ord("q"):
        break


# ============================================================
# CLEANUP
# ============================================================

cap.release()

cv2.destroyAllWindows()

print("Program closed.")