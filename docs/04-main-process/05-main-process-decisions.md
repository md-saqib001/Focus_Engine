# Main Process Engineering Decisions

## 1. Overview

This document analyzes the engineering trade-offs, evaluated alternatives, and architectural decisions made in the Electron Main Process of Focus Engine.

---

## 2. Key Architectural Decisions

### Decision 1: Electron Main Process as Central Coordinator vs. External Background Daemon

- **Context**: Focus Engine requires continuous OS-level telemetry collection, process monitoring, and hosts file enforcement.
- **Choice**: Co-locating all background services directly within the Electron Node.js Main Process.
- **Rationale**:
  - Eliminates external installer requirements (such as registering a Windows Service or macOS LaunchDaemon).
  - Simplifies application distribution: The user downloads a single `.exe` or `.dmg` that runs out-of-the-box.
  - Zero inter-process network overhead between the UI coordinator and the background telemetry collector.
- **Trade-offs**:
  - *Advantage*: Unified packaging, simple build pipeline, zero complex IPC sockets across multiple standalone binaries.
  - *Disadvantage*: When the user closes the Electron app, all telemetry collection ceases. (This is intentional, as focus sessions are user-initiated and bounded).

---

### Decision 2: Python Child Process via `stdio` JSON vs. Native C++ Node Addon (node-gyp)

- **Context**: Integrating OpenCV, MediaPipe, and Scikit-Learn with Node.js.
- **Choice**: Spawning Python as an independent child process (`child_process.spawn`) communicating via line-delimited JSON over `stdin`/`stdout`.
- **Rationale**:
  - **Memory & Process Isolation**: Computer vision (frame decoding, landmark regression) is computationally heavy and memory-intensive. If OpenCV encounters a C++ segmentation fault or memory leak, only the child Python process crashes—the core Electron app and timer remain completely unaffected.
  - **Ecosystem Leverage**: Python has vastly superior, mature libraries for computer vision (OpenCV, MediaPipe) and machine learning (scikit-learn, numpy, pandas) compared to fragmented Node.js bindings.
  - **Compilation Portability**: Avoids complex native `node-gyp` compilation requirements (Visual Studio C++ build tools, Python headers) on developer machines.
- **Trade-offs**:
  - *Advantage*: Crash isolation, rapid prototyping, access to the entire Python scientific ecosystem.
  - *Disadvantage*: Small JSON serialization overhead per frame ($< 1\text{ ms}$) and requirement for a local Python runtime or bundled virtual environment.

---

### Decision 3: Single-Window Architecture vs. Multi-Window Floating Widgets

- **Context**: Presenting the timer and HUD to the user while they work in other desktop applications.
- **Choice**: A unified single-window interface ($900 \times 670\text{ px}$) without persistent floating transparent overlay windows.
- **Rationale**:
  - Transparent always-on-top overlay windows in Electron often interfere with native full-screen applications, video games, or multi-monitor workspaces.
  - Keeps GPU composition overhead low.
  - Users focus on their primary work applications; intrusive desktop overlays can ironically become a distraction themselves. Focus Engine relies on system notifications and audible state shifts.
- **Trade-offs**:
  - *Advantage*: Low memory footprint, reliable rendering across all OS window managers.
  - *Disadvantage*: User must switch back to the Focus Engine window to glance at the timer if they do not have a dual-monitor setup.

---

### Decision 4: Domain-Segmented IPC Registration Modules

- **Context**: Managing over 30 distinct IPC channels across database queries, blocking, telemetry, buffer orchestration, and computer vision.
- **Choice**: Segregating handlers into 8 isolated modules under `src/main/ipc/` (`sessionHandlers`, `blockingHandlers`, etc.) called by `index.ts`.
- **Rationale**:
  - Enforces the Single Responsibility Principle.
  - Allows team members (e.g. Engineer 1 on Database, Engineer 3 on Blocking) to work in separate files without encountering merge conflicts in `index.ts`.
- **Trade-offs**:
  - *Advantage*: High maintainability, clean separation of concerns.
  - *Disadvantage*: Requires manual invocation of registration functions in `index.ts`.

---

## 3. Known Limitations & Future Roadmap

1. **System Tray Integration**:
   - *Limitation*: Currently, closing the window quits the application on Windows. There is no minimization to the system tray.
   - *Recommendation*: Add an Electron `Tray` icon with right-click menu controls to pause/resume sessions and minimize the app to the background without stopping active focus tracking.
2. **Global Native Shortcuts**:
   - *Limitation*: Starting or pausing a session requires interacting with the Focus Engine window directly.
   - *Recommendation*: Register global OS hotkeys via Electron's `globalShortcut` API (e.g. `Ctrl+Alt+F` to pause/resume focus).
