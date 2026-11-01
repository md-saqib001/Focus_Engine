# Data Models

This document maps TypeScript interfaces to their corresponding SQLite columns and explains how data is transformed between layers.

---

## Session Model

### TypeScript Interface (`sessionRepository.ts`)

```typescript
export interface SessionRow {
  session_id: string
  session_mode: 'pomodoro' | 'standard'
  session_type: 'focus' | 'shortBreak' | 'longBreak' | null
  start_time: number        // Unix ms
  end_time: number | null   // Unix ms
  duration_planned_sec: number | null
  duration_actual_sec: number | null
  completed: number         // 0 or 1 (SQLite boolean)
  end_reason: string | null
  focus_score: number | null
  auto_paused_count: number
  pause_count: number
  created_at: number        // Unix ms
  apps_killed?: number      // Computed by JOIN, not stored in column
}
```

### Preload Type (`preload/index.ts`)

```typescript
type SaveSessionArgs =
  | {
      sessionId: string
      mode: 'pomodoro'
      sessionType: 'focus' | 'shortBreak' | 'longBreak'
      startTime: number
      endTime: number
      durationPlannedSec: number
      durationActualSec: number
      completed: boolean
      endReason: 'auto_complete' | 'abandoned'
      autoPausedCount?: number
      pauseCount?: number
    }
  | {
      sessionId: string
      mode: 'standard'
      startTime: number
      endTime: number
      durationActualSec: number
      completed: boolean
      endReason: 'manual_stop' | 'force_ended'
      autoPausedCount?: number
      pauseCount?: number
    }
```

### Frontend Summary Interface (`useFocusSession.ts`)

```typescript
export interface SessionSummary {
  session_id: string
  session_mode: SessionMode
  session_type: SessionType | null
  start_time: number
  end_time: number
  duration_planned_sec: number | null
  duration_actual_sec: number
  completed: boolean
  end_reason: 'auto_complete' | 'manual_stop' | 'abandoned' | 'force_ended'
  apps_killed_count: number
  apps_killed: string[]
  auto_paused_count?: number
}
```

**Key difference**: `SessionSummary` (frontend) uses JavaScript `boolean` for `completed`, while `SessionRow` (database) uses `0 | 1` because SQLite has no boolean type.

---

## Timer Types (`renderer/types/timer.ts`)

```typescript
export type SessionMode = 'pomodoro' | 'standard'
export type SessionType = 'focus' | 'shortBreak' | 'longBreak'
export type TimerState = 'idle' | 'running' | 'paused' | 'completed'
```

These are the discriminated union types used by `useTimerEngine` and `useFocusSession`. They map directly to the database's `session_mode` and `session_type` columns.

---

## Focus Buffer Types (`buffer/focusBuffer.ts`)

```typescript
export interface FocusMultipliers {
  cv: number        // [0.0, 1.0] — CV attention signal
  keyboard: number  // [0.8, 1.0] — Keyboard activity signal
  mouse: number     // [0.8, 1.0] — Mouse activity signal
  window: number    // [0.1, 1.0] — Active window category signal
}

export type FocusState = 'focused' | 'warning' | 'critical' | 'paused'

export interface BufferHistoryEntry {
  timestamp: number  // Unix ms (Date.now())
  value: number      // [0.0, 100.0]
}
```

These types are used in-memory only. The buffer's history is held in `FocusBuffer.history[]` (max 120 entries, 2 minutes). Persistent storage only captures snapshots every 60 seconds via `buffer_snapshots`.

---

## CV Metric Types

### From Python (stdout JSON)

```json
{
  "ts": 1698765432000,
  "frame": 42,
  "face_present": true,
  "landmark_count": 478,
  "confidence": 1.0,
  "yaw": -3.21,
  "pitch": 12.45,
  "roll": -1.02,
  "gaze_direction": "center",
  "gaze_ratio": 0.52,
  "looking_at_screen": true,
  "raw_attention_score": 1.0,
  "smoothed_attention_score": 0.923
}
```

### Stored in `cv_metrics` (subset)

The `gaze_ratio` and `landmark_count` fields from Python are **not** stored in the database — only the fields needed for analytics are persisted.

### Summary Type (`cvMetricsRepository.ts`)

```typescript
interface CVMetricsSummary {
  session_id: string
  avg_attention_score: number   // Mean smoothed_attention_score
  min_attention_score: number   // Min smoothed_attention_score
  face_present_pct: number      // % of frames where face_present = 1
}
```

---

## Telemetry Summary (`telemetryAggregator.ts`)

```typescript
export interface TelemetrySummary {
  sessionId: string
  sessionMode: 'pomodoro' | 'standard'
  sessionType: 'focus' | 'shortBreak' | 'longBreak' | null
  durationActualSec: number
  completed: boolean
  endReason: string | null
  startTime: number
  endTime: number | null

  // Computed aggregations
  categoryBreakdown: { [category: string]: number }
  avgKpm: number
  maxKpm: number
  totalClicks: number
  movementEvents: number
  maxIdleDuration: number
  mostUsedApp: string | null
  mostDistractingDomain: string | null
  totalPauses: number
  distractionsAttempted: number
  focusScore: number | null
  focusScoreComponents: FocusScoreComponents | null
}
```

---

## ML Feature Vector

The feature vector used by both training and inference is defined in `python/ml/constants.py`:

```python
FEATURES = [
    "avg_buffer",         # Mean focus buffer over session
    "min_buffer",         # Minimum focus buffer value
    "max_buffer",         # Maximum focus buffer value
    "focus_time",         # Seconds in 'focused' state (buffer >= 75)
    "attention_time",     # Seconds where CV attention was high
    "avg_kpm",            # Average keystrokes per minute
    "mouse_activity",     # Total mouse movement events
    "pause_count",        # Number of pauses (auto + manual)
    "app_switches",       # Number of app switch events
    "session_duration",   # Total session length in seconds
    "hour_of_day",        # 0–23 (local time)
    "day_of_week",        # 0=Monday, 6=Sunday
    "session_mode_is_standard"  # 1 for standard, 0 for pomodoro
]
```

**Critical constraint**: The order of this list is the exact column order of the feature matrix `X` passed to both training (`train_focus_model.py`) and inference (`predict.py`). If this list is modified without retraining, predictions will be silently incorrect.

---

## Retrain Record (`ml/weeklyRetraining.ts`)

```typescript
export interface RetrainRecord {
  id?: number
  timestamp: number
  real_sessions: number
  synthetic_sessions: number
  r2_score: number
  mae_score: number
  cv_r2_mean: number
  cv_mae_mean: number
  deployed: boolean
}
```

Maps directly to `retrain_history` table columns. `deployed` is stored as `0 | 1` in SQLite and converted to `boolean` on read.

---

## Settings Keys Reference

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `cv_enabled` | string (`"true"`/`"false"`) | `"true"` | Whether CV is active |
| `cv_permission` | string | `"pending"` | Camera permission state |
| `cv_calibration` | JSON string | Default calibration | Calibration JSON v1 or v2 |
| `last_retrain_time` | string (integer ms) | `"0"` | Timestamp of last ML retraining |

All values are stored as TEXT in `app_settings`. Type conversion is the caller's responsibility.
