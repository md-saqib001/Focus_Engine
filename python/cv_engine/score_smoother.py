"""
score_smoother.py — Exponential Smoothing for continuous telemetry.

Why Exponential Smoothing instead of a Moving Average buffer?
1. Memory Efficiency: A moving average requires storing a list of the last N
   frames, shifting and summing them every tick. Exponential smoothing requires
   storing exactly ONE variable (the previous smoothed value).
2. Natural Recency Weighting: Older values decay exponentially, meaning the
   smoother naturally values the most recent frames more heavily while still
   resisting instantaneous spikes (blinks/micro-movements).
"""

class ExponentialSmoother:
    def __init__(self, alpha: float = 0.3):
        """
        Initializes the smoother.
        
        Parameters
        ----------
        alpha : float
            Smoothing factor between 0.0 and 1.0.
            - Higher alpha (e.g. 0.8) = less smoothing, tracks raw faster.
            - Lower alpha (e.g. 0.1) = heavily smoothed, slow to respond.
            - 0.3 is a good balance for resisting 1-frame blinks while
              catching 2-second true state changes.
        """
        self.alpha = max(0.0, min(1.0, alpha))
        self._current_smoothed = None

    def update(self, new_value: float) -> float:
        """
        Updates the smoothed value with a new raw reading.
        """
        if self._current_smoothed is None:
            self._current_smoothed = new_value
        else:
            self._current_smoothed = (self.alpha * new_value) + ((1.0 - self.alpha) * self._current_smoothed)
            
        return self._current_smoothed

    def reset(self):
        """Resets the smoother state (e.g., across session restarts)."""
        self._current_smoothed = None
