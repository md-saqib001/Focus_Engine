# Technical Interview Talking Points

Use this guide to explain the core engineering decisions, ML paradigms, and architectural constraints of Focus Engine.

---

## 1. Paradigm Shift: "Not a Pomodoro Timer — A Behavioral Learning System"
- **The Problem with Standard Timers**: Traditional timers treat focus as a binary toggle (either you are in a focus block or not) and rely entirely on the user's manual reporting. 
- **The Human Bias**: Real-world user feedback is fundamentally flawed: users forget to rate their sessions, lie to themselves about how focused they actually were, or skip ratings entirely.
- **The Focus Engine Approach**: Focus Engine is a self-correcting behavioral feedback system. It captures continuous, multi-modal telemetry (mouse, keyboard, app categories, face gaze) and calculates a decayed/recovered focus buffer. At the end of the session, the final focus score is calculated automatically based on the actual percentage of time spent in a focused state.

---

## 2. The Cold-Start Bootstrap Strategy
- **The Challenge**: A personalized ML regressor requires historic focus sessions to learn a user's habits. But a brand-new user has exactly **0 real sessions** on first install.
- **The Bootstrap Solution**: We resolve this "cold start" problem (common in recommendation engines) by seeding a synthetic calibration pool of 200 sessions mapping to two behavioral archetypes (High-Focus and Low-Focus).
- **The 40-Session Sliding Window**:
  - The model trains on a fixed 40-row window compiled by taking the most recent sessions across both real database entries and the synthetic pool.
  - **Why 40 specifically?** This size is calibrated to realistic usage. If a user completes 3-4 sessions per day, they will accumulate 40 sessions in ~10-14 days. A window of 40 is small enough to train quickly (RandomForest fits in milliseconds) and allows the synthetic data to be completely displaced in under two weeks, yet large enough to compute reliable cross-validation scores without high variance.
  - **Automatic Phase-Out**: No manual flags or cutover parameters are needed. The training query sorts sessions by timestamp descending and limits to 40. As real sessions accumulate in the database, they occupy the top slots and push the oldest synthetic sessions out of the window automatically.

---

## 3. Model Architecture & Deployment Gate
- **RandomForestRegressor (`n_estimators=100`, `max_depth=5`)**:
  - **Why max_depth=5?** With a small training window of 40 rows, deep trees will instantly overfit the features. Restricting depth ensures stable generalization.
- **IsolationForest Anomaly Detector**:
  - Calibrates on high-focus baseline sessions to identify spikes of highly distracted states.
  - **The Fallback Mechanism**: If the current 40-row window contains too few high-focus sessions (e.g. during calibration), the trainer automatically falls back to the high-focus sessions in `synthetic_pool.csv` to calibrate normal behavior.
- **The "Deploy Only if Improved" Gate**:
  - Retraining runs in the background on app launch if 7+ days have passed.
  - Before deploying the new `.pkl` model, the pipeline compares the new candidate's 5-fold cross-validated $R^2$ score against the deployed model's $R^2$. If the new model doesn't improve or match performance, the deploy is rejected, keeping the old model active.

---

## 4. Feature Engineering & Live Inference
- **Consistent Feature Ordering**:
  - Features are aligned using a shared constant list `constants.py FEATURES`. Both the dataset builder and the inference engine use this exact array, ensuring 100% column order alignment.
- **Live In-Session Aggregation**:
  - Every 60 seconds, `livePredictionPoller.ts` queries the active session's running stats. It computes focused-state ratios, webcam attention ratios, KPM speeds, and window switches.
  - Active transition duration is computed on-the-fly (`Date.now() - start_time`) to prevent the running state from reading as zero duration.
- **Spawn-on-Demand Predictor**:
  - Instead of running a heavy Python HTTP server continuously in the background, we spawn `predict.py` on-demand every 60 seconds.
  - Stdin consumes the aggregated feature JSON, prints predictions to stdout, and exits. Node protects against hangs with a 5-second process timeout.

---

## 5. Computer Vision & Data Privacy
- **Websocket Derived Telemetry**:
  - The webcam frames are processed entirely in-memory using OpenCV and MediaPipe. 
  - **No raw frames ever leave the Python process or write to disk.**
  - The local websocket sends strictly derived numeric values (yaw/pitch ratios, presence flag, gaze ratio) to Electron, satisfying a strict "numeric output only" privacy design.
