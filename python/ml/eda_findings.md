# Focus Engine - Exploratory Data Analysis (EDA) Findings

This document summarizes our exploratory data analysis of the sliding training window dataset (`dataset.csv`), evaluating dataset quality, feature correlations, and the realism of our bootstrapped synthetic sessions.

---

## 1. Dataset Rationale & Description

The sliding training window selects the **40 most recent sessions** by timestamp across both real and synthetic datasets combined. 
- **Window Composition**: `0` real sessions, `40` synthetic sessions (`0.0%` real)
- **Observations**: Since we sort chronologically descending (most recent first), and our 200 synthetic pool sessions are spread over a 90-to-10 days ago backdated window, the 40 most recent rows represent the second half of the generated pool (which consists of the **LOW-FOCUS** archetype).

### Feature Summary Statistics (`df.describe()`)
- **`session_duration`**: Average of `1,489.5` seconds (~25 minutes), ranging from `640` to `2,314` seconds.
- **`focus_score`**: Mean of `29.1`, min of `15`, max of `45`. This aligns perfectly with the target distributions of the low-focus archetype.
- **`avg_buffer`**: Mean of `29.58%`, min of `20.0%`, max of `40.52%`. This confirms that the focus buffer levels correctly correspond to the low focus scores.
- **`focus_time`**: Average of `497.8` seconds, representing an average focus state ratio of ~33%.
- **`avg_kpm`**: Average of `4.93` keys per minute, modeling low/erratic user typing activity.
- **`pause_count`**: Average of `5.08` pauses per session, showing repeated interruptions.
- **`app_switches`**: Average of `18.98` switches per session, modeling high window-switching distraction frequency.

---

## 2. Null Handling Strategy
- **Target Variable (`focus_score`)**: Rows missing `focus_score` are dropped immediately using `df.dropna(subset=['focus_score'])`. A machine learning model cannot train on instances lacking a target label.
- **Feature Imputation**: Any null values in the feature columns are imputed using the **Median** of that feature column.
  - *Why Median?* The median is robust to outliers, preventing extreme anomalous sessions (e.g. single massive spikes in KPM or very long session durations) from skewing the imputation baseline.
- **Current Window Quality**: The current sliding window has `0` null values across all columns; no imputations were required.

---

## 3. Outlier Audit
- **Impossible Durations**: Checks flag any session duration $\le 0$ seconds or $> 12$ hours. 
  - *Result*: `0` sessions flagged.
- **Impossible KPM**: Checks flag any average keys-per-minute values $> 400$ (indicating potential input spam or listener loop errors).
  - *Result*: `0` sessions flagged.

---

## 4. Does synthetic data look realistic compared to my real sessions so far?

Since we performed a thorough database cleanup in Day 40.5 to purge engineering test data, there are currently **0 real completed sessions** with a computed `focus_score` in the database. Thus, a direct overlap histogram comparison between real and synthetic data distributions is not yet available.

However, comparing the synthetic records to our logical design and general focus heuristics shows high realism:
1. **Coherence**: The low-focus synthetic subset accurately clusters distracted behaviors—high app switching (`~19` times), frequent pauses (`~5` times), and low keyboard activity (`~4.9` KPM) naturally result in low average buffers (`~29.6%`) and low focus scores (`~29.1`).
2. **Transition Strategy**: As soon as you log real completed sessions, they will be written with current (new) timestamps. Due to descending sorting, these real sessions will immediately enter the sliding window at the top, pushing out these backdated low-focus synthetic records first.
3. **Distribution Overlap**: Once real sessions accumulate, the overlap histogram saved at `eda_output/focus_score_dist.png` will show how the real session scores compare to the synthetic high-focus and low-focus archetypes, signaling if calibration changes are necessary.
