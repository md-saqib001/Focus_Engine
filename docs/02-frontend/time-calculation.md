# Time Calculation Engine

## 1. Executive Summary & Core Philosophy

In productivity and focus tracking software, naive timer implementations rely on sequential counter increments:
```typescript
// ANTIPATTERN (NOT USED IN FOCUS ENGINE):
setInterval(() => { setSeconds(s => s + 1) }, 1000)
```
This naive approach suffers from severe **timer drift**, **CPU throttling**, and **sleep corruption**:
- Chromium aggressively throttles `setInterval` in background or minimized tabs (down to 1 execution per minute or less).
- High CPU load delays JavaScript event-loop ticks, causing timers to lose 2–10 seconds every hour.
- If the operating system enters ACPI Sleep (S3/Modern Standby) or the user suspends the laptop lid, `setInterval` pauses completely, failing to account for suspended time upon resume.

To guarantee zero drift and precision, **Focus Engine employs an Epoch-Anchored Differential Time Calculation Architecture**. Time is never accumulated by counting ticks. Instead, all durations are derived mathematically from OS-level epoch millisecond timestamps using `Date.now()`, combined with an **Accumulated Segment Ledger**.

---

## 2. Core Mathematical Formulations

### Formula 1: Running Segment Elapsed Time ($E_{\text{segment}}$)

When a timer is actively running, the elapsed time within the *current unpaused interval* is:

$$E_{\text{segment}}(t) = \left\lfloor \frac{t_{\text{now}} - t_{\text{start}}}{1000} \right\rfloor$$

Where:
- $t_{\text{now}}$: Current Unix epoch timestamp in milliseconds (`Date.now()`).
- $t_{\text{start}}$: Epoch millisecond timestamp captured at the moment the timer was started or resumed (`startTimeRef.current`).
- $\lfloor \dots \rfloor$: Floor division operator (`Math.floor`) mapping fractional milliseconds to complete integer seconds.

---

### Formula 2: Total Session Elapsed Time ($E_{\text{total}}$)

Sessions can be paused and resumed arbitrarily. The total elapsed time of a session across its entire lifecycle is:

$$E_{\text{total}} = A + E_{\text{segment}}$$

$$E_{\text{total}} = A + \begin{cases} 
0 & \text{if } t_{\text{start}} = 0 \text{ (Paused or Idle)} \\ 
\left\lfloor \frac{t_{\text{now}} - t_{\text{start}}}{1000} \right\rfloor & \text{if } t_{\text{start}} > 0 \text{ (Running)} 
\end{cases}$$

Where:
- $A$: Accumulated seconds ledger (`accumulatedSecondsRef.current`). This stores the exact sum of all seconds spent in previous running segments prior to the latest pause.
- $t_{\text{start}}$: The anchor timestamp of the active segment. Set to `0` when paused or idle.

---

### Formula 3: Pomodoro Remaining Time ($T_{\text{remaining}}$)

In Pomodoro mode, the user configures a target duration. The display counts down to zero:

$$T_{\text{remaining}} = \max\left(0, D_{\text{planned}} - E_{\text{total}}\right)$$

Where:
- $D_{\text{planned}}$: Total planned duration in seconds (`totalDurationSeconds = durationMinutes * 60`).
- $E_{\text{total}}$: Total elapsed seconds computed via Formula 2.

When $T_{\text{remaining}} = 0$, the session transitions automatically to `'completed'`, triggers `finalizeSession(true, 'auto_complete')`, and halts the polling loop.

---

### Formula 4: Circular Progress Ratio ($P$)

Used by `TimerDisplay.tsx` to set the SVG stroke dash offset:

$$P = \begin{cases} 
\frac{T_{\text{remaining}}}{D_{\text{planned}}} & \text{in Pomodoro Mode } (D_{\text{planned}} > 0) \\ 
\text{null} & \text{in Standard Mode (Open-Ended)} 
\end{cases}$$

$$\text{StrokeDashOffset} = C \times (1 - P)$$

Where $C = 2 \times \pi \times 90 \approx 565.4867\text{ px}$.

---

### Formula 5: Time Breakdown to Monospace Display Units

To render `HH:MM:SS` from total integer seconds $S$ ($S = T_{\text{remaining}}$ in Pomodoro, or $S = E_{\text{total}}$ in Standard):

$$H = \left\lfloor \frac{S}{3600} \right\rfloor$$

$$M = \left\lfloor \frac{S \pmod{3600}}{60} \right\rfloor$$

$$\text{Sec} = S \pmod{60}$$

---

## 3. Concrete Numerical Walkthrough

Let us trace a real-world user scenario step by step:
**Scenario**: User starts a 25-minute Pomodoro focus session ($D_{\text{planned}} = 1500\text{ s}$). After 10 minutes (600s), the user pauses for coffee for 5 minutes (300s), resumes for 2 minutes (120s), and checks the timer.

### Step 1: Session Initialization ($t = 1\,700\,000\,000\,000\text{ ms}$)
- User clicks "Start Focus (25m)".
- `startPomodoro('focus', 25)` is invoked.
- $D_{\text{planned}} = 25 \times 60 = 1500\text{ seconds}$.
- $t_{\text{now}} = 1\,700\,000\,000\,000\text{ ms}$.
- `sessionStartTime` $\leftarrow 1\,700\,000\,000\,000$.
- `startTimeRef.current` $\leftarrow 1\,700\,000\,000\,000$.
- `accumulatedSecondsRef.current` $\leftarrow 0$.
- Initial UI State: $T_{\text{remaining}} = 1500\text{ s}$ (`25:00`), Progress $P = 1.0$.

### Step 2: Running Phase 1 (10 Minutes Later)
- Time advances by 600,000 ms to $t = 1\,700\,000\,600\,000\text{ ms}$.
- Timer tick fires:
  $$E_{\text{segment}} = \left\lfloor \frac{1\,700\,000\,600\,000 - 1\,700\,000\,000\,000}{1000} \right\rfloor = 600\text{ seconds}$$
  $$E_{\text{total}} = 0 + 600 = 600\text{ seconds}$$
  $$T_{\text{remaining}} = 1500 - 600 = 900\text{ seconds}$$
- Display shows: $900\text{ s} \rightarrow \lfloor 900/60 \rfloor = 15\text{ m}, 0\text{ s}$ (`15:00`). Progress $P = 900 / 1500 = 0.60$.

### Step 3: User Pauses Session
- At $t = 1\,700\,000\,600\,000\text{ ms}$, user clicks "Pause".
- `pause()` executes:
  1. `clearIntervalRef()` stops the 200ms polling timer.
  2. $E_{\text{last}} = \lfloor (1\,700\,000\,600\,000 - 1\,700\,000\,000\,000) / 1000 \rfloor = 600\text{ s}$.
  3. `accumulatedSecondsRef.current` $\leftarrow 0 + 600 = 600\text{ s}$.
  4. `startTimeRef.current` $\leftarrow 0$ (cleared to indicate inactive segment).
  5. State transitions to `'paused'`.

### Step 4: During Pause (Coffee Break - 5 Minutes)
- System clock reaches $t = 1\,700\,000\,900\,000\text{ ms}$ (300 seconds later).
- Because `startTimeRef.current === 0`, `getElapsedSeconds()` evaluates:
  $$E_{\text{total}} = \text{accumulatedSecondsRef.current} = 600\text{ seconds}$$
- Display remains completely frozen at exactly `15:00`. Zero drift occurs.

### Step 5: User Resumes Session
- At $t = 1\,700\,000\,900\,000\text{ ms}$, user clicks "Resume".
- `resume()` executes:
  1. `state` set to `'running'`.
  2. `startTimeRef.current` $\leftarrow 1\,700\,000\,900\,000\text{ ms}$ (new anchor established!).
  3. `setInterval` restarted at 200ms frequency.

### Step 6: Running Phase 2 (2 Minutes Later)
- System clock reaches $t = 1\,700\,001\,020\,000\text{ ms}$ (120 seconds after resume).
- `getElapsedSeconds()` calculates:
  $$E_{\text{segment}} = \left\lfloor \frac{1\,700\,001\,020\,000 - 1\,700\,000\,900\,000}{1000} \right\rfloor = 120\text{ seconds}$$
  $$E_{\text{total}} = 600 + 120 = 720\text{ seconds}$$
  $$T_{\text{remaining}} = 1500 - 720 = 780\text{ seconds}$$
- Display shows: $780 / 60 = 13\text{ minutes}, 0\text{ seconds}$ (`13:00`). Progress $P = 780 / 1500 = 0.52$.

---

## 4. Source Code Mapping

The calculation engine is entirely encapsulated within `src/renderer/hooks/useTimerEngine.ts`:

| Function / Ref | Line Numbers | Exact Role |
|---|---|---|
| `startTimeRef` | L19 | Stores $t_{\text{start}}$ epoch milliseconds of current segment |
| `accumulatedSecondsRef` | L20 | Stores $A$ (cumulative seconds from prior segments) |
| `intervalRef` | L21 | Stores `NodeJS.Timeout` reference for 200ms tick loop |
| `getElapsedSeconds()` | L37–L41 | Computes $E_{\text{total}} = A + E_{\text{segment}}$ |
| `tick()` | L44–L59 | Derives $T_{\text{remaining}}$ and dispatches `setTime()` |
| `startPomodoro()` | L87–L104 | Initializes countdown target and establishes initial epoch anchor |
| `startStandard()` | L68–L84 | Initializes stopwatch target to 0 and establishes initial anchor |
| `pause()` | L107–L116 | Flushes $E_{\text{segment}}$ into $A$ and resets anchor to 0 |
| `resume()` | L119–L127 | Captures fresh `Date.now()` anchor and restarts interval |
| `reset()` | L136–L144 | Completely zeroes $A$, anchor, and UI state |

---

## 5. System Clock, Sleep, and Edge-Case Analysis

### 1. Handling CPU Throttling and Chromium Inactive Tabs
- **Problem**: When the Focus Engine window is minimized or covered by another window, Chromium drops timer resolution from 200ms to 1000ms or 60,000ms.
- **Solution**: Because `getElapsedSeconds()` uses `Date.now()`, the very first tick that executes when the user restores the window calculates the true difference. If 45 seconds elapsed while throttled, the timer immediately jumps forward by 45 seconds rather than lagging.

### 2. Operating System Sleep / Lid Close
- **Behavior**:
  - If a session is **running** and the laptop goes to sleep for 30 minutes, when woken up:
    $$t_{\text{now}} - t_{\text{start}} = 1\,800\,000\text{ ms} = 1800\text{ s}$$
    The timer registers that 30 minutes have elapsed. In Pomodoro mode, remaining time drops to 0 and transitions to `'completed'`.
  - However, the background `BufferOrchestrator` in the main process detects that no mouse/keyboard inputs occurred for $> 300\text{ s}$, triggering an **Auto-Pause** or **Force-End** event via IPC.
  - Upon wake, `onSessionAutoPause` or `onSessionForceEnd` receives the IPC event from the main process, synchronizing the UI to pause or terminate the session gracefully.

### 3. System Clock Synchronization (NTP Shift)
- If the operating system synchronizes with an NTP server and shifts the system clock backwards while a session is running:
  - $(t_{\text{now}} - t_{\text{start}})$ could temporarily produce a smaller or negative value.
  - In practice, modern OS kernels use monotonic slew adjustments. For extreme clock adjustments, `accumulatedSecondsRef.current` ensures that prior completed segments are permanently safe and cannot be reversed.

---

## 6. Daily and Weekly Aggregations (Main Process & Database)

How are session durations transformed into daily and weekly productivity metrics?

### 1. Daily Total Focus Time
Calculated in `src/main/database/sessionRepository.ts` via SQL query:
```sql
SELECT 
    DATE(ROUND(start_time / 1000), 'unixepoch', 'localtime') AS session_date,
    SUM(duration_actual_sec) AS total_focus_seconds,
    COUNT(*) AS total_sessions
FROM sessions
WHERE completed = 1 AND session_mode = 'pomodoro'
GROUP BY session_date
ORDER BY session_date DESC;
```

### 2. Focus Heatmap Hourly Aggregation
Calculated in `src/main/analytics/heatmapRepository.ts`:
- Each session's `start_time` is converted into Day-of-Week ($0 = \text{Sunday} \dots 6 = \text{Saturday}$) and Hour-of-Day ($0 \dots 23$).
- The database aggregates focus score and duration across all historical records for each cell in the $7 \times 24$ matrix:
$$\text{CellScore}(d, h) = \frac{\sum_{i=1}^N \text{focus\_score}_i}{N}$$
This delivers the empirical productivity distribution rendered on the Analytics page.
