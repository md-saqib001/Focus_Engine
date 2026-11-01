# Computer Vision Engineering Decisions

## 1. Overview

This document analyzes the engineering trade-offs, evaluated alternatives, and architectural rationale behind the Computer Vision (CV) Attention Subsystem in Focus Engine.

---

## 2. Key Architectural Decisions

### Decision 1: MediaPipe FaceLandmarker Task vs. Dlib / Haar Cascades / YOLO-Face

- **Context**: Choosing a facial landmark detector that is fast, lightweight, and supports iris refinement out of the box.
- **Choice**: Google's **MediaPipe Face Landmarker** (`face_landmarker.task`, 3.7MB).
- **Rationale**:
  - **Single Unified Model**: Provides both 468 contour landmarks AND 10 eye iris landmarks in a single inference pass. Older solutions (like Dlib) require a separate pupil localization model.
  - **Cross-Platform Portability**: Runs efficiently on standard CPUs without requiring CUDA, cuDNN, or dedicated discrete GPUs.
  - **Memory Footprint**: The model asset is only 3.7MB, keeping the application lightweight.
- **Trade-offs**:
  - *Advantage*: High accuracy, sub-millisecond CPU inference, integrated iris tracking.
  - *Disadvantage*: Requires Google's `.task` binary bundle format and modern MediaPipe Python API dependencies.
- **Alternatives Considered**:
  - *OpenCV Haar Cascades*: Obsolete; highly sensitive to lighting changes and head angles; lacks iris landmark capability.
  - *Dlib 68-point Shape Predictor*: Heavy 100MB model file; requires C++ compiler setup during `pip install`; struggles with extreme yaw angles.
  - *YOLO-Face / RetinaFace*: Excellent face bounding box detection, but requires secondary heavy landmark models for eye gaze.

---

### Decision 2: Classical Perspective-n-Point (cv2.solvePnP) vs. Deep Learning Pose Estimators

- **Context**: Estimating 3D head orientation (Yaw, Pitch, Roll) from facial landmarks.
- **Choice**: Classical geometric PnP optimization using 6 generic 3D reference facial points mapped to 2D image coordinates via `cv2.solvePnP`.
- **Rationale**:
  - **Mathematical Determinism**: PnP relies on classical projective geometry. It is fully explainable, debuggable, and has zero stochastic hallucination.
  - **Instantaneous Execution**: Computing `solvePnP` for 6 points takes $< 0.05\text{ ms}$ on a CPU, compared to 15–30ms for deep neural head pose networks (e.g. HopeNet).
- **Trade-offs**:
  - *Advantage*: Extremely fast, zero additional neural network memory overhead.
  - *Disadvantage*: Assumes a standard generic facial anatomy model; mitigated by Focus Engine's user calibration feature in `Settings.tsx`.

---

### Decision 3: Horizontal-Only Gaze Ratio vs. 2D Full Gaze Vector

- **Context**: Tracking eye movement across the screen.
- **Choice**: Computing horizontal iris ratio ($d_{\text{inner}} / (d_{\text{inner}} + d_{\text{outer}})$) and omitting vertical gaze ratio.
- **Rationale**:
  - **Eyelid Occlusion Noise**: When users look down, the upper eyelid naturally drops, occluding the upper pupil. Vertical 2D gaze estimation produces continuous false-negative spikes during normal reading and blinking.
  - **Vertical Redundancy**: Vertical orientation is already tracked with high precision by head pitch ($\theta$).
  - **Distraction Focus**: True environmental distractions (looking at phones, talking to colleagues, looking at secondary screens) are horizontal angular shifts.

---

### Decision 4: 2.0 FPS Low-Frequency Polling vs. 30 FPS Standard Video

- **Context**: Deciding how often to capture webcam frames.
- **Choice**: Regulating camera sampling to exactly 2.0 frames per second ($500\text{ ms}$ tick interval).
- **Rationale**:
  - Human cognitive shifts (moving focus from monitor to phone) last between 3 to 15 seconds. Sampling at 2 FPS captures every distraction event within 500ms of occurrence.
  - Cuts CPU utilization from $\approx 30\%$ down to $< 3\%$, preventing thermal throttling and laptop fan noise while studying or working.

---

### Decision 5: Exponential Moving Average (EMA, $\alpha=0.15$) vs. Sliding Average Buffer

- **Context**: Smoothing instantaneous frame noise and eye blinks.
- **Choice**: $S_t = \alpha X_t + (1 - \alpha) S_{t-1}$ with $\alpha = 0.15$.
- **Rationale**:
  - **O(1) Memory Complexity**: Requires storing exactly one float variable (`self._current_smoothed`) rather than maintaining an array of the last $N$ frames.
  - **Exponential Decay Curve**: Automatically weights newer frames higher while smoothly bridging $200\text{ ms}$ eye blinks.

---

### Decision 6: Productive Keyboard Downward Pitch (No Distraction Penalty)

- **Context**: Handling users looking down at their physical keyboard or desk notepad.
- **Choice**: Explicitly classifying $-35^\circ \le \theta < -15^\circ$ as `looking_at_keyboard` and assigning a full focus score of `1.0`.
- **Rationale**:
  - Software engineers and academic researchers spend significant time looking down at physical keyboards, drafting math formulas, or sketching architectures. Penalizing this would make the software frustrating and counterproductive.

---

## 3. Known Limitations & Future Roadmap

1. **Extreme Low-Light Conditions**:
   - *Limitation*: In pitch-black rooms with only monitor glow, webcam frame noise increases, occasionally dropping face confidence below $0.5$.
   - *Future Recommendation*: Introduce adaptive exposure compensation in `WebcamCapture` or notify the user to increase ambient lighting.
2. **Heavy Glasses & Reflections**:
   - *Limitation*: Strong glare or thick dark-rimmed glasses can occlude iris landmarks.
   - *Future Recommendation*: Fall back to pure 3D head pose when iris detection confidence drops below threshold.
