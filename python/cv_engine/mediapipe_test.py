"""
mediapipe_test.py — Face Landmarker visualiser (MediaPipe Tasks API, 0.10.x+).
TESTING ONLY. Draws all 478 face + iris landmarks on the live feed.
Prints "Face detected" / "No face" per frame to stdout.

First run downloads face_landmarker.task (~6 MB) and caches it next to
this file. No frames are saved or transmitted — numeric outputs only.

Usage:
    python mediapipe_test.py          # default camera
    python mediapipe_test.py 1        # alternate camera index
Press Q to quit.
"""

import sys
import urllib.request
import os
import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision


# ---------------------------------------------------------------------------
# Model download (cached locally, git-ignored via *.task)
# ---------------------------------------------------------------------------
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
)
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "face_landmarker.task")


def ensure_model() -> str:
    if not os.path.exists(MODEL_PATH):
        print("[mediapipe_test] Downloading face landmarker model (~6 MB)...")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        print(f"[mediapipe_test] Model saved to: {MODEL_PATH}")
    else:
        print(f"[mediapipe_test] Using cached model: {MODEL_PATH}")
    return MODEL_PATH


# ---------------------------------------------------------------------------
# Connection sets from FaceLandmarksConnections
# ---------------------------------------------------------------------------
_CONNECTIONS = mp_vision.FaceLandmarksConnections


def _draw_connections(frame, landmarks, connections, color, thickness=1):
    """Draw a set of landmark connections on the frame (pixel coords)."""
    h, w = frame.shape[:2]
    for conn in connections:
        start = landmarks[conn.start]
        end   = landmarks[conn.end]
        x0, y0 = int(start.x * w), int(start.y * h)
        x1, y1 = int(end.x * w),   int(end.y * h)
        cv2.line(frame, (x0, y0), (x1, y1), color, thickness, cv2.LINE_AA)


def draw_face_mesh(frame, detection_result):
    """Draw tessellation, contours, and irises for all detected faces."""
    for face_landmarks in detection_result.face_landmarks:
        lms = face_landmarks  # list of NormalizedLandmark

        # Tessellation — fine cyan mesh
        _draw_connections(frame, lms, _CONNECTIONS.FACE_LANDMARKS_TESSELATION,
                          color=(0, 180, 180), thickness=1)
        # Contours — brighter green outlines
        _draw_connections(frame, lms, _CONNECTIONS.FACE_LANDMARKS_FACE_OVAL,
                          color=(0, 220, 60), thickness=1)
        _draw_connections(frame, lms, _CONNECTIONS.FACE_LANDMARKS_LEFT_EYE,
                          color=(0, 220, 60), thickness=1)
        _draw_connections(frame, lms, _CONNECTIONS.FACE_LANDMARKS_RIGHT_EYE,
                          color=(0, 220, 60), thickness=1)
        _draw_connections(frame, lms, _CONNECTIONS.FACE_LANDMARKS_LEFT_EYEBROW,
                          color=(0, 220, 60), thickness=1)
        _draw_connections(frame, lms, _CONNECTIONS.FACE_LANDMARKS_RIGHT_EYEBROW,
                          color=(0, 220, 60), thickness=1)
        _draw_connections(frame, lms, _CONNECTIONS.FACE_LANDMARKS_LIPS,
                          color=(0, 200, 255), thickness=1)
        # Irises — bright cyan rings
        _draw_connections(frame, lms, _CONNECTIONS.FACE_LANDMARKS_LEFT_IRIS,
                          color=(0, 220, 240), thickness=2)
        _draw_connections(frame, lms, _CONNECTIONS.FACE_LANDMARKS_RIGHT_IRIS,
                          color=(0, 220, 240), thickness=2)

        # Draw each landmark dot
        h, w = frame.shape[:2]
        for lm in lms:
            cx, cy = int(lm.x * w), int(lm.y * h)
            cv2.circle(frame, (cx, cy), 1, (0, 255, 0), -1)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def run(camera_index: int = 0) -> None:
    model_path = ensure_model()

    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        print(
            f"[mediapipe_test] ERROR: Could not open camera at index {camera_index}.\n"
            "  • Make sure a webcam is connected and drivers are installed.\n"
            "  • On Windows, allow camera access in Privacy settings.\n"
            "  • Try a different index, e.g. python mediapipe_test.py 1",
            file=sys.stderr,
        )
        sys.exit(1)

    # Warm-up read
    ret, _ = cap.read()
    if not ret:
        print("[mediapipe_test] ERROR: Camera opened but first frame unreadable.", file=sys.stderr)
        cap.release()
        sys.exit(1)

    width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"[mediapipe_test] Camera {camera_index} ready at {width}x{height}.")
    print("[mediapipe_test] Initialising FaceLandmarker...")

    base_opts = mp_python.BaseOptions(model_asset_path=model_path)
    options = mp_vision.FaceLandmarkerOptions(
        base_options=base_opts,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
        num_faces=1,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5,
        running_mode=mp_vision.RunningMode.IMAGE,
    )

    print("[mediapipe_test] Ready. Press Q inside the window to quit.\n")
    frame_count = 0

    with mp_vision.FaceLandmarker.create_from_options(options) as landmarker:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                continue

            frame_count += 1

            # BGR → RGB for MediaPipe
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

            result = landmarker.detect(mp_image)

            annotated = frame.copy()

            if result.face_landmarks:
                status_text = f"Face detected ({len(result.face_landmarks)})"
                draw_face_mesh(annotated, result)
            else:
                status_text = "No face"

            print(f"\r[frame {frame_count:05d}] {status_text}        ", end="", flush=True)

            color = (0, 255, 80) if "detected" in status_text else (0, 60, 255)
            cv2.putText(annotated, status_text, (10, 28),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2, cv2.LINE_AA)
            cv2.putText(annotated, f"frame #{frame_count}", (10, 52),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1, cv2.LINE_AA)

            cv2.imshow("Focus Engine — Face Mesh (press Q to quit)", annotated)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                print(f"\n[mediapipe_test] Quit after {frame_count} frames.")
                break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    index = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    run(index)
