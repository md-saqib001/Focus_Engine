# Computer Vision Image Processing Pipeline

## 1. End-to-End Pipeline Architecture

The Focus Engine CV pipeline executes a continuous linear transformation from raw optical sensor photons into a smoothed attention scalar ($0.0 \dots 1.0$):

```mermaid
graph TD
    A[Webcam Hardware: /dev/video0 or DirectShow] -->|Raw BGR Buffer: 640x480| B[WebcamCapture.get_frame]
    B -->|cv2.cvtColor| C[RGB Frame Buffer]
    C -->|mp.Image(SRGB)| D[MediaPipe FaceLandmarker Task]
    D -->|Neural Inference: face_landmarker.task| E[478 3D Normalized Landmarks]
    
    E --> F[HeadPoseEstimator: cv2.solvePnP]
    E --> G[GazeEstimator: Iris Distance Ratio]
    
    F -->|Yaw, Pitch, Roll Degrees| H[AttentionCombiner.combine]
    G -->|Horizontal Gaze Direction| H
    
    H -->|Raw Score: 0.0, 0.2, 0.5, 1.0| I[ExponentialSmoother: Alpha=0.15]
    I -->|Smoothed Attention Score| J[JSON Serialization stdout]
```

---

## 2. Pipeline Stages in Detail

### Stage 1: Frame Acquisition (`webcam_capture.py`)
- Opens hardware video device via OpenCV `cv2.VideoCapture(camera_index)`.
- Requests optimized resolution:
  ```python
  cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
  cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
  ```
- **Why $640 \times 480$?**: Facial landmark detection on MediaPipe does not require 1080p or 4K. $640 \times 480$ reduces pixel count by over $6\times$, drastically reducing bus transfer bandwidth and memory consumption while preserving facial sub-pixel landmark accuracy.

---

### Stage 2: Color Space Conversion & MediaPipe Packaging
OpenCV natively delivers frames in **BGR** (Blue-Green-Red) format. MediaPipe requires standard **sRGB**:
```python
rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
```

---

### Stage 3: Neural Landmark Regression (`face_detector.py`)
- Employs MediaPipe's lightweight Convolutional Vision Transformer architecture (`face_landmarker.task`).
- Detects the face bounding box and regresses **478 3D normalized coordinates** ($x, y, z \in [0.0, 1.0]$):
  - Landmarks $0 - 467$: Facial contours, lips, eyebrows, nose, and chin.
  - Landmarks $468 - 477$: Refined eye iris centers and contours (`refine_landmarks=True`).

---

### Stage 4: 3D Pose Estimation via Perspective-n-Point (`head_pose_estimator.py`)
To project 2D image coordinates into 3D world space, Focus Engine maps 6 key landmarks to a canonical generic 3D human face model:
```python
# Canonical 3D Face Model Points (Origin at Nose Tip)
_FACE_3D_MODEL = np.array([
    [0.0, 0.0, 0.0],          # 1: Nose tip
    [0.0, -330.0, -65.0],     # 152: Chin
    [-225.0, 170.0, -135.0],  # 33: Left eye outer corner
    [225.0, 170.0, -135.0],   # 263: Right eye outer corner
    [-150.0, -150.0, -125.0], # 61: Left mouth corner
    [150.0, -150.0, -125.0]   # 291: Right mouth corner
], dtype=np.float64)
```

1. Constructs virtual pinhole camera matrix based on focal length $f \approx \text{frame\_width}$.
2. Calls `cv2.solvePnP(..., flags=cv2.SOLVEPNP_ITERATIVE)` to compute rotation vector $\vec{R}$ and translation vector $\vec{T}$.
3. Converts $\vec{R}$ to a $3 \times 3$ rotation matrix via Rodrigues transform (`cv2.Rodrigues`).
4. Extracts Euler angles: **Yaw** ($\psi$), **Pitch** ($\theta$), **Roll** ($\phi$) in degrees.

---

### Stage 5: Horizontal Gaze Ratio Estimation (`gaze_estimator.py`)
Samples the position of the iris relative to the inner and outer eye corners:
1. Computes Euclidean distances:
   $$d_{\text{inner}} = \sqrt{(x_{\text{iris}} - x_{\text{inner}})^2 + (y_{\text{iris}} - y_{\text{inner}})^2}$$
   $$d_{\text{outer}} = \sqrt{(x_{\text{iris}} - x_{\text{outer}})^2 + (y_{\text{iris}} - y_{\text{outer}})^2}$$
2. Computes the ratio:
   $$r = \frac{d_{\text{inner}}}{d_{\text{inner}} + d_{\text{outer}}}$$
3. Averages right and left eye ratios:
   - $r \in [0.45, 0.55] \rightarrow \text{"center"}$
   - $r > 0.55 \rightarrow \text{"left"}$
   - $r < 0.45 \rightarrow \text{"right"}$

---

### Stage 6: Exponential Moving Average Smoothing (`score_smoother.py`)
To prevent instantaneous blinks or head adjustments from causing erratic score drops:
$$S_t = \alpha \cdot X_t + (1 - \alpha) \cdot S_{t-1}$$
With $\alpha = 0.15$:
- Natural eye blinks ($100 - 300\text{ ms}$) cause almost zero score variation.
- Sustained distractions ($> 2\text{ seconds}$) decay smoothly to low attention.
