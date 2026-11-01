# Module 04: Main Process & IPC Architecture — Presentation & Defense Speech

## 1. Presentation Metadata

- **Target Presentation Duration**: **8 Minutes** (Core system runtime & IPC backbone module)
- **Target Audience**: Electron Specialists, Desktop Systems Architects, Technical Evaluators
- **Primary Objective**: Explain the Node.js Main Process architecture of Focus Engine, detailing application lifecycle coordination, the modular 8-router IPC architecture handling 30+ channels, background service orchestration, and crash-resilient graceful shutdown sequences.
- **Delivery Pace**: ~135 – 145 words per minute (~1,100 spoken words)

---

## 2. Minute-by-Minute Presentation Timeline

| Time Marker | Section Title | Core Technical Message | Visual / Slide Cue |
|---|---|---|---|
| **00:00 – 01:15** | The Main Process as Operating Kernel | Role of `src/main/index.ts`; window construction, security policies, and resource initialization. | Main Process Architecture overview diagram. |
| **01:15 – 03:00** | The 8-Router Modular IPC Architecture | Segregating 30+ IPC channels across 8 domain handlers; eliminating the monolithic `index.ts` anti-pattern. | IPC Router Topology diagram showing typed channel routing. |
| **03:00 – 04:45** | Background Services & Polling Orchestration | Managing 1 Hz telemetry loops, Focus Buffer orchestrator, and Python child process lifecycles. | Timeline sequence of 1 Hz background ticks and IPC push events. |
| **04:45 – 06:30** | Graceful Teardown & Lifecycle Resiliency | `before-quit` sequencing, WAL checkpointing, detached watchdog synchronization, and orphan prevention. | Graceful Shutdown State Machine flowchart. |
| **06:30 – 08:00** | Conclusion & Evaluator Defense | Architectural summary of system stability, zero zombie processes, and transition to Q&A. | Summary slide with main process reliability KPIs. |

---

## 3. Verbatim Spoken Presentation Track

### [00:00 – 01:15] Section 1: The Main Process as Operating Kernel

> "Good morning. In this presentation, I will detail the architecture of Focus Engine's **Main Process and IPC Communication Subsystem**.
> 
> In Electron, the Main Process is the central operating system authority. While the renderer is confined to a sandboxed Chromium browser context, the Main Process runs full Node.js with unrestricted access to the filesystem, native C++ bindings, and OS APIs.
> 
> In Focus Engine, `src/main/index.ts` coordinates four foundational responsibilities:
> 1. Initializing and verifying our embedded SQLite WAL database.
> 2. Constructing the primary application window ($900 \times 670$ pixels) with strict security defaults (`contextIsolation: true`, `nodeIntegration: false`).
> 3. Registering our modular IPC routing network.
> 4. Supervising background worker loops and child processes throughout the session lifecycle."

---

### [01:15 – 03:00] Section 2: The 8-Router Modular IPC Architecture

> "A common architectural failure in Electron apps is the 'Monolithic Index Trap'—dumping dozens of `ipcMain.handle` calls into a thousand-line `index.ts` file. This creates tight coupling, makes testing impossible, and causes constant git merge conflicts when multiple engineers work on different features.
> 
> Focus Engine eliminates this through a **Domain-Segmented IPC Architecture**. All 30+ IPC channels are divided across **8 dedicated routers** under `src/main/ipc/`:
> 
> - **`sessionHandlers.ts`**: Coordinates session start, pause, resume, finish, and history retrieval.
> - **`blockingHandlers.ts`**: Manages domain and application blacklists and hosts file toggles.
> - **`telemetryHandlers.ts`**: Handles manual telemetry polling and activity category updates.
> - **`bufferHandlers.ts`**: Exposes live Focus Buffer state, state histories, and diagnostics.
> - **`analyticsHandlers.ts`**: Dispatches 7x24 circadian heatmap queries, streak calculations, and KPIs.
> - **`cvHandlers.ts`**: Controls the Python Computer Vision subprocess lifecycle and calibration.
> - **`presetHandlers.ts`**: Manages user focus duration configurations and break timers.
> - **`mlHandlers.ts`**: Coordinates offline feature extraction and ML model predictions.
> 
> Each router exports a clean registration function—such as `registerSessionHandlers()`—which is invoked cleanly during startup. This allows Engineer 1 to modify database queries and Engineer 3 to update blocking controls in completely separate files without code collisions."

---

### [03:00 – 04:45] Section 3: Background Services & Polling Orchestration

> "During an active focus session, the Main Process orchestrates several background services in harmony:
> 
> 1. **The 1 Hz Telemetry Poller**: Every 1000 milliseconds, it queries the foreground window title via Win32 C# wrappers, reads accumulated keyboard and mouse inputs, and logs activity chunks.
> 2. **The Buffer Orchestrator** (`bufferOrchestrator.ts`): Every second, it consumes telemetry multipliers and subtractive penalties, computes the next continuous buffer value, evaluates the 4-tier state machine, and broadcasts `buffer:tick` and `buffer:state-changed` events across IPC to the React frontend.
> 3. **The Process Watchdog**: Every 2 seconds, it scans the OS process tree to detect and terminate prohibited executables.
> 4. **The Python Child Process Manager**: Spawns and supervises `python/cv_engine/main.py`, monitoring its stdout/stderr streams and managing graceful restarts if the camera disconnects."

---

### [04:45 – 06:30] Section 4: Graceful Teardown & Lifecycle Resiliency

> "In desktop software, handling application shutdown cleanly is just as critical as starting up. An unhandled shutdown could leave blacklisted websites permanently blocked in the hosts file, leave orphaned Python processes running in the background, or leave uncommitted transactions trapped in SQLite WAL journals.
> 
> Focus Engine implements a **Deterministic Teardown Sequence** bound to Electron's `before-quit` and window `close` events:
> 
> ```typescript
> app.on('before-quit', async (event) => {
>   // 1. Stop all 1Hz background timers
>   stopTelemetryPolling()
>   bufferOrchestrator.teardown()
>   
>   // 2. Terminate Python CV subprocess
>   pythonProcessManager.kill()
>   
>   // 3. Restore OS hosts file and dismiss detached watchdog
>   hostsBlocker.restoreHostsSync()
>   
>   // 4. Checkpoint SQLite WAL mode
>   closeDatabase()
> })
> ```
> 
> By executing synchronous teardown steps (`restoreHostsSync` and SQLite `checkpoint`), we guarantee that even if the operating system terminates the process immediately after `before-quit`, all disk state is 100% clean and consistent."

---

### [06:30 – 08:00] Section 5: Conclusion & Defense Readiness

> "In conclusion: Focus Engine's Main Process serves as a disciplined, modular operating kernel. By decoupling IPC handlers into 8 domain routers, orchestrating background services with predictable 1 Hz cadence, and enforcing deterministic teardown routines, we achieved an Electron backend that is stable, secure, and maintainable.
> 
> Thank you. I am ready to answer your questions regarding our main process architecture and IPC design."

---

## 4. Technical Defense: Tough Evaluator Questions & Model Answers

### Question 1: "Why use `ipcMain.handle` / `ipcRenderer.invoke` over traditional `ipcMain.on` / `event.reply` pairs?"
**Model Answer:**
> "`ipcMain.on` and `event.reply` rely on loose, decoupled asynchronous event pairs without a direct promise contract. If an error occurs on the main process side, propagating that exception back to the renderer requires manual channel choreography. In contrast, `ipcMain.handle` and `ipcRenderer.invoke` use native JavaScript Promise semantics: the renderer awaits the invocation directly, and any unhandled exception thrown in the main process rejects the frontend promise automatically. This allows clean `try/catch` error boundaries in React components and eliminates callback spaghetti."

### Question 2: "How does the Main Process handle high-frequency IPC push messages (`buffer:tick` at 1 Hz) without flooding the Chromium renderer?"
**Model Answer:**
> "We enforce two controls: First, we strictly throttle the tick frequency to 1 Hz. While the internal timer loop in the renderer runs at 200ms for smooth UI animations, the backend only pushes buffer updates once per second (`1000ms`). Second, in `webContents.send()`, the payload is an ultra-lightweight JSON object containing only four primitive numbers (`value`, `state`, `delta`, `penalty`). This incurs virtually zero serialization overhead under V8's structured clone algorithm."

### Question 3: "If the user closes the main window while a focus session is actively running, what happens?"
**Model Answer:**
> "In `src/main/index.ts`, the `mainWindow.on('close')` event intercepts window closure. If a session is active, it prompts the user with an explicit Electron confirmation dialog: *'A focus session is currently active. Are you sure you want to stop and quit?'* If the user confirms, it triggers the full session termination workflow—saving actual duration, finalizing the focus score, restoring the hosts file, and safely killing the Python subprocess before destroying the window."
