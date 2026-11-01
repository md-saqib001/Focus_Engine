# Telemetry Engineering Decisions

## 1. Overview

This document examines the engineering choices, trade-offs, evaluated alternatives, and technical limitations of the Telemetry Subsystem in Focus Engine.

---

## 2. Key Architectural Decisions

### Decision 1: 1Hz Window Polling vs. OS Native Event Hooks (`SetWinEventHook`)

- **Context**: Detecting when the user switches windows or changes browser tabs.
- **Choice**: A $1000\text{ ms}$ ($1\text{ Hz}$) polling loop querying the frontmost window via Win32 APIs / AppleScript.
- **Rationale**:
  - `SetWinEventHook` (Windows) and `NSWorkspace` notifications (macOS) require compiling native C++ Node.js addons (`node-gyp`), introducing massive build friction and potential ABI incompatibility across Electron upgrades.
  - Native window hooks fire dozens of times per second during rapid window dragging, resizing, or Alt-Tabbing, generating massive noise.
  - Polling at 1Hz provides natural rate-limiting and consumes $< 0.1\%$ CPU while being more than fast enough for human cognitive tracking.
- **Trade-offs**:
  - *Advantage*: Zero native build toolchain dependencies, stable across all OS versions, predictable CPU usage.
  - *Disadvantage*: Up to 1-second delay in detecting a newly focused window.

---

### Decision 2: Aggregate Pulse Keystroke Counting vs. Keycode Logging

- **Context**: Measuring typing cadence to infer cognitive focus.
- **Choice**: Incrementing an integer counter without inspecting key codes, text characters, or modifier keys.
- **Rationale**:
  - **Absolute Privacy**: Eliminates any possibility of passwords, credit cards, or private messages being logged.
  - **Corporate Security Compliance**: Allows Focus Engine to be used in enterprise and regulated engineering environments where keyloggers are strictly prohibited by IT policy.
- **Trade-offs**:
  - *Advantage*: 100% privacy, lightweight memory footprint, zero security liability.
  - *Disadvantage*: Cannot distinguish between productive typing (writing code) and random hammering of the spacebar. Mitigated by pairing keystroke activity with active window categorization and CV gaze metrics.

---

### Decision 3: 60-Second Chunking for Mouse & Keyboard Metrics vs. 1-Second Logging

- **Context**: Persisting HCI timeseries data to SQLite.
- **Choice**: Aggregating keystroke counts and mouse movement distances into 60-second summary blocks before writing to the database.
- **Rationale**:
  - Writing to SQLite every second for hours would produce tens of thousands of disk I/O operations and database locks, degrading battery life on laptops.
  - 60-second resolution is the standard clinical granularity for calculating KPM and physical fatigue trends without database bloat.
- **Trade-offs**:
  - *Advantage*: Reduces database writes by $60\times$, preserves SSD longevity, maintains high query performance on historical analytics.
  - *Disadvantage*: Requires scaling math for partial final-minute segments when a session ends abruptly.

---

### Decision 4: Window Title Domain Parsing vs. Browser Extension Web Navigation API

- **Context**: Identifying visited websites in Google Chrome, Brave, and Edge.
- **Choice**: Regex domain extraction from the native OS window title string (`domainRegex = /([a-z0-9|-]+\.[a-z0-9|-]+(?:\.[a-z]{2,})?)/gi`).
- **Rationale**:
  - Requires zero installation of browser extensions.
  - Operates across all installed browsers automatically.
- **Trade-offs**:
  - *Advantage*: Frictionless setup, universal browser coverage.
  - *Disadvantage*: Only domains visible in the browser window title can be parsed. If a browser does not include the domain name in the window title, the system falls back to classifying the app as a generic web browser.

---

## 3. Known Limitations & Future Roadmap

1. **Browser Tab Titles Without Domain**:
   - *Limitation*: Some web applications (e.g. custom webmail or intranet pages) do not include their domain in the `<title>` tag.
   - *Future Recommendation*: Provide an optional companion browser extension that pushes exact URL origins to Focus Engine via local WebSocket or native messaging host.
2. **Virtual Desktop & Multi-Monitor Transitions**:
   - *Limitation*: When working across multiple physical monitors, Windows only reports the single window with active keyboard focus as `GetForegroundWindow()`.
   - *Future Recommendation*: Sample gaze coordinates from the CV engine to determine which physical monitor the user is viewing when multiple windows are simultaneously visible.
