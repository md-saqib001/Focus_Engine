# Analytics & Insights Architecture Decisions & Trade-Offs

## 1. Architectural Decision Records (ADRs)

### ADR-01: SQLite-Side Local Time Rebasing vs. Client-Side JavaScript Processing
- **Context**: Timestamps in the `sessions` table are recorded as UTC epoch milliseconds (`Date.now()`). To compute heatmaps and day-of-week aggregations, timestamps must reflect the user's physical circadian schedule.
- **Alternatives Considered**:
  1. *Client-Side Processing*: Fetch all historical session rows into Electron/Node.js, convert each timestamp with `new Date(start_time)`, and bucket into JavaScript arrays.
  2. *SQLite-Side Processing*: Use SQLite's native date functions: `strftime('%w', start_time / 1000, 'unixepoch', 'localtime')`.
- **Decision**: Adopt SQLite-side formatting and aggregation (`unixepoch` + `'localtime'`).
- **Rationale**:
  - Pushes aggregation down to SQLite's compiled C-engine. Instead of transferring tens of thousands of session rows over IPC into Node.js V8 memory, SQLite executes the group-by in microseconds and returns only the 168 cells.
  - Guarantees consistency across OS timezones without manual offset arithmetic in JavaScript.
- **Trade-Off**: SQLite's `strftime` requires millisecond timestamps to be divided by 1000. Handled cleanly in repository query templates.

---

### ADR-02: Pure Math Decoupling for Habit Streaks
- **Context**: Testing date-math and streak logic against database instances is slow, brittle, and subject to test-environment timezone pollution.
- **Decision**: Isolate the streak calculation algorithm into a pure mathematical function (`computeStreaksFromDates(dates: string[], now: Date)`). The repository module only handles SQLite data retrieval and delegates directly to the pure function.
- **Rationale**:
  - Enables comprehensive unit tests covering edge cases: daylight saving shifts, leap years, multi-year runs, inactive gaps, and late-night completions without requiring database mocks or file I/O.
  - Follows functional programming principles: deterministic inputs yield deterministic outputs.

---

### ADR-03: Contiguous 2-Hour Window Heuristic
- **Context**: Determining the user's peak focus window for recommendation prompts.
- **Alternatives Considered**:
  1. *Single 1-Hour Slot* (e.g., "10:00 - 11:00"): Prone to high variance and noise. If a user did one 20-minute session at 03:00 AM scored at $99\%$, it would dominate as their peak hour.
  2. *Contiguous 2-Hour Block* (e.g., "09:00 - 11:00"): Smooths variance and aligns with human cognitive endurance spans.
- **Decision**: Implement a 2-hour contiguous sliding window with modulo 24 wrap-around and a minimum requirement of 3 completed sessions.
- **Rationale**:
  - Deep work rarely occurs in isolated 45-minute blocks; sustained focus spans multiple Pomodoro cycles.
  - Requiring 3 sessions across the 2-hour block prevents isolated outlier sessions from misleading the user.

---

### ADR-04: Session-Count Weighted Cell Aggregation
- **Context**: When collapsing the 2D heatmap matrix ($7 \times 24$) into 1D circadian vectors (Best Hour, Best Day), naive unweighted averaging skews the truth:
  $$\text{Naive Avg} = \frac{100\% (1 \text{ session}) + 70\% (20 \text{ sessions})}{2} = 85\%$$
- **Decision**: Use session-count weighted sum aggregation in `pickBestAndWorstHour` and `pickMostProductiveDay`:
  $$\text{WeightedScore} = \frac{\sum \text{avgScore} \times \text{sessionCount}}{\sum \text{sessionCount}}$$
- **Rationale**:
  - Reflects empirical statistical truth: hours backed by deep statistical volume rightfully carry proportional influence.
  - Eliminates false positives where an atypical single session skews the dashboard.

---

### ADR-05: 10-Session Sufficiency Gating
- **Context**: New users launching Focus Engine for the first time have zero or few recorded sessions. Generating recommendations immediately produces misleading advice (e.g., "Your peak focus hour is 2:00 PM" based on a single setup session).
- **Decision**: Enforce a strict threshold of $\ge 10$ completed sessions before marking `hasEnoughData: true`.
- **Rationale**:
  - Builds user credibility. The system explicitly communicates: *"Complete 10 sessions to unlock deep circadian recommendations."*
  - Avoids prematurely categorizing users into incorrect circadian archetypes (Night Owl vs Early Bird).

---

### ADR-06: 100% Offline Local Analytics & Data Sovereignty
- **Context**: Many contemporary productivity apps stream application titles, window tracking, and work schedules to third-party cloud servers for analytics processing.
- **Decision**: All analytics aggregation, streak computation, and recommendation generation are executed strictly on the local machine within SQLite and the Electron main process.
- **Rationale**:
  - Absolute user privacy: window names and focus patterns never leave the host system.
  - Zero latency: dashboard calculations execute in $<5\text{ms}$ with zero network dependency.
  - Operates completely offline, making Focus Engine suitable for air-gapped engineering environments and confidential development workstations.
