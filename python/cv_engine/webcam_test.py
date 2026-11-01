"""
webcam_test.py — Standalone webcam sanity check.
TESTING ONLY. No frames are written to disk; cv2.imshow is used solely
to verify capture is working. Remove or gate this file behind a
--dev flag before production packaging.

Usage:
    python webcam_test.py          # default camera (index 0)
    python webcam_test.py 1        # alternate camera index
Press Q to quit.
"""

import sys
import cv2


def run(camera_index: int = 0) -> None:
    cap = cv2.VideoCapture(camera_index)

    if not cap.isOpened():
        print(
            f"[webcam_test] ERROR: Could not open camera at index {camera_index}.\n"
            "  • Make sure a webcam is connected.\n"
            "  • On Windows, allow camera access in Privacy settings.\n"
            "  • Try a different index, e.g. python webcam_test.py 1",
            file=sys.stderr,
        )
        sys.exit(1)

    # Read a single frame first so that VideoCapture can populate its
    # internal CAP_PROP values (some drivers fill them only after the
    # first grab).
    ret, frame = cap.read()
    if not ret or frame is None:
        print(
            "[webcam_test] ERROR: Camera opened but the first frame could not be read.",
            file=sys.stderr,
        )
        cap.release()
        sys.exit(1)

    width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps    = cap.get(cv2.CAP_PROP_FPS)

    print(f"[webcam_test] Camera {camera_index} opened successfully.")
    print(f"  Resolution : {width} x {height}")
    print(f"  Reported FPS: {fps:.1f}")
    print("  Press Q inside the preview window to quit.\n")

    frame_count = 0

    while True:
        ret, frame = cap.read()
        if not ret or frame is None:
            print("[webcam_test] WARNING: Failed to grab frame. Retrying...", file=sys.stderr)
            continue

        frame_count += 1

        # Overlay minimal HUD
        label = f"{width}x{height}  |  frame #{frame_count}"
        cv2.putText(
            frame, label,
            (10, 24),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6,
            (0, 255, 0), 1, cv2.LINE_AA,
        )

        cv2.imshow("Focus Engine — Webcam Test (press Q to quit)", frame)

        # waitKey(1) gives ~1 ms delay; use 30 for a softer loop
        if cv2.waitKey(1) & 0xFF == ord("q"):
            print(f"[webcam_test] Quit after {frame_count} frames.")
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    index = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    run(index)
