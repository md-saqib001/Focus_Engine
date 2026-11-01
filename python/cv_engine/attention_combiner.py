"""
attention_combiner.py — Unifies head pose and gaze estimation into a single score.
"""

from head_pose_estimator import HeadPoseEstimator
from gaze_estimator import GazeEstimator
from score_smoother import ExponentialSmoother

class AttentionCombiner:
    def __init__(self, smoothing_alpha: float = 0.15):
        self.smoother = ExponentialSmoother(alpha=smoothing_alpha)

    def combine(self, face_result, frame_width: int, frame_height: int, calibration: dict = None):
        """
        Combines head pose and gaze direction into a single unified JSON record.
        
        Parameters
        ----------
        face_result : FaceDetectionResult
            The output from FaceDetector.process_frame().
        frame_width : int
            Video frame width.
        frame_height : int
            Video frame height.
            
        Returns
        -------
        dict
            Unified telemetry record ready for JSON serialization.
        """
        # Base degraded record
        record = {
            "face_present": False,
            "landmark_count": 0,
            "confidence": 0.0,
            "yaw": None,
            "pitch": None,
            "roll": None,
            "gaze_direction": None,
            "gaze_ratio": None,
            "looking_at_screen": False,
            "raw_attention_score": 0.0,
            "smoothed_attention_score": self.smoother.update(0.0) if not face_result else 0.0
        }

        if not face_result or not face_result.face_present or not face_result.raw_landmarks:
            # We updated the smoother with 0.0 in the dict comprehension for the base case,
            # but let's be explicitly clear
            record["smoothed_attention_score"] = self.smoother.update(0.0)
            return record

        record["face_present"] = True
        record["landmark_count"] = face_result.landmark_count
        record["confidence"] = face_result.confidence

        # 1. Head Pose
        pose = HeadPoseEstimator.estimate(face_result.raw_landmarks, frame_width, frame_height)
        head_looking_at_screen = False
        head_at_keyboard = False
        if pose:
            record["yaw"] = pose["yaw"]
            record["pitch"] = pose["pitch"]
            record["roll"] = pose["roll"]
            head_attention = HeadPoseEstimator.classify_attention(pose["yaw"], pose["pitch"], calibration)
            head_looking_at_screen = (head_attention == "looking_at_screen")
            head_at_keyboard = (head_attention == "looking_at_keyboard")

        # 2. Gaze
        gaze = GazeEstimator.estimate(face_result.raw_landmarks)
        gaze_centered = False
        if gaze:
            record["gaze_direction"] = gaze["direction"]
            record["gaze_ratio"] = gaze["ratio"]
            # Gaze is not checked for keyboard positions — eyelids partially occlude
            # the iris when looking down, making ratio unreliable.
            if not head_at_keyboard:
                gaze_centered = (gaze["direction"] == "center")
            else:
                gaze_centered = True  # Keyboard: assume gaze OK, only head pose matters

        # 3. Combine Logic
        raw_score = 0.2
        if head_looking_at_screen and gaze_centered:
            raw_score = 1.0
            record["looking_at_screen"] = True
        elif head_at_keyboard:
            # Typing/keyboard lookup — productive, not penalized
            raw_score = 1.0
            record["looking_at_screen"] = True
        elif head_looking_at_screen or gaze_centered:
            raw_score = 0.5
            record["looking_at_screen"] = False # Need both for full "looking_at_screen" True
        else:
            raw_score = 0.2
            record["looking_at_screen"] = False
            
        record["raw_attention_score"] = raw_score
        record["smoothed_attention_score"] = round(self.smoother.update(raw_score), 3)
        return record
