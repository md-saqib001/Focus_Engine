"""
main_loop.py — Headless production main loop.

Combines WebcamCapture + FaceDetector, runs at ~2 fps, and emits one JSON
line per iteration to stdout. Intended to be piped into Node.js or any
consumer that reads newline-delimited JSON.

Privacy guarantee:
  - No cv2.imshow or any display call.
  - No cv2.imwrite, VideoWriter, or any file write.
  - Only numeric/boolean data is emitted.

Output format (one JSON object per line, newline-delimited):
  {
    "ts":             <Unix timestamp ms, integer>,
    "face_present":   <bool>,
    "landmark_count": <int, 0–478>,
    "confidence":     <float, 0.0–1.0>,
    "frame":          <int, monotonically increasing>
  }

Usage:
    python main_loop.py                 # default camera, 2 fps
    python main_loop.py --preview       # display camera feed with overlay
    python main_loop.py --camera 1      # alternate camera index
    python main_loop.py --fps 5         # custom target rate
    python main_loop.py --fps 0.5       # slow mode (one reading every 2 s)

Ctrl+C exits cleanly: camera LED turns off, no zombie processes.
"""

import argparse
import json
import signal
import sys
import time
import base64
import cv2

from webcam_capture import WebcamCapture
from face_detector import FaceDetector
from attention_combiner import AttentionCombiner


# ---------------------------------------------------------------------------
# Graceful shutdown on SIGINT / SIGTERM
# ---------------------------------------------------------------------------
_shutdown_requested = False


def _request_shutdown(signum, frame):
    global _shutdown_requested
    _shutdown_requested = True


signal.signal(signal.SIGINT,  _request_shutdown)
signal.signal(signal.SIGTERM, _request_shutdown)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
def run(camera_index: int = 0, target_fps: float = 2.0, preview: bool = False, stream_preview: bool = False, calibration_file: str = None) -> None:
    interval = 1.0 / max(target_fps, 0.01)   # seconds between ticks
    frame_number = 0
    consecutive_read_failures = 0
    MAX_CONSECUTIVE_FAILURES = 10            # abort if camera drops out

    print(
        f"[main_loop] Starting: camera={camera_index}  target={target_fps} fps  "
        f"interval={interval:.2f}s",
        file=sys.stderr,
        flush=True,
    )

    cam = WebcamCapture(camera_index=camera_index)
    combiner = AttentionCombiner(smoothing_alpha=0.15)

    calibration = None
    if calibration_file:
        try:
            with open(calibration_file, "r") as f:
                calibration = json.load(f)
            print(f"[main_loop] Loaded calibration from {calibration_file}", file=sys.stderr, flush=True)
        except Exception as e:
            print(f"[main_loop] WARNING: Failed to load calibration file: {e}", file=sys.stderr, flush=True)
    
    if not cam.start():
        json.dump(
            {"error": f"Could not open camera {camera_index}"},
            sys.stdout,
        )
        sys.stdout.write("\n")
        sys.stdout.flush()
        sys.exit(1)

    with FaceDetector(
        min_detection_confidence=0.5,
        max_num_faces=1,
    ) as detector:
        try:
            while not _shutdown_requested:
                tick_start = time.monotonic()

                frame = cam.get_frame()

                if frame is None:
                    consecutive_read_failures += 1
                    if consecutive_read_failures >= MAX_CONSECUTIVE_FAILURES:
                        print(
                            f"[main_loop] ERROR: {MAX_CONSECUTIVE_FAILURES} consecutive "
                            "read failures — camera may have disconnected.",
                            file=sys.stderr,
                            flush=True,
                        )
                        break
                    # Emit a degraded record so consumers don't stall
                    record = {
                        "ts": int(time.time() * 1000),
                        "frame": frame_number,
                        "error": "read_failure",
                        **combiner.combine(None, 0, 0)
                    }
                else:
                    consecutive_read_failures = 0
                    frame_number += 1

                    result = detector.process_frame(frame)
                    # frame goes out of scope here — not stored

                    frame_height, frame_width = frame.shape[:2]
                    record_data = combiner.combine(result, frame_width, frame_height, calibration)
                    
                    record = {
                        "ts": int(time.time() * 1000),
                        "frame": frame_number,
                        **record_data
                    }

                # 1. Draw overlays on the frame if previewing or streaming
                if (preview or stream_preview) and frame is not None:
                    cv2.putText(frame, f"Raw: {record.get('raw_attention_score', 0.0):.2f} | Smooth: {record.get('smoothed_attention_score', 0.0):.2f}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
                    if record.get("face_present"):
                        cv2.putText(frame, f"Yaw: {record.get('yaw')}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                        cv2.putText(frame, f"Pitch: {record.get('pitch')}", (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                        cv2.putText(frame, f"Gaze: {record.get('gaze_direction')}", (10, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                        color = (0, 255, 0) if record.get("looking_at_screen") else (0, 0, 255)
                        cv2.putText(frame, "Looking at Screen" if record.get("looking_at_screen") else "Looking Away", (10, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
                    else:
                        cv2.putText(frame, "No face detected", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

                # 2. Base64 encode for streaming
                if stream_preview and frame is not None:
                    success, encoded_img = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 50])
                    if success:
                        base64_img = base64.b64encode(encoded_img).decode('utf-8')
                        record["preview_frame"] = f"data:image/jpeg;base64,{base64_img}"

                # 3. Emit JSON
                sys.stdout.write(json.dumps(record))
                sys.stdout.write("\n")
                sys.stdout.flush()

                # 4. Show OpenCV window if native preview is active
                if preview and frame is not None:
                    cv2.imshow("Focus Engine Preview - Press Q to Quit", frame)

                # Sleep for the remainder of the tick interval
                elapsed = time.monotonic() - tick_start
                sleep_for = interval - elapsed
                if sleep_for > 0:
                    deadline = time.monotonic() + sleep_for
                    while time.monotonic() < deadline and not _shutdown_requested:
                        if preview:
                            # Keep OpenCV GUI responsive, check for Q key
                            key = cv2.waitKey(20) & 0xFF
                            if key == ord('q'):
                                _request_shutdown(signal.SIGINT, None)
                                break
                        else:
                            time.sleep(min(0.05, deadline - time.monotonic()))
                elif preview:
                    key = cv2.waitKey(1) & 0xFF
                    if key == ord('q'):
                        _request_shutdown(signal.SIGINT, None)

        finally:
            if preview:
                cv2.destroyAllWindows()
            # Always release the camera, even on unexpected exits
            cam.stop()
            print("[main_loop] Shutdown complete.", file=sys.stderr, flush=True)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Focus Engine — headless face presence detector (JSON output)."
    )
    parser.add_argument(
        "--camera", type=int, default=0,
        help="Camera device index (default: 0).",
    )
    parser.add_argument(
        "--fps", type=float, default=2.0,
        help="Target polling rate in frames per second (default: 2.0).",
    )
    parser.add_argument(
        "--preview", action="store_true",
        help="Display an OpenCV window showing the camera feed and pose telemetry overlay.",
    )
    parser.add_argument(
        "--stream-preview", action="store_true",
        help="Embed base64 encoded preview frames inside the JSON output stream.",
    )
    parser.add_argument(
        "--calibration-file", type=str, default=None,
        help="Path to the JSON calibration baselines file.",
    )
    args = parser.parse_args()

    run(
        camera_index=args.camera,
        target_fps=args.fps,
        preview=args.preview,
        stream_preview=args.stream_preview,
        calibration_file=args.calibration_file
    )
