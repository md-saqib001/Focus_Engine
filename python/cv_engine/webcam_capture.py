"""
webcam_capture.py — Lightweight webcam capture wrapper.

Responsible for owning the cv2.VideoCapture lifecycle:
  - start()      opens the device
  - get_frame()  returns the latest BGR frame or None on failure
  - stop()       releases the device (LED turns off)

No frames are stored internally. get_frame() returns a single fresh read
on every call; callers must process it immediately and not hold references.
"""

import cv2
from typing import Optional
import numpy as np


class WebcamCapture:
    """
    Thin RAII wrapper around cv2.VideoCapture.

    Designed for use in a single-threaded polling loop. If you need
    multi-threaded capture in the future, promote get_frame() to run in a
    background thread and guard _cap with a threading.Lock.

    Usage:
        cam = WebcamCapture(camera_index=0)
        cam.start()
        try:
            frame = cam.get_frame()   # None if camera not ready
            if frame is not None:
                ...
        finally:
            cam.stop()

    Or as a context manager:
        with WebcamCapture() as cam:
            frame = cam.get_frame()
    """

    def __init__(self, camera_index: int = 0) -> None:
        self._index: int = camera_index
        self._cap: Optional[cv2.VideoCapture] = None
        self._width: int = 0
        self._height: int = 0
        self._fps: float = 0.0

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> bool:
        """
        Open the camera device.

        Returns True on success, False if the camera could not be opened
        (e.g. no webcam connected, access denied). Does NOT raise.
        """
        cap = cv2.VideoCapture(self._index)
        if not cap.isOpened():
            print(
                f"[WebcamCapture] WARNING: Could not open camera index {self._index}.",
                flush=True,
            )
            cap.release()
            return False

        # Warm-up read — some drivers need one frame before CAP_PROP_* are
        # populated correctly.
        ret, _ = cap.read()
        if not ret:
            print(
                "[WebcamCapture] WARNING: Camera opened but warm-up read failed.",
                flush=True,
            )
            cap.release()
            return False

        self._cap = cap
        self._width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self._height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self._fps    = cap.get(cv2.CAP_PROP_FPS)

        print(
            f"[WebcamCapture] Camera {self._index} opened: "
            f"{self._width}x{self._height} @ {self._fps:.1f} fps",
            flush=True,
        )
        return True

    def stop(self) -> None:
        """
        Release the camera device and turn off the hardware LED.
        Safe to call multiple times.
        """
        if self._cap is not None:
            self._cap.release()
            self._cap = None
            print(f"[WebcamCapture] Camera {self._index} released.", flush=True)

    # ------------------------------------------------------------------
    # Frame access
    # ------------------------------------------------------------------

    def get_frame(self) -> Optional[np.ndarray]:
        """
        Grab and return the latest frame from the camera.

        Returns
        -------
        np.ndarray | None
            BGR frame on success; None if the camera is not open or a
            read error occurs. The caller should treat None as a transient
            failure and retry on the next tick.
        """
        if self._cap is None or not self._cap.isOpened():
            return None

        ret, frame = self._cap.read()
        if not ret or frame is None:
            return None

        return frame  # caller processes it; no copy stored here

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def is_open(self) -> bool:
        return self._cap is not None and self._cap.isOpened()

    @property
    def resolution(self) -> tuple[int, int]:
        """(width, height) as reported by the driver after start()."""
        return (self._width, self._height)

    @property
    def fps(self) -> float:
        return self._fps

    # ------------------------------------------------------------------
    # Context-manager support
    # ------------------------------------------------------------------

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, *_):
        self.stop()
