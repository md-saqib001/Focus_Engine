# Focus Engine

> **A high-performance, multi-modal cognitive focus tracker, OS-level distraction blocker, and offline machine learning productivity suite built with Electron, React 18, TypeScript, Python, OpenCV, MediaPipe, and Scikit-Learn.**

---

## 1. Executive Summary & Problem Statement

Modern knowledge work and software engineering are besieged by continuous digital distractions: social media notifications, context switching between browser tabs, and fragmented focus. Traditional productivity tools suffer from fundamental flaws:
1. **Shallow Enforcement**: Browser extensions can be bypassed by opening an incognito window or switching browsers.
2. **Naive Timer Drift**: Web-based timers relying on sequential JavaScript counter ticks (`setInterval`) suffer severe drift from CPU throttling and fail when laptops sleep.
3. **Passive Assumption of Focus**: Existing tools assume that if a code editor is open on the screen, the user is focused. In reality, users often stare at smartphones or daydream while their editor sits idle.
4. **Cloud Privacy Liabilities**: Many commercial tracking tools upload raw keystrokes, screenshots, and browsing histories to third-party cloud servers.

**Focus Engine** was engineered from the ground up to solve these challenges through an integrated, multi-process desktop architecture that operates **100% locally and privately**:
- **Hardware-Level Precision Timing**: Time is calculated mathematically from OS-level epoch timestamps (`Date.now()`), eliminating timer drift across CPU throttling and system sleep.
- **System-Wide Network & Process Enforcement**: Modifies the operating system `hosts` file to block domains across all browsers and CLI tools, terminates active keep-alive browser sockets, forcefully terminates blacklisted processes, and maintains an independent detached watchdog daemon to prevent lockouts.
- **Non-Invasive Computer Vision Attention Tracking**: Samples the webcam at 2.0 FPS using Google MediaPipe Face Landmarker to evaluate 3D head pose (Perspective-n-Point) and eye gaze, distinguishing between active monitor focus, productive keyboard work, and external distractions without saving a single video frame to disk.
- **Adaptive Cognitive Focus Buffer**: Models the user's attention as a live, dynamic energy reservoir that recovers during sustained focus and decays during distractions.
- **Offline Machine Learning Analytics**: Trains local Scikit-Learn Random Forest and Isolation Forest models on a 40-session sliding window, delivering real-time cognitive state predictions and personalized productivity coaching.

---

## 2. High-Level System Architecture

Focus Engine operates across three coordinated execution layers:

```mermaid
graph TD
    subgraph Layer 1: Chromium Renderer UI React 18
        Dash[Dashboard Page]
        Anal[Analytics Page]
        Hist[History Page]
        Sett[Settings Page]
        Dbg[Debug Page]
        UTE[useTimerEngine.ts: Epoch Math]
        UFS[useFocusSession.ts: Orchestrator]
    end

    subgraph Layer 2: Preload Security Gateway
        CB[contextBridge.exposeInMainWorld]
        API[window.focusEngineAPI]
    end

    subgraph Layer 3: Electron Main Process Node.js
        Index[index.ts / Lifecycle Coordinator]
        DB[(SQLite Engine: better-sqlite3)]
        BO[BufferOrchestrator: Cognitive Buffer]
        TP[TelemetryPoller: 1Hz OS Polling]
        HFM[HostsFileManager: OS DNS Redirect]
        PM[ProcessManager: taskkill / pkill]
        WM[WatchdogManager: Detached Monitor]
        PPM[PythonProcessManager: Subprocess Bridge]
        WR[WeeklyRetraining: Model Maintenance]
    end

    subgraph Layer 4: Python Engines & Hardware
        Webcam[Webcam Video Stream]
        CVProc[python/cv_engine/main_loop.py: 2 FPS MediaPipe]
        MLProc[python/ml/predict.py: Random Forest]
        HostsFile[OS hosts File: C:\Windows\...\hosts or /etc/hosts]
        OSTree[OS Process Tree: tasklist / ps]
    end

    Dash & Anal & Hist & Sett & Dbg --> UFS
    UFS --> UTE
    UFS --> API
    API --> CB
    CB <-->|Typed IPC Channels| Index

    Index <--> DB
    Index --> BO & TP & HFM & PM & PPM & WR

    HFM --> HostsFile
    HFM --> WM
    PM --> OSTree

    PPM <-->|JSON stdio| CVProc
    Webcam --> CVProc

    BO <-->|Features / Inferences| MLProc
```

---

## 3. Technology Stack

| Subsystem | Technology | Version / Specification | Architectural Role |
|---|---|---|---|
| **Desktop Shell** | Electron | `^39.2.6` | Native OS integration, multi-process orchestration, window management |
| **Frontend Framework** | React | `^19.2.1` | Declarative UI, concurrent rendering, real-time dashboard visualization |
| **Frontend Language**| TypeScript | `^5.9.3` (`strict: true`) | Strict type contracts between UI hooks and IPC response envelopes |
| **Build Tooling** | Vite (`electron-vite`) | `^5.0.0` | Instant HMR development server and optimized Rollup bundling |
| **Embedded Database** | SQLite (`better-sqlite3`) | `^12.11.1` | Local timeseries storage, WAL journal mode, 14 relational tables |
| **Styling & Icons** | Vanilla CSS + `lucide-react` | `^1.21.0` | Dark glassmorphism theme (`#0f0f17`), responsive SVG timer dials |
| **Computer Vision** | OpenCV + MediaPipe | Python 3.10–3.12 | 478 3D facial landmarks, solvePnP head pose, horizontal iris gaze |
| **Machine Learning** | Scikit-Learn | `^1.4.0` | Random Forest Regressor, Isolation Forest, 5-fold cross-validation |
| **System Blocking** | OS Hosts + PowerShell / AppleScript | Native OS APIs | Loopback domain redirection (`127.0.0.1`) and active tab termination |

---

## 4. Key Subsystems & Core Capabilities

### 1. Hardware-Anchored Differential Time Calculation
- **Zero Drift**: Eliminates `setInterval` tick lag using epoch millisecond differences:
  $$E_{\text{total}} = A + \left\lfloor \frac{\text{Date.now}() - t_{\text{start}}}{1000} \right\rfloor$$
- **Sleep & Suspend Immune**: Accurately recalculates elapsed time when the laptop lid reopens.
- **Multi-Mode Support**: Supports both target-based **Pomodoro countdowns** (25m, 5m, 15m) and open-ended **Standard stopwatches**.

### 2. Multi-Signal Cognitive Focus Buffer
- Models user attention as a continuous dynamic reservoir ($0.0 \dots 100.0$).
- Integrates four real-time sensory inputs:
  1. **Visual Attention Signal ($S_{\text{cv}}$)**: Webcam head orientation and gaze direction.
  2. **Typing Rhythm Signal ($S_{\text{kb}}$)**: Keystrokes per minute cadence.
  3. **Cursor Kinematics Signal ($S_{\text{mouse}}$)**: Movement velocity and click continuity.
  4. **Active Application Signal ($S_{\text{win}}$)**: Foreground software categorization.
- Dynamically shifts states: `focused` ($\ge 50$), `warning` ($20 - 49$), and `critical` ($< 20$).

### 3. Dual-Layer OS Distraction Blocker
- **System-Wide DNS Loopback**: Injects `# FOCUS_ENGINE_BLOCK_START` markers into `C:\Windows\System32\drivers\etc\hosts` (or `/etc/hosts`), routing distracting domains to `127.0.0.1`.
- **Keep-Alive Socket Termination**: Closes active browser windows (Windows PowerShell `CloseMainWindow`) and tabs (macOS AppleScript `close t`) matching blocked keywords.
- **Process Force-Kill**: Periodically enumerates the OS process tree (`tasklist` / `ps`), force-terminating blacklisted applications (Steam, Discord, Spotify) and logging kill audits.
- **Detached Watchdog Daemon**: A detached headless Node.js child process monitors parent process liveness every second, guaranteeing automatic `hosts` restoration even if Focus Engine crashes or is terminated in Task Manager.

### 4. Privacy-First Computer Vision Attention Engine
- Runs locally at **2.0 FPS** to preserve battery life and keep CPU consumption under $3\%$.
- Solves Perspective-n-Point (`cv2.solvePnP`) using 6 3D facial reference points to derive Euler angles (Yaw, Pitch, Roll).
- Classifies downward pitch ($-35^\circ \le \theta < -15^\circ$) as **`looking_at_keyboard` (100% focus)**, ensuring programmers and note-takers are not falsely penalized.
- Computes horizontal iris gaze ratios while intentionally ignoring vertical gaze to eliminate eyelid occlusion noise.
- **Absolute Privacy**: Zero video frames or images are ever written to disk or transmitted over the network. Only anonymized numerical telemetry is emitted over stdout.

### 5. Local Machine Learning Suite
- **Regression**: Predicts post-session focus scores ($0 \dots 100$) using a 100-tree Random Forest Regressor.
- **Anomaly Detection**: Flags erratic task-switching or artificial simulation using an Isolation Forest.
- **Gini Importance Insight**: Confirms that task-switching frequency (`app_switches`, $38.5\%$) and average buffer level (`avg_buffer`, $13.6\%$) are the top drivers of productivity.
- **Cold-Start Bootstrap**: Uses a 40-session sliding window initialized with synthetic data that naturally phases out as real user sessions are recorded.
- **Automated Weekly Retraining**: A background daemon audits model performance every 7 days, replacing production models only when 5-fold cross-validation R² improves.

---

## 5. Directory Structure

```text
Focus_Engine/
│
├── README.md                          # Master project documentation & guide
├── package.json                       # Scripts, dependencies, and native build configs
├── electron.vite.config.ts            # Vite multi-process build configuration
├── electron-builder.yml               # Native installer packaging configuration
├── tsconfig.json                      # TypeScript root configuration
├── tsconfig.node.json                 # TypeScript node configuration (main & preload)
├── tsconfig.web.json                  # TypeScript web configuration (renderer)
│
├── docs/                              # Comprehensive Technical Documentation Suite
│   ├── 00-overview/                   # System architecture, lifecycle, and data flow
│   ├── 01-database/                   # SQLite schema, 14 tables, queries, ER diagrams
│   ├── 02-frontend/                   # React components, state, time calculation engine
│   ├── 03-blocking/                   # Hosts blocker, process manager, watchdog daemon
│   ├── 04-main-process/               # Electron lifecycle, IPC architecture, background loops
│   ├── 05-preload/                    # ContextBridge security, exposed APIs, unsubscribe pattern
│   ├── 06-telemetry/                  # OS window tracking, KPM sliding window, idle detection
│   ├── 07-computer-vision/            # MediaPipe FaceLandmarker, solvePnP head pose, gaze
│   ├── 08-machine-learning/           # Random Forest regression, Isolation Forest, retraining
│   ├── 09-integration/                # Cross-module data flow, failure matrices, dependencies
│   └── 10-development/                # Setup guides, debugging, testing, contribution rules
│
├── src/
│   ├── main/                          # Electron Main Process (Node.js)
│   │   ├── index.ts                   # Main application entry point & lifecycle
│   │   ├── analytics/                 # Heatmap queries, streak calculator, recommendations
│   │   ├── blocking/                  # Hosts file manager, process manager, tab closer, watchdog
│   │   ├── buffer/                    # Focus Buffer orchestrator, signal mappers, state machine
│   │   ├── cv/                        # Python CV engine subprocess bridge
│   │   ├── database/                  # SQLite schema DDL, connection handle, 12 repositories
│   │   ├── ipc/                       # 8 domain IPC handler modules
│   │   ├── ml/                        # Prediction service, weekly retraining daemon
│   │   ├── telemetry/                 # Active window tracker, KPM tracker, mouse metrics
│   │   └── utils/                     # Structured logger, path resolvers
│   │
│   ├── preload/                       # Preload Process
│   │   ├── index.ts                   # ContextBridge implementation & unsubscription wrappers
│   │   └── index.d.ts                 # Ambient TypeScript definitions for window.focusEngineAPI
│   │
│   └── renderer/                      # Chromium Renderer Process (React 18)
│       ├── main.tsx                   # React root mount
│       ├── App.tsx                    # Top-level router & state provider
│       ├── context/                   # FocusSessionContext singleton
│       ├── hooks/                     # Custom hooks (useTimerEngine, useFocusSession, etc.)
│       ├── layouts/                   # MainLayout with sidebar navigation
│       ├── pages/                     # Dashboard, Analytics, History, Settings, Debug
│       └── components/                # UI primitives (Card, Button) & domain widgets (Gauges, HUD)
│
└── python/
    ├── cv_env/                        # Python virtual environment (ignored from VCS)
    ├── cv_engine/                     # Computer Vision Engine
    │   ├── main_loop.py               # Headless production loop (2.0 FPS, stdout JSON)
    │   ├── face_detector.py           # MediaPipe FaceLandmarker task wrapper
    │   ├── face_landmarker.task       # 3.7MB neural network bundle
    │   ├── head_pose_estimator.py     # cv2.solvePnP 3D Euler angle estimator
    │   ├── gaze_estimator.py          # Horizontal iris distance ratio estimator
    │   ├── attention_combiner.py      # Multi-modal CV attention scorer
    │   ├── score_smoother.py          # Exponential Moving Average (EMA) smoother
    │   ├── webcam_capture.py          # Threaded OpenCV video capture sampler
    │   └── requirements.txt           # Python dependencies (mediapipe, opencv-python, numpy)
    │
    └── ml/                            # Machine Learning Pipeline
        ├── constants.py               # 13 aligned feature definitions
        ├── dataset_builder.py         # 40-session sliding window dataset builder
        ├── synthetic_generator.py     # Cold-start synthetic session generator
        ├── real_data_extractor.py     # SQLite historical session extractor
        ├── train_focus_model.py       # Random Forest Regressor with 5-fold CV & deployment gate
        ├── train_anomaly_model.py     # Isolation Forest anomaly detector
        ├── predict.py                 # Single-call stdin/stdout inference CLI
        ├── data/                      # dataset.csv, real_sessions.csv, synthetic_pool.csv
        └── models/                    # focus_model.pkl, anomaly_model.pkl, metadata JSONs
```

---

## 6. Installation & Development Setup

### 1. Prerequisites
- **Node.js**: `>= 20.x LTS`
- **npm**: `>= 10.x`
- **Python**: `3.10` or `3.11` (64-bit)
- **Git**: `>= 2.40`
- **Operating System Privileges**: **Administrator** (Windows) or `sudo` (Unix) required for hosts file blocking.

### 2. Node.js Installation
```bash
# Clone the repository
git clone https://github.com/your-org/Focus_Engine.git
cd Focus_Engine

# Install dependencies & compile native SQLite bindings
npm install
```

### 3. Python Virtual Environment Setup (CV & ML)
#### On Windows (PowerShell as Administrator):
```powershell
# Create virtual environment
python -m venv python\cv_env

# Activate virtual environment
.\python\cv_env\Scripts\Activate.ps1

# Upgrade pip and install dependencies
pip install --upgrade pip
pip install -r python\cv_engine\requirements.txt
pip install pandas numpy scikit-learn joblib
```

#### On macOS / Linux:
```bash
# Create and activate virtual environment
python3 -m venv python/cv_env
source python/cv_env/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r python/cv_engine/requirements.txt
pip install pandas numpy scikit-learn joblib
```

---

## 7. Running & Testing

### Development Mode
> [!IMPORTANT]
> Run your terminal as **Administrator** (Windows) so Focus Engine can modify the OS hosts file during sessions:

```bash
npm run dev
```

### Quality Assurance & Verification Commands
```bash
# Strict TypeScript validation (Main + Web)
npm run typecheck

# Code formatting and ESLint checks
npm run lint
npm run format

# Standalone Python CV test with interactive visual overlay
cd python/cv_engine
python main_loop.py --preview

# Standalone Machine Learning pipeline test
cd python/ml
python dataset_builder.py
python train_focus_model.py
```

### Building for Production
```bash
# Compile production bundles
npm run build

# Package unpacked executable directory
npm run build:unpack
```

---

## 8. Complete Documentation Index

The `docs/` directory contains comprehensive technical specifications written for architects, developers, and QA engineers:

| Category | Document Link | Focus & Coverage |
|---|---|---|
| **00 - Overview** | [Project Overview](file:///docs/00-overview/project-overview.md) | Mission, problem statement, high-level capabilities |
| | [System Architecture](file:///docs/00-overview/system-architecture.md) | Multi-process topology, security zones, and communication |
| | [Technology Stack](file:///docs/00-overview/technology-stack.md) | Tooling, libraries, framework evaluations, and justifications |
| | [Application Lifecycle](file:///docs/00-overview/application-lifecycle.md) | Startup, active runtime, pause/resume, and teardown |
| | [System Data Flow](file:///docs/00-overview/system-data-flow.md) | End-to-end data pipelines from HCI sensors to SQLite |
| **01 - Database** | [Database Overview](file:///docs/01-database/database-overview.md) | SQLite architecture, WAL mode, connection management |
| | [Database Schema](file:///docs/01-database/database-schema.md) | Column-level schema for all 14 tables with ER diagrams |
| | [Data Models](file:///docs/01-database/data-models.md) | TypeScript interface mappings to SQLite relational rows |
| | [Database Operations](file:///docs/01-database/database-operations.md) | SQL query catalog, parameters, return types, and indexing |
| | [Data Lifecycle](file:///docs/01-database/data-lifecycle.md) | Journey of session and telemetry data from RAM to disk |
| | [Database Decisions](file:///docs/01-database/database-decisions.md) | Rationale, trade-offs, constraints, and WAL performance |
| **02 - Frontend** | [Frontend Overview](file:///docs/02-frontend/frontend-overview.md) | React 18 architecture, page routes, and layout shells |
| | [Component Architecture](file:///docs/02-frontend/component-architecture.md) | UI primitives, domain widgets, props contracts, error boundary |
| | [State Management](file:///docs/02-frontend/state-management.md) | FocusSessionContext, custom hooks, ref anchors, render isolation |
| | [Time Calculation Engine](file:///docs/02-frontend/time-calculation.md) | Mathematical formulas, epoch math, drift elimination, numerical traces |
| | [Timer Lifecycle](file:///docs/02-frontend/timer-lifecycle.md) | State machine transitions, pause/resume loops, break automations |
| | [Frontend-Backend Communication](file:///docs/02-frontend/frontend-backend-communication.md) | IPC channels, payload normalization, error envelopes |
| | [Frontend Decisions](file:///docs/02-frontend/frontend-decisions.md) | Engineering trade-offs, 200ms tick interval, atomic save guards |
| **03 - Blocking** | [Blocking Overview](file:///docs/03-blocking/blocking-overview.md) | System-wide domain redirection and process enforcement |
| | [Blocking Architecture](file:///docs/03-blocking/blocking-architecture.md) | Activation sequences, continuous 30s audit loops, shutdown paths |
| | [Application Detection](file:///docs/03-blocking/application-detection.md) | `tasklist`/`ps` parsing, command injection regex defense, `taskkill` |
| | [Website Blocking](file:///docs/03-blocking/website-blocking.md) | OS hosts redirection, socket keep-alive problem, PowerShell/AppleScript |
| | [Enforcement Mechanism](file:///docs/03-blocking/enforcement-mechanism.md) | Detached crash-resilient watchdog daemon, parent PID monitoring |
| | [Blocking Decisions](file:///docs/03-blocking/blocking-decisions.md) | Hosts vs. local proxy vs. browser extension trade-offs |
| **04 - Main Process** | [Main Process Overview](file:///docs/04-main-process/main-process-overview.md) | Node.js kernel role, 8 IPC routers, directory layout |
| | [Application Lifecycle](file:///docs/04-main-process/application-lifecycle.md) | Window construction, context isolation security, `before-quit` |
| | [IPC Architecture](file:///docs/04-main-process/ipc-architecture.md) | `ipcMain.handle`, `webContents.send`, standard response envelopes |
| | [Background Services](file:///docs/04-main-process/background-services.md) | 1Hz poller, Focus Buffer orchestrator, Python process manager |
| | [Main Process Decisions](file:///docs/04-main-process/main-process-decisions.md) | Centralized Node process vs. native services, stdio IPC rationale |
| **05 - Preload** | [Preload Overview](file:///docs/05-preload/preload-overview.md) | Security mediator role, ambient TypeScript declarations |
| | [ContextBridge](file:///docs/05-preload/context-bridge.md) | Prototype poisoning defense, V8 structured clone algorithm |
| | [IPC Communication](file:///docs/05-preload/ipc-communication.md) | Channel mapping, React hook unsubscription pattern |
| | [Security Boundaries](file:///docs/05-preload/security-boundaries.md) | Threat modeling, RCE elimination, input sanitization rules |
| **06 - Telemetry** | [Telemetry Overview](file:///docs/06-telemetry/telemetry-overview.md) | HCI sensor architecture, privacy guarantees, no-keylogger policy |
| | [Event Collection](file:///docs/06-telemetry/event-collection.md) | Win32 C# dynamic compilation, AppleScript, mouse kinematics |
| | [Activity Tracking](file:///docs/06-telemetry/activity-tracking.md) | URL/app categorization heuristics, idle tiers, distraction alerts |
| | [Data Processing](file:///docs/06-telemetry/data-processing.md) | Sliding window KPM scaling, post-session aggregation, Focus Score formula |
| | [Telemetry Decisions](file:///docs/06-telemetry/telemetry-decisions.md) | 1Hz polling vs. native hooks, 60s chunking trade-offs |
| **07 - Computer Vision** | [Computer Vision Overview](file:///docs/07-computer-vision/computer-vision-overview.md) | Visual attention tracking, privacy guarantee, JSON protocol |
| | [Image Processing Pipeline](file:///docs/07-computer-vision/image-processing-pipeline.md) | Frame capture, color conversion, 478 landmark regression |
| | [Detection Mechanism](file:///docs/07-computer-vision/detection-mechanism.md) | 3D solvePnP Euler angles, keyboard pitch detection, iris gaze ratio |
| | [Frame Processing](file:///docs/07-computer-vision/frame-processing.md) | 2.0 FPS regulation, monotonic timing, preview streaming, teardown |
| | [CV Model Integration](file:///docs/07-computer-vision/cv-model-integration.md) | MediaPipe task bundle, Python subprocess bridge, DB ingestion |
| | [Computer Vision Decisions](file:///docs/07-computer-vision/computer-vision-decisions.md) | MediaPipe vs. Dlib, classical PnP vs. deep pose, horizontal gaze |
| **08 - Machine Learning** | [Machine Learning Overview](file:///docs/08-machine-learning/machine-learning-overview.md) | Regression and anomaly detection objectives, dataset layout |
| | [Model Architecture](file:///docs/08-machine-learning/model-architecture.md) | Random Forest Regressor math, Isolation Forest path lengths |
| | [Feature Engineering](file:///docs/08-machine-learning/feature-engineering.md) | 13 aligned feature definitions, Gini importances, median imputation |
| | [Training & Inference](file:///docs/08-machine-learning/training-and-inference.md) | 40-session sliding window, 5-fold CV, deployment gate, CLI predictor |
| | [Prediction Pipeline](file:///docs/08-machine-learning/prediction-pipeline.md) | 5s polling loop, subprocess safety timeouts, weekly retraining daemon |
| | [Machine Learning Decisions](file:///docs/08-machine-learning/machine-learning-decisions.md) | Random Forest vs. Deep Learning, sliding window vs. infinite data |
| **09 - Integration** | [Module Interactions](file:///docs/09-integration/module-interactions.md) | Process boundaries, interface definitions, subsystem topology |
| | [End-to-End Data Flow](file:///docs/09-integration/end-to-end-data-flow.md) | Tracing sessions from launch to analytics across 4 phases |
| | [Error Handling](file:///docs/09-integration/error-handling.md) | Fault tolerance matrix, error boundaries, watchdog recovery |
| | [Cross-Module Dependencies](file:///docs/09-integration/cross-module-dependencies.md) | Table access patterns, shared types, team collaboration model |
| **10 - Development** | [Setup Guide](file:///docs/10-development/setup-guide.md) | Prerequisites, Node/Python installation, native module rebuilds |
| | [Development Workflow](file:///docs/10-development/development-workflow.md) | HMR feedback loops, standalone subsystem testing, git conventions |
| | [Debugging Guide](file:///docs/10-development/debugging-guide.md) | In-app debug console, database inspection, troubleshooting pitfalls |
| | [Testing Guide](file:///docs/10-development/testing-guide.md) | Static type checking, unit harnesses, interactive E2E checklist |
| | [Contribution Guidelines](file:///docs/10-development/contribution-guidelines.md) | Code preservation rules, PR standards, four workstream assignments |

---

## 9. Engineering Team Ownership & Collaboration Matrix

Focus Engine's architecture is structured to support four engineers collaborating in parallel across clearly segregated workstreams:

| Workstream | Lead Engineer | Primary Module Ownership | Core Technical Responsibilities |
|---|---|---|---|
| **Workstream 1** | **Engineer 1** *(Placeholder)* | Database & Storage (`docs/01-database/`, `src/main/database/`, `src/main/analytics/`) | SQLite schema migrations, WAL tuning, index optimization, SQL analytics aggregations (heatmaps, streaks, productivity summaries). |
| **Workstream 2** | **Engineer 2** *(Placeholder)* | Frontend & Time Calculation (`docs/02-frontend/`, `src/renderer/`) | React 18 UI layout, differential epoch time engine (`useTimerEngine`), session orchestrator (`useFocusSession`), dynamic SVG dials. |
| **Workstream 3** | **Engineer 3** *(Placeholder)* | Blocking, Main Process & Security (`docs/03-blocking/`, `docs/04-main-process/`, `docs/05-preload/`) | Electron lifecycle coordinator, ContextBridge security, OS hosts loopback blocker, detached watchdog crash daemon, process force-kill. |
| **Workstream 4** | **Engineer 4** *(Placeholder)* | Telemetry, Computer Vision & ML (`docs/06-telemetry/`, `docs/07-computer-vision/`, `docs/08-machine-learning/`, `python/`) | Win32 active window polling, KPM tracking, MediaPipe 3D head pose & gaze estimation, Random Forest regression, weekly retraining. |

---

## 10. Known Limitations & Future Roadmap

1. **DNS-over-HTTPS (DoH)**:
   - *Limitation*: Browsers with hardcoded DoH enabled by default may bypass OS hosts file redirection.
   - *Roadmap*: Pair the hosts file blocker with an optional Focus Engine native messaging companion browser extension.
2. **Subdomain URL Filtering**:
   - *Limitation*: Hosts files operate on domain granularity (`youtube.com`), unable to selectively permit specific URLs (`youtube.com/watch?v=educational`).
   - *Roadmap*: Develop a local transparent loopback proxy for granular HTTP path filtering.
3. **ONNX Native Inference**:
   - *Limitation*: Spawning `predict.py` every 5 seconds incurs small OS process creation overhead ($\approx 80\text{ ms}$).
   - *Roadmap*: Export Scikit-Learn models to ONNX format and execute directly inside Node.js via `onnxruntime-node`.
4. **System Tray Minimization**:
   - *Limitation*: Closing the main window currently terminates the application on Windows.
   - *Roadmap*: Implement an Electron `Tray` icon allowing the app to stay active in the background while users work in full-screen IDEs.

---

## 11. License

Focus Engine is an open-source engineering project licensed under the [MIT License](LICENSE).
