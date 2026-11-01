# Focus Engine - Model Training Results

This document tracks a historical log of our model training runs, recording metrics alongside the real/synthetic data ratio of the sliding training window.

---

## Model Runs History

### Run Date: 2026-07-09 (Initial Bootstrap Training)

#### 1. Training Window Composition
- **Total Window Size**: 40 sessions
- **Real Sessions**: 0 (0.0%)
- **Synthetic Sessions**: 40 (100.0%)
- **Ratio (Real:Synthetic)**: `0 : 40`

#### 2. Focus Score Regressor (RandomForestRegressor)
- **Parameters**: `n_estimators=100`, `max_depth=5` (restrained to prevent overfitting on the small 40-row dataset)
- **Test Set Metrics (80/20 Split)**:
  - **R² Score**: `0.0763`
  - **Mean Absolute Error (MAE)**: `5.4924`
- **5-Fold Cross-Validation Metrics**:
  - **Mean CV R²**: `-0.3366` (std: `0.4104`)
  - **Mean CV MAE**: `6.1398` (std: `1.1155`)
- **Key Note**: The negative CV R² is expected. Because the current sliding window is composed entirely of low-focus sessions, the variation in the dataset is extremely narrow (scores range only between 15 and 45). The model's baseline predictions are close to the mean, resulting in a low/negative R² score. R² will become highly meaningful once high-focus sessions (scores > 70) enter the window to introduce variance.
- **Top 5 Feature Importances**:
  1. `app_switches`: `0.3855`
  2. `avg_buffer`: `0.1362`
  3. `max_buffer`: `0.0735`
  4. `hour_of_day`: `0.0698`
  5. `mouse_activity`: `0.0656`

#### 3. Anomaly Detector (IsolationForest)
- **Parameters**: `contamination=0.1`
- **Training Source**: Trained on 100 high-focus sessions (focus_score $\ge 70$) extracted from the full synthetic pool (fallback triggered due to zero high-focus sessions in the current 40-row sliding window).
- **Evaluation on Sliding Window (40 Low-Focus Sessions)**:
  - **Low-Focus Sessions Flagged as Anomalies**: `40 / 40` (`100.0%` anomaly rate)
- **Validation**: confirmed that the unsupervised detector correctly identifies low-focus metrics (high switching, high pauses, low typing speed) as major deviations from focused states.
