# Machine Learning Engineering Decisions

## 1. Overview

This document reviews the engineering trade-offs, evaluated alternatives, and architectural decisions made in the Machine Learning Subsystem of Focus Engine.

---

## 2. Key Architectural Decisions

### Decision 1: Random Forest Regressor vs. Deep Learning (MLP / LSTM) vs. Linear Regression

- **Context**: Selecting a regression algorithm to predict continuous session focus scores.
- **Choice**: `RandomForestRegressor(n_estimators=100, max_depth=5, random_state=42)`.
- **Rationale**:
  - **Sample Efficiency**: Deep neural networks (Transformers, LSTMs, MLPs) require thousands to millions of rows to converge without severe overfitting. With a realistic local desktop window of 40 sessions, a Random Forest with restricted depth ($5$) excels at extracting non-linear patterns without memorizing noise.
  - **Zero Preprocessing Scaling**: Random Forests split on single feature thresholds and are completely invariant to monotonic transformations. They do not require Min-Max scaling or Z-score normalization.
  - **Feature Importance Transparency**: Unlike opaque neural networks, Random Forests provide Gini impurity importances, allowing engineers to verify that `app_switches` and `avg_buffer` drive predictions.
- **Trade-offs**:
  - *Advantage*: High sample efficiency, zero scaling friction, built-in feature importance.
  - *Disadvantage*: Cannot extrapolate outside the minimum and maximum target bounds seen during training (which is actually desirable for a bounded $0 - 100$ focus score).

---

### Decision 2: Isolation Forest vs. Autoencoders vs. One-Class SVM

- **Context**: Unsupervised anomaly detection to flag irregular or fabricated sessions.
- **Choice**: `IsolationForest(contamination=0.10, random_state=42)`.
- **Rationale**:
  - **Linear Time Complexity**: Isolation Forest has an $O(n \log n)$ time complexity, executing in milliseconds on small CPUs.
  - **No Distance Metric Sensitivity**: High-dimensional Euclidean distance calculations in One-Class SVMs suffer from the "curse of dimensionality." Isolation Forest uses random binary partitioning, making it immune to scale differences between KPM ($0 - 300$) and buffer ($0 - 100$).
- **Trade-offs**:
  - *Advantage*: Fast, robust, unsupervised, highly sensitive to task-switching spikes.
  - *Disadvantage*: Requires tuning the `contamination` hyperparameter ($0.10$).

---

### Decision 3: 40-Session Sliding Window vs. Cumulative Infinite Dataset

- **Context**: Managing the training dataset size over months and years of application usage.
- **Choice**: Capping the training dataset to a rolling window of the **most recent 40 sessions**.
- **Rationale**:
  - **Concept Drift Adaptation**: A user's work habits evolve over time (changing projects, shifting schedules, improving stamina). An infinite dataset gives equal weight to sessions completed two years ago, blunting the model's ability to adapt to recent behavioral shifts.
  - **Deterministic Training Latency**: Retraining a 40-row Random Forest takes $< 0.8\text{ seconds}$ on a laptop CPU. An unbounded dataset would steadily increase retraining time and memory usage.
- **Trade-offs**:
  - *Advantage*: Rapid adaptation to seasonal/behavioral changes, sub-second retraining.
  - *Disadvantage*: Discards long-term historical records from the active ML window (though they remain permanently archived in SQLite `sessions`).

---

### Decision 4: Cold-Start Synthetic Bootstrapping vs. Mandatory Warmup Period

- **Context**: Handling a freshly installed application with zero recorded sessions.
- **Choice**: Pre-generating a synthetic pool of 40 baseline sessions (`synthetic_generator.py`) and dynamically replacing them with real user sessions as they occur.
- **Rationale**:
  - If users are told "Machine Learning will be available after you complete 40 focus sessions," they will not see ML insights for weeks, degrading product engagement.
  - Bootstrapping with synthetic data provides an immediate, functional baseline on Day 1 that progressively morphs into a personalized model.
- **Trade-offs**:
  - *Advantage*: Immediate day-one ML experience, transparent window composition logging.
  - *Disadvantage*: Initial predictions reflect generalized synthetic assumptions until the user logs real data.

---

### Decision 5: Single-Call CLI Process (`predict.py`) vs. Persistent Local Flask/FastAPI Daemon

- **Context**: Serving predictions to the Electron Main Process every 5 seconds.
- **Choice**: Spawning `predict.py` via Node.js `child_process.spawn` on demand.
- **Rationale**:
  - Running a persistent Python HTTP server (Flask, FastAPI, or Uvicorn) consumes $50 - 80\text{ MB}$ of constant idle RAM and occupies a local TCP port (e.g. 8000), creating port conflict liabilities and firewall warning prompts.
  - In Focus Engine, `predict.py` launches, executes in $< 90\text{ ms}$, and terminates, keeping idle memory at absolute zero when the user is not actively running a session.

---

## 3. Known Limitations & Future Roadmap

1. **Process Spawn Overhead**:
   - *Limitation*: Calling `predict.py` every 5 seconds incurs small OS process creation overhead ($\approx 80\text{ ms}$).
   - *Future Recommendation*: Export the trained scikit-learn models to **ONNX** format (`.onnx`) and execute them directly inside Node.js via `onnxruntime-node`, achieving sub-millisecond inference with zero Python subprocess spawning.
2. **Context-Aware Semantic Categorization**:
   - *Limitation*: The current ML models treat all app switches identically, regardless of whether the switch was between two code editors or between an editor and a game.
   - *Future Recommendation*: Engineer a transition entropy feature:
     $$H = -\sum p(i \to j) \log p(i \to j)$$
     to mathematically distinguish between productive development tool hopping and fragmented distraction wandering.
