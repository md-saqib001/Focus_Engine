# Technology Stack

## Runtime Environments

| Layer | Runtime | Version |
|-------|---------|---------|
| Desktop shell | Electron | ^39.2.6 |
| Main process JS | Node.js | Bundled with Electron 39 |
| Renderer | Chromium | Bundled with Electron 39 |
| Python (CV + ML) | CPython | 3.12 (required; 3.13+ not supported by MediaPipe) |

---

## JavaScript / TypeScript Layer

### Core Framework

| Package | Version | Role |
|---------|---------|------|
| `electron` | ^39.2.6 | Desktop application shell; provides main process, BrowserWindow, IPC, OS integration |
| `react` | ^19.2.1 | UI component library for the renderer process |
| `react-dom` | ^19.2.1 | React DOM renderer |
| `typescript` | ^5.9.3 | Typed superset of JavaScript; all source is `.ts` / `.tsx` |

### Electron Utilities

| Package | Version | Role |
|---------|---------|------|
| `@electron-toolkit/preload` | ^3.0.2 | Provides `electronAPI` helper exposed via contextBridge |
| `@electron-toolkit/utils` | ^4.0.0 | Provides `is.dev`, `electronApp.setAppUserModelId()`, `optimizer.watchWindowShortcuts()` |

### Database

| Package | Version | Role |
|---------|---------|------|
| `better-sqlite3` | ^12.11.1 | Synchronous SQLite3 bindings for Node.js. Used for all database operations in the main process |
| `@types/better-sqlite3` | ^7.6.13 | TypeScript type definitions |

**Why better-sqlite3 over alternatives?**
- Synchronous API avoids Promise chains for database operations in the main process.
- Dramatically simpler code for the transactional batch inserts used in telemetry.
- High performance for the write patterns in Focus Engine (small, frequent inserts).
- No network overhead; purely local file-based SQLite.

### Routing

| Package | Version | Role |
|---------|---------|------|
| `react-router-dom` | ^7.18.0 | Client-side routing between Dashboard, History, Analytics, Settings, and Debug pages |

### UI Icons

| Package | Version | Role |
|---------|---------|------|
| `lucide-react` | ^1.21.0 | SVG icon library used throughout the React UI |

### Input Tracking

| Package | Version | Role |
|---------|---------|------|
| `node-global-key-listener` | ^0.3.0 | Global keyboard hook for the main process, used to track keystrokes-per-minute without requiring focus on the application window |

### Build Tooling

| Package | Version | Role |
|---------|---------|------|
| `electron-vite` | ^5.0.0 | Build tool combining Vite (for the renderer) with special handling for the Electron main and preload processes |
| `vite` | ^7.2.6 | Fast ES module bundler, used for the React renderer |
| `@vitejs/plugin-react` | ^5.1.1 | React Fast Refresh support for Vite |
| `electron-builder` | ^26.0.12 | Packages and distributes the final Electron app as installers |

### Code Quality

| Package | Version | Role |
|---------|---------|------|
| `eslint` | ^9.39.1 | JavaScript/TypeScript linter |
| `prettier` | ^3.7.4 | Code formatter |
| `eslint-plugin-react` | ^7.37.5 | React-specific lint rules |
| `eslint-plugin-react-hooks` | ^7.0.1 | Enforces Rules of Hooks |
| `eslint-plugin-react-refresh` | ^0.4.24 | Prevents hot-reload issues |

---

## Python Layer

### Computer Vision

| Package | Role |
|---------|------|
| `mediapipe` | Google's ML framework; provides `FaceLandmarker` (Tasks API) that detects 478 3D face landmarks per frame |
| `opencv-python` (cv2) | Frame capture via `VideoCapture`, BGR→RGB conversion, `solvePnP` for head pose, `decomposeProjectionMatrix` for Euler angles |
| `numpy` | Numerical arrays for 3D model points, camera matrices, and image point extraction |

**Requirements file**: `python/cv_engine/requirements.txt`

### Machine Learning

| Package | Role |
|---------|------|
| `scikit-learn` | `RandomForestRegressor` (focus score prediction), `IsolationForest` (anomaly detection), `cross_val_score`, `train_test_split` |
| `pandas` | CSV dataset loading, cleaning, and manipulation |
| `numpy` | Feature vector construction and numerical operations |
| `joblib` | Serializing/deserializing trained model `.pkl` files |
| `seaborn` | Visualization in EDA scripts (not used in production paths) |
| `matplotlib` | Visualization in EDA scripts (not used in production paths) |

---

## Key Architecture Decisions

### Why Electron?

Electron was chosen because:
1. It allows cross-platform desktop deployment with a single codebase.
2. It provides native OS integration needed for hosts file access, global keyboard hooks, and process management.
3. React + TypeScript can be used for the UI, providing a familiar web-development experience.

### Why Python for CV and ML?

1. **MediaPipe** is only available as a Python and C++ library. No JS bindings exist for the Tasks API version used.
2. **scikit-learn** is the industry standard for the kind of tabular ML used here (Random Forest, Isolation Forest).
3. Python subprocess isolation provides a clean privacy boundary: even if the Python code had a bug, no image data could be exfiltrated over the IPC channel (which only accepts the numeric JSON output).

### Why better-sqlite3 (synchronous)?

The main process runs database operations inside IPC handlers. Since `ipcMain.handle()` supports async handlers natively, async SQLite would work. However, `better-sqlite3`'s synchronous API:
- Eliminates the possibility of concurrent write races in a single-writer architecture.
- Simplifies the transactional batch write code for telemetry.
- Has negligible performance difference for Focus Engine's write volume.

### Why spawn-per-call for ML inference?

Loading the scikit-learn model pickle (`~1-5 MB`) takes ~50–200ms. For a prediction that runs every 60 seconds, this overhead is completely acceptable. The benefit is:
- **No persistent Python process consuming memory** between predictions.
- **Automatic model reloading**: if `focus_model.pkl` is replaced by retraining while the app is running, the next `predict.py` spawn will load the new model automatically without any coordination logic.
- **Crash isolation**: if `predict.py` crashes or hangs, the 5-second timeout kills it and the main process continues normally.

### Why MediaPipe FaceLandmarker (Tasks API) over older Face Mesh?

The Tasks API is MediaPipe's current stable API. The older `mediapipe.solutions.face_mesh` API is deprecated. The Tasks API provides:
- More explicit control over running modes (`IMAGE`, `VIDEO`, `LIVE_STREAM`).
- Better model management (explicit `.task` file, automatic download).
- The same 478-landmark output compatible with the head pose and gaze estimators.

---

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Windows 10/11 | Primary development target | Full feature support; requires admin for hosts blocking |
| macOS | Partial | Requires `sudo` for hosts blocking; tested in development |
| Linux | Partial | `ps -A -o comm` used for process listing; requires `sudo` for hosts |

> **Python 3.13+ is not supported** as of the current implementation because MediaPipe does not publish pre-built wheels for Python 3.13+. Python 3.12 is required.
