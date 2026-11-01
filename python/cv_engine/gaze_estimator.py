"""
gaze_estimator.py — Prototype horizontal gaze direction estimator.

MediaPipe FaceLandmarker with refine_landmarks=True yields 478 points.
Indices 468-477 are the irises:
  - Right iris center: 468
  - Left iris center: 473

Eye corner indices:
  - Right eye: 33 (outer), 133 (inner)
  - Left eye: 362 (inner), 263 (outer)

Scope Decision (Horizontal Only):
  Estimating gaze vertically using 2D ratios is notoriously noisy because
  eyelids occlude the iris unpredictably during blinks or when looking down.
  Since looking down (keyboard) or up (thinking) are usually productive
  states in focus tracking, horizontal gaze (left/right) is far more useful
  for catching true visual distractions (like checking a phone or looking at
  a different physical monitor).
"""

import math

# MediaPipe Indices
_RIGHT_IRIS_CENTER = 468
_RIGHT_EYE_OUTER = 33
_RIGHT_EYE_INNER = 133

_LEFT_IRIS_CENTER = 473
_LEFT_EYE_INNER = 362
_LEFT_EYE_OUTER = 263


class GazeEstimator:
    @staticmethod
    def _get_distance(p1, p2):
        # We can use Euclidean distance, but since we want a ratio along
        # the horizontal axis of the eye, simple X-distance is often enough.
        # However, if the head is tilted, X-distance distorts. We use Euclidean
        # for a robust measure.
        return math.hypot(p1.x - p2.x, p1.y - p2.y)

    @staticmethod
    def estimate_gaze_ratio(landmarks):
        """
        Computes the ratio of the iris center position between eye corners.
        Ratio ~ 0.5 means center.
        Ratio > 0.55 often means looking left (from the user's perspective).
        Ratio < 0.45 often means looking right.
        """
        if not landmarks or len(landmarks) < 478:
            return None

        # Right eye (user's right, left side of the image)
        r_iris = landmarks[_RIGHT_IRIS_CENTER]
        r_outer = landmarks[_RIGHT_EYE_OUTER]
        r_inner = landmarks[_RIGHT_EYE_INNER]

        r_dist_to_outer = GazeEstimator._get_distance(r_iris, r_outer)
        r_dist_to_inner = GazeEstimator._get_distance(r_iris, r_inner)
        r_total_width = r_dist_to_outer + r_dist_to_inner
        
        # Avoid div by zero
        r_ratio = r_dist_to_outer / r_total_width if r_total_width > 0 else 0.5

        # Left eye (user's left, right side of the image)
        l_iris = landmarks[_LEFT_IRIS_CENTER]
        l_inner = landmarks[_LEFT_EYE_INNER]
        l_outer = landmarks[_LEFT_EYE_OUTER]

        l_dist_to_inner = GazeEstimator._get_distance(l_iris, l_inner)
        l_dist_to_outer = GazeEstimator._get_distance(l_iris, l_outer)
        l_total_width = l_dist_to_inner + l_dist_to_outer
        
        l_ratio = l_dist_to_inner / l_total_width if l_total_width > 0 else 0.5

        # Average the two ratios for stability
        return round((r_ratio + l_ratio) / 2.0, 3)

    @staticmethod
    def estimate(landmarks):
        """
        Returns horizontal gaze direction and the underlying ratio.
        """
        ratio = GazeEstimator.estimate_gaze_ratio(landmarks)
        if ratio is None:
            return None

        # Tuning thresholds:
        # A ratio of ~0.5 means the iris is equidistant from the corners (centered).
        # Depending on eye shape and exact landmark placement, the true center might
        # be slightly offset (e.g., 0.48). We start with a conservative 0.45-0.55 band.
        if ratio < 0.45:
            direction = "right"
        elif ratio > 0.55:
            direction = "left"
        else:
            direction = "center"

        return {
            "ratio": ratio,
            "direction": direction
        }
