"""
gaze_test.py — Standalone prototype for testing gaze direction.
"""

import time
import sys
from webcam_capture import WebcamCapture
from face_detector import FaceDetector
from gaze_estimator import GazeEstimator

def run_test():
    print("Starting Gaze Estimator Test...")
    cam = WebcamCapture(0)
    if not cam.start():
        print("Camera failed to start.")
        sys.exit(1)

    print("Look straight ahead. Then shift your eyes left/right.")
    print("Press Ctrl+C to exit.\n")

    try:
        with FaceDetector() as detector:
            while True:
                frame = cam.get_frame()
                if frame is not None:
                    result = detector.process_frame(frame)
                    if result.face_present and result.raw_landmarks:
                        gaze = GazeEstimator.estimate(result.raw_landmarks)
                        if gaze:
                            print(f"Gaze: {gaze['direction'].upper():<8} | Ratio: {gaze['ratio']:.3f}", flush=True)
                        else:
                            print("Gaze: No landmarks (need 478 points)", flush=True)
                    else:
                        print("Gaze: NO FACE DETECTED", flush=True)
                
                time.sleep(0.5)  # 2 fps
    except KeyboardInterrupt:
        print("\nTest stopped by user.")
    finally:
        cam.stop()

if __name__ == "__main__":
    run_test()
