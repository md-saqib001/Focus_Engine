"""
head_pose_estimator.py — Head Pose Estimator using cv2.solvePnP.

Calculates yaw, pitch, and roll in degrees from 2D facial landmarks by
mapping them to a standard 3D generic face model.
"""

import cv2
import numpy as np

# ---------------------------------------------------------------------------
# Standard 3D Face Model (6 reference points)
# ---------------------------------------------------------------------------
# These are approximate 3D coordinates of a generic human face.
# Origin (0,0,0) is at the nose tip.
_FACE_3D_MODEL = np.array([
    [0.0, 0.0, 0.0],             # Nose tip
    [0.0, -330.0, -65.0],        # Chin
    [-225.0, 170.0, -135.0],     # Left eye left corner
    [225.0, 170.0, -135.0],      # Right eye right corner
    [-150.0, -150.0, -125.0],    # Left mouth corner
    [150.0, -150.0, -125.0]      # Right mouth corner
], dtype=np.float64)

# Corresponding MediaPipe Face Mesh landmark indices
_LANDMARK_INDICES = [
    1,      # Nose tip
    152,    # Chin
    33,     # Left eye outer corner
    263,    # Right eye outer corner
    61,     # Left mouth corner
    291     # Right mouth corner
]


class HeadPoseEstimator:
    """
    Estimates head pose (yaw, pitch, roll) from MediaPipe landmarks.
    """

    @staticmethod
    def estimate(landmarks, frame_width: int, frame_height: int):
        """
        Estimates the head pose.

        Parameters
        ----------
        landmarks : list
            List of NormalizedLandmark from MediaPipe.
        frame_width : int
            Width of the frame in pixels.
        frame_height : int
            Height of the frame in pixels.

        Returns
        -------
        dict | None
            {'yaw': float, 'pitch': float, 'roll': float} in degrees,
            or None if landmarks are insufficient.
        """
        if not landmarks or len(landmarks) < max(_LANDMARK_INDICES):
            return None

        # Extract 2D image points
        image_points = []
        for idx in _LANDMARK_INDICES:
            lm = landmarks[idx]
            x, y = int(lm.x * frame_width), int(lm.y * frame_height)
            image_points.append([x, y])
            
        image_points = np.array(image_points, dtype=np.float64)

        # Approximate camera matrix
        focal_length = frame_width
        center = (frame_width / 2, frame_height / 2)
        camera_matrix = np.array([
            [focal_length, 0, center[0]],
            [0, focal_length, center[1]],
            [0, 0, 1]
        ], dtype=np.float64)

        # Assume no lens distortion
        dist_coeffs = np.zeros((4, 1), dtype=np.float64)

        # Solve PnP
        success, rotation_vector, translation_vector = cv2.solvePnP(
            _FACE_3D_MODEL,
            image_points,
            camera_matrix,
            dist_coeffs,
            flags=cv2.SOLVEPNP_ITERATIVE
        )

        if not success:
            return None

        # Convert rotation vector to rotation matrix
        rotation_matrix, _ = cv2.Rodrigues(rotation_vector)

        # Extract Euler angles (yaw, pitch, roll)
        # 
        # A common way to decompose the rotation matrix into Euler angles
        # using cv2.RQDecomp3x3
        proj_matrix = np.hstack((rotation_matrix, translation_vector))
        _, _, _, _, _, _, euler_angles = cv2.decomposeProjectionMatrix(proj_matrix)
        
        # euler_angles is a 3x1 vector [pitch, yaw, roll] in degrees
        pitch = euler_angles[0][0]
        yaw = euler_angles[1][0]
        roll = euler_angles[2][0]

        # Adjust angles based on standard solvePnP OpenCV camera frame (Y down, Z forward)
        # Pitch is typically near 180 or -180 when looking straight.
        if pitch > 0:
            pitch = 180.0 - pitch
        else:
            pitch = -180.0 - pitch
            
        # The generic 3D model has Z forward. 
        # Standardizing so looking right is positive yaw, looking up is positive pitch, tilting right is positive roll.
        yaw = -yaw
        roll = -roll

        return {
            "yaw": round(yaw, 2),
            "pitch": round(pitch, 2),
            "roll": round(roll, 2)
        }

    @staticmethod
    def classify_attention(yaw: float, pitch: float, calibration: dict = None) -> str:
        """
        Classify attention based on yaw and pitch angles.

        With a v2 10-point calibration dict, uses screen/keyboard bounding boxes.
        Falls back to generic thresholds if calibration is missing or malformed.

        Parameters
        ----------
        yaw : float   — Yaw angle in degrees.
        pitch : float — Pitch angle in degrees.
        calibration : dict, optional — v2 calibration JSON.

        Returns
        -------
        str — "looking_at_screen", "looking_at_keyboard", or "looking_away"
        """
        if calibration:
            try:
                version = calibration.get("version", 1)

                if version == 2:
                    # --- v2 10-point bounding box approach ---
                    # Build combined focus hull: screen + keyboard points
                    screen_points = list(calibration.get("screen", {}).values())
                    keyboard_points = list(calibration.get("keyboard", {}).values())
                    all_points = screen_points + keyboard_points

                    def _in_hull(pts, y, p, margin_yaw=5.0, margin_pitch=5.0):
                        """True if (y, p) is within the bounding box of pts with margin."""
                        if not pts:
                            return False
                        yaws = [pt["yaw"] for pt in pts]
                        pitches = [pt["pitch"] for pt in pts]
                        return (
                            (min(yaws) - margin_yaw) <= y <= (max(yaws) + margin_yaw) and
                            (min(pitches) - margin_pitch) <= p <= (max(pitches) + margin_pitch)
                        )

                    if _in_hull(all_points, yaw, pitch):
                        # Focused! Classify whether gaze check is needed
                        # If pitch is low (downward looking), treat as looking at keyboard to bypass gaze check
                        keyboard_pitches = [pt["pitch"] for pt in keyboard_points]
                        max_kb_pitch = max(keyboard_pitches) if keyboard_pitches else -10.0
                        if pitch <= max_kb_pitch + 2.0:
                            return "looking_at_keyboard"
                        else:
                            return "looking_at_screen"
                    else:
                        return "looking_away"

                elif version == 1:
                    # --- Legacy v1 2-point approach ---
                    if "screen" in calibration and "distract" in calibration:
                        screen_yaw = calibration["screen"]["yaw"]
                        screen_pitch = calibration["screen"]["pitch"]
                        distract_yaw = calibration["distract"]["yaw"]
                        distract_pitch = calibration["distract"]["pitch"]

                        pitch_mid = (screen_pitch + distract_pitch) / 2.0
                        pitch_tol = max(15.0, abs(screen_pitch - pitch_mid))
                        yaw_diff = abs(screen_yaw - distract_yaw)
                        yaw_tol = max(25.0, yaw_diff)

                        if (screen_yaw - yaw_tol <= yaw <= screen_yaw + yaw_tol and
                                screen_pitch - pitch_tol <= pitch <= screen_pitch + pitch_tol):
                            return "looking_at_screen"
                        else:
                            return "looking_away"

            except (KeyError, TypeError, AttributeError):
                pass  # Fall through to default

        # Fall back to default loosened thresholds
        if abs(yaw) < 35 and -30 < pitch < 30:
            return "looking_at_screen"
        else:
            return "looking_away"
