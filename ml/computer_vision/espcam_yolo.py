import requests
import cv2
import numpy as np
import time

from ultralytics import YOLO


# ============================================================
# ESP32-CAM ADDRESS
# ============================================================

ESP32_URL = "http://192.168.31.169:81/stream"


# ============================================================
# LOAD YOLO MODEL
# ============================================================

print("Loading YOLO model...")

model = YOLO("yolo11n.pt")

print("YOLO model loaded!")


# ============================================================
# DETECTION LOOP
# ============================================================

while True:

    try:

        # ----------------------------------------------------
        # Request one fresh image from ESP32-CAM
        # ----------------------------------------------------

        print("\nRequesting image...")

        response = requests.get(
            ESP32_URL,
            timeout=10
        )

        if response.status_code != 200:

            print(
                "Failed to get image:",
                response.status_code
            )

            time.sleep(1)
            continue


        # ----------------------------------------------------
        # Convert JPEG bytes to OpenCV image
        # ----------------------------------------------------

        image_array = np.frombuffer(
            response.content,
            np.uint8
        )

        frame = cv2.imdecode(
            image_array,
            cv2.IMREAD_COLOR
        )

        if frame is None:

            print("Failed to decode image")

            continue


        # ----------------------------------------------------
        # RUN YOLO
        # ----------------------------------------------------

        results = model(
            frame,
            classes=[0],
            verbose=False
        )


        # ----------------------------------------------------
        # COUNT PERSONS
        # ----------------------------------------------------

        person_count = 0

        for result in results:

            person_count += len(result.boxes)


        # ----------------------------------------------------
        # PRINT RESULT
        # ----------------------------------------------------

        if person_count > 0:

            print("================================")
            print("PERSON DETECTED!")
            print(
                "Number of persons:",
                person_count
            )
            print("================================")

        else:

            print("No person detected")


        # ----------------------------------------------------
        # Wait before next image
        # ----------------------------------------------------

        time.sleep(1)


    except requests.exceptions.RequestException as e:

        print(
            "ESP32 connection error:",
            e
        )

        time.sleep(2)


    except KeyboardInterrupt:

        print("\nStopping detection...")

        break