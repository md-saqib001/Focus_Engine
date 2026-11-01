"""
face_detector.py — Production Face Detector (MediaPipe Tasks API).

Privacy guarantee:
  - Frames are passed in as NumPy arrays and are NEVER stored, written to
    disk, or transmitted. Only numeric outputs leave this class.
  - No cv2.imshow, cv2.imwrite, or VideoWriter calls exist anywhere here.

Confidence note:
  MediaPipe's FaceLandmarker (Tasks API) does NOT expose a per-detection
  confidence score in its result object. Unlike object-detection models that
  return bounding-box scores, Face Mesh/Landmarker is a landmark regression
  model: once the face is found and tracked, it refines 478 point positions
  directly — there is no single probability attached to the final output.

  The thresholds you configure (min_face_detection_confidence,
  min_face_presence_confidence, min_tracking_confidence) are *gating*
  thresholds used internally by the pipeline; they are not surfaced to the
  caller.

  We therefore use `landmark_count` as the practical proxy:
    - 0   → no face detected
    - 478 → full detection including iris landmarks (refine_landmarks=True)
    - A value between 1–477 is theoretically possible during edge frames but
      rarely observed in practice; treat it as a partial/low-confidence hit.
"""

import os
import urllib.request
from dataclasses import dataclass
from typing import Optional

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision


import sys
import tempfile

# ---------------------------------------------------------------------------
# Model path — sits next to this file, git-ignored via *.task
# ---------------------------------------------------------------------------
if getattr(sys, "frozen", False):
    _MODEL_PATH = os.path.join(
        os.path.dirname(sys.executable), "face_landmarker.task"
    )
else:
    _MODEL_PATH = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "face_landmarker.task"
    )

_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
)


def _ensure_model(path: str = _MODEL_PATH) -> str:
    """Download the model file if not already cached. Returns path."""
    if os.path.exists(path):
        return path

    print(f"[FaceDetector] Downloading face landmarker model (~6 MB)...", flush=True)
    try:
        urllib.request.urlretrieve(_MODEL_URL, path)
        print(f"[FaceDetector] Model cached at: {path}", flush=True)
        return path
    except Exception as err:
        # Fallback to writeable system temp folder if directory is read-only
        temp_path = os.path.join(tempfile.gettempdir(), "face_landmarker.task")
        if os.path.exists(temp_path):
            print(f"[FaceDetector] Using cached model from temp: {temp_path}", flush=True)
            return temp_path
        print(f"[FaceDetector] Write failed for default path ({err}). Downloading to temp: {temp_path}", flush=True)
        urllib.request.urlretrieve(_MODEL_URL, temp_path)
        print(f"[FaceDetector] Model cached at temp: {temp_path}", flush=True)
        return temp_path


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------
@dataclass
class FaceDetectionResult:
    face_present: bool
    """True if at least one face was detected in this frame."""

    landmark_count: int
    """
    Number of landmarks returned for the first detected face.
    Used as the confidence proxy (see module docstring).
      0   → no face
      478 → full detection (face mesh + iris, refine_landmarks=True)
    """

    confidence: float
    """
    Normalised proxy confidence in [0.0, 1.0].
    Computed as landmark_count / 478.0 so downstream consumers have a
    familiar 0–1 range without knowing the raw landmark count.
    0.0 when no face is present.
    """

    raw_landmarks: Optional[list] = None
    """
    The raw NormalizedLandmark list for the first detected face.
    Used for head pose estimation.
    """


# ---------------------------------------------------------------------------
# FaceDetector
# ---------------------------------------------------------------------------
class FaceDetector:
    """
    Wraps MediaPipe FaceLandmarker for headless, production use.

    Usage:
        detector = FaceDetector()
        result = detector.process_frame(bgr_frame)
        detector.close()

    Or as a context manager:
        with FaceDetector() as detector:
            result = detector.process_frame(bgr_frame)
    """

    # Total expected landmarks when refine_landmarks=True (468 face + 10 iris)
    MAX_LANDMARKS = 478

    def __init__(
        self,
        min_detection_confidence: float = 0.5,
        min_presence_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5,
        max_num_faces: int = 1,
    ) -> None:
        model_path = _ensure_model()

        base_opts = mp_python.BaseOptions(model_asset_path=model_path)
        options = mp_vision.FaceLandmarkerOptions(
            base_options=base_opts,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=False,
            num_faces=max_num_faces,
            min_face_detection_confidence=min_detection_confidence,
            min_face_presence_confidence=min_presence_confidence,
            min_tracking_confidence=min_tracking_confidence,
            # IMAGE mode: synchronous, per-frame — simplest for our loop
            running_mode=mp_vision.RunningMode.IMAGE,
        )
        self._landmarker = mp_vision.FaceLandmarker.create_from_options(options)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def process_frame(self, bgr_frame) -> FaceDetectionResult:
        """
        Detect face landmarks in a single BGR OpenCV frame.

        The frame is converted to RGB in-memory for MediaPipe, processed,
        and the intermediate array is immediately discarded — no storage.

        Parameters
        ----------
        bgr_frame : np.ndarray
            A BGR image as returned by cv2.VideoCapture.read().

        Returns
        -------
        FaceDetectionResult
            Numeric output only. Never contains image data.
        """
        # BGR → RGB (required by MediaPipe); the copy is temporary
        rgb = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        # rgb goes out of scope here; GC can reclaim it immediately

        result = self._landmarker.detect(mp_image)

        if not result.face_landmarks:
            return FaceDetectionResult(
                face_present=False,
                landmark_count=0,
                confidence=0.0,
            )

        # Use the first detected face (max_num_faces=1 by default)
        landmarks = result.face_landmarks[0]
        landmark_count = len(landmarks)
        confidence = round(landmark_count / self.MAX_LANDMARKS, 4)

        return FaceDetectionResult(
            face_present=True,
            landmark_count=landmark_count,
            confidence=confidence,
            raw_landmarks=landmarks
        )

    def close(self) -> None:
        """Release the MediaPipe landmarker and free model resources."""
        if self._landmarker is not None:
            self._landmarker.close()
            self._landmarker = None

    # Context-manager support
    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
