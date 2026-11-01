# Heatmap Matrix Aggregation Architecture

## 1. Overview and Purpose

The **Heatmap Repository** (`src/main/analytics/heatmapRepository.ts`) compiles an aggregated 2-dimensional matrix representing focus performance across the weekly circadian cycle:
- **X-Axis**: 24 Hours of the day (`00:00` to `23:00`).
- **Y-Axis**: 7 Days of the week (`Sunday = 0` to `Saturday = 6`).

This matrix powers the visual circadian focus chart on the analytics dashboard, allowing users to spot temporal productivity peaks (e.g., deep flow on Tuesday mornings between 09:00 and 11:00) and slump periods (e.g., Friday afternoons after 15:00).

---

## 2. SQL Matrix Aggregation Query

The 168 possible temporal cells ($7 \times 24 = 168$) are computed directly within the SQLite query engine using high-performance grouping and native date-time formatters:

```sql
SELECT 
  CAST(strftime('%w', start_time / 1000, 'unixepoch', 'localtime') AS INTEGER) as dayOfWeek,
  CAST(strftime('%H', start_time / 1000, 'unixepoch', 'localtime') AS INTEGER) as hourOfDay,
  AVG(focus_score) as avgScore,
  COUNT(*) as sessionCount
FROM sessions
WHERE focus_score IS NOT NULL
GROUP BY dayOfWeek, hourOfDay
```

### Format Specifiers and Type Casting
1. `start_time / 1000`: Converts Unix epoch milliseconds (JavaScript timestamp standard) to seconds (SQLite `unixepoch` standard).
2. `'unixepoch'`: Instructs SQLite to interpret the numeric value as an epoch second count.
3. `'localtime'`: Crucial modifier that rebases UTC epoch time to the host operating system's local time zone before extraction.
4. `strftime('%w')`: Extracts day of week as a string `'0'` (Sunday) through `'6'` (Saturday).
5. `strftime('%H')`: Extracts hour of day in 24-hour format `'00'` through `'23'`.
6. `CAST(... AS INTEGER)`: Casts string outputs to strongly typed integers for clean JSON serialization across IPC.

---

## 3. Data Contract

The repository exposes the strongly typed `HeatmapCell` interface:

```typescript
export interface HeatmapCell {
  dayOfWeek: number    // 0-6 (0 is Sunday, 6 is Saturday)
  hourOfDay: number    // 0-23
  avgScore: number     // Average focus score for sessions starting in this bucket (0-100)
  sessionCount: number // Total completed sessions recorded in this cell
}

export const heatmapRepository = {
  getFocusHeatmapData(): HeatmapCell[] {
    const db = getDatabase()
    const stmt = db.prepare(`...`)
    return stmt.all() as HeatmapCell[]
  }
}
```

---

## 4. Downstream Weighted Aggregation

The raw heatmap cells are not only rendered directly in the React UI; they also serve as the mathematical foundation for scalar KPI extraction in `productivityAnalytics.ts`.

Because different hours have drastically different sample sizes, a naive average across cells would distort productivity metrics:
- An hour with 1 session scored at $100\%$ should **not** have equal weight to an hour with 25 sessions averaging $88\%$.

To solve this, `pickBestAndWorstHour` and `pickMostProductiveDay` perform session-count weighted sum collapses across axes:

$$\text{WeightedHourScore}(H) = \frac{\sum_{c \in \text{cells}, c.\text{hour} = H} c.\text{avgScore} \times c.\text{sessionCount}}{\sum_{c \in \text{cells}, c.\text{hour} = H} c.\text{sessionCount}}$$

$$\text{WeightedDayScore}(D) = \frac{\sum_{c \in \text{cells}, c.\text{day} = D} c.\text{avgScore} \times c.\text{sessionCount}}{\sum_{c \in \text{cells}, c.\text{day} = D} c.\text{sessionCount}}$$

This guarantees that hours backed by substantial real-world data dominate the best/worst rankings, avoiding outlier distortion from isolated sessions.
