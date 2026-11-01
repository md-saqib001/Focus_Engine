# Module 07: Computer Vision Pipeline — Presentation & Defense Speech

## 1. Presentation Metadata

- **Target Presentation Duration**: **10 Minutes** (Complex, high-weight AI/Vision module)
- **Target Audience**: Computer Vision Specialists, Machine Learning Engineers, Architects, Technical Evaluators
- **Primary Objective**: Present the real-time visual attention pipeline of Focus Engine, explaining MediaPipe Face Landmarker integration, 3D `solvePnP` head pose regression (Pitch, Yaw, Roll), iris gaze tracking, frame throttling algorithms (2.0 FPS), WebSocket communication, and the absolute zero-image-storage privacy architecture.
- **Delivery Pace**: ~135 – 145 words per minute (~1,400 spoken words)

---

## 2. Minute-by-Minute Presentation Timeline

| Time Marker | Section Title | Core Technical Message | Visual / Slide Cue |
|---|---|---|---|
| **00:00 – 01:30** | The Vision Mission & Privacy Guarantee | Why visual presence is essential for deep work; the zero-image storage privacy guarantee. | CV Pipeline overview diagram contrasting raw video frames vs. JSON telemetry. |
| **01:30 – 03:30** | The MediaPipe 478-Landmark Mesh Engine | Loading `face_landmarker.task`; extracting canonical 3D facial coordinates in sub-millisecond time. | 478-point facial landmark mesh visualization with key anchor points highlighted. |
| **03:30 – 05:30** | 3D Head Pose Regression via `solvePnP` | Mathematical derivation of Perspective-n-Point pose estimation; Euler angles (Pitch, Yaw, Roll). | 3D head pose coordinate system diagram (Pitch, Yaw, Roll axes). |
| **05:30 – 07:30** | Iris Gaze Estimation & Keyboard Glance Detection | Calculating iris displacement ratios; distinguishing keyboard glances from phone distractions. | Eye anatomy diagram showing iris center vs. medial/lateral canthi ratios. |
| **07:30 – 09:00** | Frame Rate Throttling & WebSocket Protocol | 2.0 FPS execution loop, monotonic timing, sub-millisecond JSON streaming on port 8765. | Sequence diagram: OpenCV capture $\rightarrow$ MediaPipe $\rightarrow$ WebSocket JSON $\rightarrow$ Electron. |
| **09:00 – 10:00** | Conclusion & Evaluator Defense | Summary of visual attention accuracy, low CPU footprint (<3%), and technical Q&A defense. | Performance benchmark slide (3ms inference, 2.0 FPS, 0MB disk writes). |

---

## 3. Verbatim Spoken Presentation Track

### [00:00 – 01:30] Section 1: The Vision Mission & Privacy Guarantee

> "Good morning, everyone. In this presentation, I am thrilled to walk you through the technical design and mathematical implementation of Focus Engine's **Computer Vision Pipeline**.
> 
> Peripheral telemetry—keystrokes and mouse movement—can tell you if a user is actively typing, but it cannot tell you if they are reading, thinking deeply, or looking at their smartphone. Visual attention is the purest indicator of cognitive engagement.
> 
> However, introducing a camera into a developer's workspace creates understandable privacy anxiety. If users fear they are being recorded, they will cover their webcams and disable the system.
> 
> Focus Engine resolves this with an **Ironclad Privacy Architecture**:
> 1. **Zero Frame Storage**: Video frames captured from the webcam exist exclusively in volatile RAM buffers. They are never written to disk, never cached in temp folders, and never transmitted over the internet.
> 2. **Instant Feature Extraction**: The frame is converted to a normalized array of mathematical floats—head pitch, yaw, roll, and gaze ratio—and the raw image is immediately destroyed in memory.
> 3. **Local Subprocess**: The entire computer vision pipeline runs locally inside an isolated Python process communicating with Electron over a local loopback WebSocket."

---

### [01:30 – 03:30] Section 2: The MediaPipe 478-Landmark Mesh Engine

> "At the core of our vision stack is Google's **MediaPipe Face Landmarker** model (`face_landmarker.task`), executing inside our Python runtime (`python/cv_engine/main.py`).
> 
> We chose MediaPipe over legacy alternatives like Dlib or OpenCV Haar Cascades for three reasons:
> 1. It regresses **478 three-dimensional landmarks** covering the face contours, lips, eyelids, and both irises simultaneously.
> 2. It runs a lightweight mobile-optimized deep neural network that executes on consumer CPU hardware in under **5 milliseconds per frame**.
> 3. It provides high resilience against extreme lighting variations, shadows, and partial facial occlusions from glasses or hands.
> 
> Every frame, MediaPipe outputs 3D coordinates $(x, y, z)$ normalized to the image width and height, giving us a sub-pixel topological map of the user's face."

---

### [03:30 – 05:30] Section 3: 3D Head Pose Regression via `solvePnP`

> "Raw 2D landmarks do not directly give you the user's head orientation in 3D physical space. To calculate true head pose, Focus Engine implements classical **Perspective-n-Point (`cv2.solvePnP`)** pose estimation.
> 
> In `head_pose.py`, we define a canonical 3D model of the human face comprising six rigid anatomical anchor points in millimeter coordinates:
> - Nose tip: `(0.0, 0.0, 0.0)`
> - Chin: `(0.0, -330.0, -65.0)`
> - Left eye outer corner: `(-225.0, 170.0, -135.0)`
> - Right eye outer corner: `(225.0, 170.0, -135.0)`
> - Left mouth corner: `(-150.0, -150.0, -125.0)`
> - Right mouth corner: `(150.0, -150.0, -125.0)`
> 
> We project these 3D canonical points against the 2D pixel coordinates extracted by MediaPipe using OpenCV's Levenberg-Marquardt optimization. `solvePnP` computes the rotation vector ($\mathbf{r}$) and translation vector ($\mathbf{t}$). 
> 
> We then apply Rodrigues' formula (`cv2.Rodrigues`) to transform the rotation vector into a $3 \times 3$ rotation matrix, and extract the user's precise **Euler angles**:
> - **Pitch**: Tilting head up or down.
> - **Yaw**: Turning head left or right.
> - **Roll**: Tilting head sideways.
> 
> If Yaw exceeds $\pm 25^\circ$ or Pitch exceeds $\pm 20^\circ$, the system flags that the user's head is turned away from the screen."

---

### [05:30 – 07:30] Section 4: Iris Gaze Estimation & Keyboard Glance Detection

> "Head pose alone is not enough: a user can face the monitor while their eyes look down at a smartphone in their lap. 
> 
> To detect eye alignment, Focus Engine implements **Iris Gaze Ratio Estimation** in `gaze_detector.py`. MediaPipe provides 4 dedicated landmarks for each iris. We compute the Euclidean center of the iris and measure its horizontal displacement relative to the inner canthus ($x_{\text{inner}}$) and outer canthus ($x_{\text{outer}}$):
> $$\text{GazeRatio} = \frac{x_{\text{iris}} - x_{\text{outer}}}{x_{\text{inner}} - x_{\text{outer}}}$$
> 
> - A ratio between **0.40 and 0.60** indicates centered on-screen gaze.
> - Ratios below 0.35 or above 0.65 indicate looking far to the left or right.
> 
> Here, we addressed a crucial human factor: **The Keyboard Pitch Problem**.
> Developers frequently glance down at their keyboard while coding. Naive algorithms penalize this as a distraction. Focus Engine cross-references head pitch with typing cadence: if pitch tilts downward between $-10^\circ$ and $-25^\circ$ *while* keystrokes are actively firing ($KPM > 20$), the system identifies the gesture as a natural keyboard glance and maintains the CV multiplier at 1.0."

---

### [07:30 – 09:00] Section 5: Frame Rate Throttling & WebSocket Protocol

> "Running computer vision models at 30 or 60 frames per second on a laptop would consume 40% CPU, spin fans, and drain the battery. Human cognitive focus does not shift in milliseconds.
> 
> Focus Engine implements an intelligent **Monotonic Frame Throttler**:
> 1. In standard background tracking mode, the camera capture loop is regulated to exactly **2.0 FPS** (one frame every 500 milliseconds) using `time.monotonic()` sleep pacing. This slashes CPU consumption to **under 2.5%**.
> 2. If the user opens the visual calibration preview window, the engine dynamically boosts to 15 FPS for silky-smooth camera alignment, dropping back to 2.0 FPS the moment preview mode closes.
> 
> Once evaluated, the metrics are packaged into a structured JSON payload and streamed across a local WebSocket server running on `ws://127.0.0.1:8765`:
> ```json
> {
>   "face_present": true,
>   "attention_score": 0.94,
>   "pitch": -4.2,
>   "yaw": 2.1,
>   "roll": 0.8,
>   "gaze_direction": "center",
>   "timestamp": 1730456100000
> }
> ```
> Electron's `BufferOrchestrator` ingests this stream, mapping `attention_score` into the continuous Focus Buffer."

---

### [09:00 – 10:00] Section 6: Conclusion & Defense Readiness

> "To conclude: Focus Engine's Computer Vision pipeline bridges cutting-edge deep landmark regression with classical 3D projective geometry. It delivers precise gaze and head-pose tracking, distinguishes coding gestures from true distractions, throttles CPU load to negligible levels, and guarantees complete user privacy through an ephemeral in-memory processing model.
> 
> Thank you. I am ready to take your questions regarding our vision models and geometry algorithms."

---

## 4. Technical Defense: Tough Evaluator Questions & Model Answers

### Question 1: "Why use classical `solvePnP` for head pose instead of an end-to-end deep neural network like HopeNet or FSA-Net?"
**Model Answer:**
> "End-to-end deep head-pose networks require substantial GPU acceleration (CUDA/TensorRT) and add tens of megabytes to the application bundle size. For a cross-platform desktop productivity app that must run on thin-and-light laptops with integrated Intel/Apple Silicon graphics, shipping heavy PyTorch or ONNX runtimes for pose estimation would cause severe memory bloat. MediaPipe's lightweight landmark model runs efficiently on pure CPU, and applying `cv2.solvePnP` over 6 canonical points executes in less than **0.2 milliseconds**. The accuracy trade-off is negligible for desktop gaze tracking (within $1.5^\circ$), while saving hundreds of megabytes of RAM and GPU compute."

### Question 2: "How does the system handle users with prescription glasses, beards, or variable webcam angles (e.g. laptop camera off to the side)?"
**Model Answer:**
> "MediaPipe's Face Landmarker was trained on thousands of diverse faces with varied lighting, eyeglasses, and facial hair, making landmark regression highly robust. For side-mounted webcams or unusual monitor angles, Focus Engine includes an interactive **Calibration Routine** in `python/cv_engine/main.py`. During the first 10 seconds of a session, the user looks directly at their work screen, and the engine computes an empirical baseline offset for pitch, yaw, and gaze. Subsequent measurements are evaluated relative to this calibrated neutral vector rather than absolute zero."

### Question 3: "What happens if the user does not have a webcam or denies camera permissions in Windows Settings?"
**Model Answer:**
> "Focus Engine is designed for graceful degradation. If camera initialization fails or permission is denied, `cvHandlers.ts` catches the error, sets `cvAvailable = false`, and logs the absence in SQLite. Crucially, in `src/main/buffer/focusScoreCalculator.ts`, our focus score weighting automatically rebalances from $40/40/20$ to $50/50/0$:
> $$\text{FocusScore} = 0.50 \cdot \text{AverageBuffer} + 0.50 \cdot \text{FocusPercentage} + 0.00 \cdot \text{CV}$$
> The user is never penalized for lacking a camera; the system transitions seamlessly to pure peripheral telemetry."
