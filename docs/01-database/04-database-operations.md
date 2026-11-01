# Database Operations

This document explains every significant database query in Focus Engine — what it does, why it exists, what it receives, what it returns, and where it is called from.

---

## Session Operations

### `saveSession()` — `sessionRepository.ts`

**What it does**: Inserts one row into `sessions` when a focus session ends.

**Why it exists**: All session state is held in React during an active session (`useTimerEngine`, `useFocusSession`). The database is only written to once — at session termination — to avoid partial/desync writes.

**Input validation**: Enforces mode contracts before inserting:
- Pomodoro: requires `durationPlannedSec > 0` and non-null `sessionType`
- Standard: requires `durationPlannedSec === null`

```sql
INSERT INTO sessions (
  session_id, session_mode, session_type, start_time, end_time,
  duration_planned_sec, duration_actual_sec, completed, end_reason, created_at,
  auto_paused_count, pause_count
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

**Parameters**: All fields from `useFocusSession.finalizeSession()`, including `autoPausedCount` from `autoPausedCountRef.current` and `pauseCount` from `pauseCountRef.current`.

**Returns**: The inserted `SessionRow` object (with `focus_score: null` — score is not computed at save time).

**Note on `created_at`**: Despite being defined as `DEFAULT (unixepoch()*1000)`, the actual code passes `startTime` as the `created_at` value, making `created_at` equal to `start_time`. This is a subtle implementation detail.

**Called from**: `src/main/ipc/sessionHandlers.ts` → `ipcMain.handle('session:save', ...)`

---

### `getAllSessions()` — `sessionRepository.ts`

**What it does**: Fetches all sessions with the count of killed apps, ordered by most recent first.

```sql
SELECT s.*, COUNT(e.id) as apps_killed
FROM sessions s
LEFT JOIN app_kill_events e ON s.session_id = e.session_id
GROUP BY s.session_id
ORDER BY s.start_time DESC
```

**Why the JOIN**: The `apps_killed` field is not stored in `sessions` directly — it's computed from `app_kill_events`. The LEFT JOIN and GROUP BY compute it on the fly.

**Returns**: Array of `SessionRow` objects. The `apps_killed` field is appended to each row.

**Called from**: `src/main/ipc/sessionHandlers.ts` → `ipcMain.handle('session:getAll', ...)` → `src/renderer/pages/History.tsx`

---

### `getSessionsInDateRange()` — `sessionRepository.ts`

**What it does**: Fetches sessions with `start_time` between two Unix ms timestamps.

```sql
SELECT * FROM sessions
WHERE start_time >= ? AND start_time <= ?
ORDER BY start_time DESC
```

**Called from**: `src/main/analytics/streakCalculator.ts`, `src/main/analytics/productivityAnalytics.ts`

---

### `updateSessionFocusScore()` — `sessionRepository.ts`

**What it does**: Updates the `focus_score` column on an existing session row.

```sql
UPDATE sessions SET focus_score = ? WHERE session_id = ?
```

**Called from**: `src/main/buffer/focusScoreCalculator.ts` after computing the final composite score.

---

## Telemetry Aggregation

### `getSessionTelemetrySummary()` — `telemetryAggregator.ts`

**What it does**: Runs 7 separate queries to compute a comprehensive summary of a session's telemetry data.

**Why it exists**: The renderer's History and Debug pages need per-session aggregated metrics. Rather than running these queries from the renderer (impossible without IPC), the aggregator consolidates them in the main process.

#### Query 1: Category Breakdown

```sql
-- via getCategoryBreakdown() from windowFocusRepository
SELECT category, COUNT(*) as focus_count
FROM window_focus
WHERE session_id = ?
GROUP BY category
```

Returns how many 5-second intervals the user spent in `productive`, `distraction`, `neutral`, `unknown` windows.

#### Query 2: Keyboard Metrics

```sql
SELECT AVG(kpm) as avg_kpm, MAX(kpm) as max_kpm
FROM keyboard_metrics
WHERE session_id = ?
```

**Example**: If the session had readings `[45, 62, 0, 78, 34]`, returns `avg_kpm=43.8, max_kpm=78`.

#### Query 3: Mouse Metrics

```sql
SELECT SUM(click_count) as total_clicks,
       SUM(movement_count) as total_movements,
       MAX(idle_duration) as max_idle
FROM mouse_metrics
WHERE session_id = ?
```

#### Query 4: Most Used App

```sql
SELECT app_name, COUNT(*) as count
FROM window_focus
WHERE session_id = ?
GROUP BY app_name
ORDER BY count DESC
LIMIT 1
```

**Example**: If the user spent 60 intervals in `Code.exe` and 20 in `Chrome.exe`, returns `{app_name: "Code.exe", count: 60}`.

#### Query 5: Most Distracting Domain

```sql
SELECT domain, COUNT(*) as count
FROM window_focus
WHERE session_id = ? AND category = 'distraction'
GROUP BY domain
ORDER BY count DESC
LIMIT 1
```

#### Query 6: Pause Events

```sql
SELECT COUNT(*) as manual_pauses
FROM buffer_state_transitions
WHERE session_id = ? AND state = 'PAUSED'
```

#### Query 7: Distraction Switches

```sql
SELECT category
FROM window_focus
WHERE session_id = ?
ORDER BY timestamp ASC
```

Then computes `distractionSwitches` in TypeScript by counting transitions _into_ the `distraction` category (i.e., when `current === 'distraction' && previous !== 'distraction'`).

**Total distractions** = `apps_killed_count + distractionSwitches`

---

## Window Focus Batch Insert

### `insertBatch()` — `windowFocusRepository.ts`

**What it does**: Writes a batch of window focus records in a single SQLite transaction.

```typescript
// Pseudocode of actual implementation
const insertStmt = db.prepare(`
  INSERT INTO window_focus (session_id, app_name, window_title, domain, category, timestamp)
  VALUES (?, ?, ?, ?, ?, ?)
`)
const insertBatchTx = db.transaction((rows) => {
  for (const row of rows) {
    insertStmt.run(row.session_id, row.app_name, row.window_title, row.domain, row.category, row.timestamp)
  }
})
insertBatchTx(rows)
```

**Why a transaction**: Wrapping batch inserts in a single transaction is dramatically faster than individual inserts because SQLite only flushes to disk once per transaction rather than once per insert.

**When triggered**: `TelemetryPoller` buffers records in memory and flushes when `buffer.length >= 12` (every ~60 seconds at 5s polling) or when `stop()` is called.

---

## Buffer Operations

### Buffer Snapshots Insert

```sql
INSERT INTO buffer_snapshots (session_id, value, timestamp)
VALUES (?, ?, ?)
```

**Triggered**: Every 60 seconds during `BufferOrchestrator.tick()` when `secondsElapsed % 60 === 0`.

### Buffer State Transitions

```sql
-- Open a new transition
INSERT INTO buffer_state_transitions (session_id, state, start_time)
VALUES (?, ?, ?)

-- Close the current active transition
UPDATE buffer_state_transitions
SET end_time = ?, duration = end_time - start_time
WHERE session_id = ? AND end_time IS NULL
```

**Triggered**: On every state machine transition in `BufferOrchestrator.tick()`.

---

## Analytics Queries

### Heatmap — `heatmapRepository.ts`

```sql
SELECT
  strftime('%H', datetime(start_time / 1000, 'unixepoch')) as hour_of_day,
  strftime('%w', datetime(start_time / 1000, 'unixepoch')) as day_of_week,
  AVG(focus_score) as avg_score,
  COUNT(*) as session_count
FROM sessions
WHERE session_type = 'focus' AND completed = 1
GROUP BY hour_of_day, day_of_week
```

**Returns**: A grid of average focus scores by hour-of-day (0–23) and day-of-week (0=Sunday, 6=Saturday). Used to render the `FocusHeatmap` component.

### Streak Calculation — `streakCalculator.ts`

The streak calculator queries sessions within rolling date windows:
1. Gets today's focus sessions to determine if today's streak is active.
2. Walks backward day-by-day to find the longest consecutive streak.

**Key query**:
```sql
SELECT * FROM sessions
WHERE start_time >= ? AND start_time <= ?
  AND session_type = 'focus' AND completed = 1
ORDER BY start_time DESC
```

### Productivity Summary — `productivityAnalytics.ts`

Computes weekly and all-time statistics including:
- Total focus time
- Average session duration
- Best focus score
- Most productive day of week
- Most distracting application

---

## CV Metrics

### Insert CV Metric

```sql
INSERT INTO cv_metrics (
  session_id, face_present, yaw, pitch, roll,
  gaze_direction, looking_at_screen,
  raw_attention_score, smoothed_attention_score, timestamp
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

**Triggered**: Every time a JSON record arrives from the Python CV subprocess stdout (~every 500ms at 2 fps).

### Generate CV Summary

**Source**: `cvMetricsRepository.ts`

```sql
SELECT
  AVG(smoothed_attention_score) as avg_attention_score,
  MIN(smoothed_attention_score) as min_attention_score,
  AVG(CAST(face_present AS REAL)) * 100 as face_present_pct
FROM cv_metrics
WHERE session_id = ?
```

Then inserts one row into `cv_metrics_summary`. Called when the session ends.

---

## Settings Repository

### Get Setting

```sql
SELECT setting_value FROM app_settings WHERE setting_key = ?
```

Returns the string value, or a default if not found.

### Set Setting

```sql
INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value
```

Uses SQLite's `UPSERT` syntax (INSERT OR REPLACE semantics via `ON CONFLICT`).
