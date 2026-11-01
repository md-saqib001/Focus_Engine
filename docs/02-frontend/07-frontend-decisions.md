# Frontend Engineering Decisions

## 1. Overview

This document analyzes the critical architectural and engineering decisions made in the Focus Engine frontend, detailing the trade-offs, advantages, alternatives considered, and future recommendations.

---

## 2. Key Architectural Decisions

### Decision 1: React Context + Custom Hooks vs. External State Library (Redux/Zustand)

- **Context**: Focus Engine requires global awareness of the active session, timer status, and incoming telemetry across multiple views (`Dashboard`, `History`, `Settings`).
- **Choice**: React 18 Context (`FocusSessionContext`) paired with domain hooks (`useTimerEngine`, `useFocusSession`, `useFocusBuffer`).
- **Rationale**:
  - Eliminates external dependencies and bundle bloat.
  - The state domain is cohesive and centered around a single active session state machine.
  - React 18 concurrent features handle render scheduling natively.
- **Trade-offs**:
  - *Advantage*: Zero overhead, direct TypeScript typing, minimal boilerplate.
  - *Disadvantage*: Context re-renders all consumers when any property changes. Mitigated in Focus Engine by scoping high-frequency telemetry (Focus Buffer) to dedicated local hooks rather than global context.
- **Alternatives Considered**:
  - *Redux Toolkit*: Overkill for a local desktop utility; introduces excessive action/reducer boilerplate.
  - *Zustand*: Excellent alternative, but standard React primitives proved sufficient without additional package dependencies.

---

### Decision 2: Epoch-Anchored Differential Timing vs. Naive Sequential Counter

- **Context**: Timer accuracy is mission-critical for productivity analytics and session logs.
- **Choice**: Deriving elapsed duration from system epoch timestamps (`Date.now() - startTimeRef.current + accumulatedSecondsRef.current`) executed on a 200ms tick loop.
- **Rationale**:
  - `setInterval` is inherently non-deterministic. Operating system thread scheduling, CPU load, and Chromium background tab throttling cause variable drift.
  - System sleep/suspend stops JavaScript timers entirely.
  - Anchoring to `Date.now()` ensures that whenever the tick fires, the mathematical calculation reflects the true wall-clock time difference regardless of intervening delays.
- **Trade-offs**:
  - *Advantage*: Zero drift over infinite session lengths; immune to CPU throttling; resumes accurately after laptop sleep.
  - *Disadvantage*: If the host OS clock is manually adjusted backwards during a session, elapsed time could temporarily compute smaller.
- **Alternatives Considered**:
  - *Web Worker Timer*: Moves `setInterval` off the main renderer thread. While immune to DOM blocking, it still suffers from OS-level sleep delays and requires postMessage IPC overhead.
  - *Electron Main Process Clock*: Driving the timer in Node.js and streaming seconds over IPC. Rejected to avoid saturating IPC channels with 1Hz clock traffic when the frontend can compute it locally.

---

### Decision 3: 200ms Polling Tick vs. 1000ms Standard Tick

- **Context**: Standard countdown timers update once per second ($1000\text{ ms}$).
- **Choice**: Using a $200\text{ ms}$ interval loop in `useTimerEngine.ts`.
- **Rationale**:
  - Improves user responsiveness: when a user clicks "Start", "Pause", or "Resume", the UI transitions immediately within at most 200ms rather than lagging up to 1 full second.
  - Smooths SVG circular progress ring animation transitions in `TimerDisplay.tsx`.
- **Trade-offs**:
  - *Advantage*: Crisp, professional UI feedback.
  - *Disadvantage*: $5\times$ more JavaScript tick evaluations per second. Mitigated because the tick calculation is a lightweight arithmetic expression with zero DOM reflows until integer second boundaries change.

---

### Decision 4: In-Memory Tab Routing vs. `react-router-dom`

- **Context**: The desktop app consists of 5 primary views (`Dashboard`, `Analytics`, `History`, `Settings`, `Debug`).
- **Choice**: A stateful string-based tab switcher in `App.tsx` (`activeTab: 'dashboard' | ...`).
- **Rationale**:
  - Focus Engine is a self-contained Electron window; browser history, URL path routing, and back/forward browser navigation are unnecessary.
  - Avoids URL synchronization bugs when packaged as a local `file://` or custom protocol bundle in production.
- **Trade-offs**:
  - *Advantage*: Zero routing dependencies; persistent component trees without route unmount flashes.
  - *Disadvantage*: No deep-linking capabilities (e.g. launching the app directly into `Settings`).

---

### Decision 5: Atomic Double-Save Ref Guard (`hasSavedRef`)

- **Context**: When a Pomodoro timer reaches $0\text{ s}$, `timerState` transitions to `'completed'`, which triggers React `useEffect` listeners.
- **Choice**: A boolean `useRef(false)` check before dispatching `window.focusEngineAPI.saveSession()`.
- **Rationale**:
  - React 18 strict mode and concurrent re-renders can invoke effects twice.
  - Without an atomic ref guard, duplicate session records with identical timestamps could be written to SQLite.
- **Trade-offs**:
  - *Advantage*: Bulletproof deduplication at the component level.
  - *Disadvantage*: Developers adding new session end triggers must remember to respect `hasSavedRef`.

---

## 3. Known Limitations & Future Recommendations

1. **Window Close During Active Session**:
   - *Current Limitation*: If the user hard-closes the Electron window (ALT+F4 or Task Manager kill) while a timer is running, the running session is not cleanly finalized in SQLite with an `'abandoned'` record.
   - *Recommendation*: Implement an Electron `before-unload` / `app.on('before-quit')` synchronous flush handler in the main process to finalize any unpersisted session.
2. **Audio Notifications**:
   - *Current Limitation*: Session completion alerts are visual only (`flashEffect` CSS animation).
   - *Recommendation*: Integrate Web Audio API chime sounds on Pomodoro completion and break transitions.
