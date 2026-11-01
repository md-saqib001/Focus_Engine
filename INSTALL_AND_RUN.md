# Focus Engine — Installation & Execution Guide

This document provides complete, step-by-step instructions for installing dependencies, configuring environments, and running **Focus Engine** on your machine.

---

## 1. Quick Start (TL;DR)

For developers with all prerequisites already installed:

```powershell
# 1. Open PowerShell AS ADMINISTRATOR (Required for hosts file website blocking)
cd "path\to\Focus_Engine"

# 2. Install Node dependencies (auto-builds better-sqlite3 for Electron)
npm install

# 3. Setup Python 3.12 virtual environment & dependencies
python -m venv python\cv_env
.\python\cv_env\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r python\cv_engine\requirements.txt
pip install pandas numpy scikit-learn joblib

# 4. Launch development server
npm run dev
```

---

## 2. System Requirements & Prerequisites

### Required Software

| Tool / Runtime | Recommended Version | Purpose |
|---|---|---|
| **Node.js** | `>= 20.x LTS` (Node 22 supported) | Core runtime for Electron and Vite development server |
| **npm** | `>= 10.x` | Package manager |
| **Python** | `3.10`, `3.11`, or `3.12` (64-bit) | Runtime for OpenCV, MediaPipe Face Landmarker, and Scikit-Learn |
| **C++ Build Tools** | Visual Studio Build Tools / Windows SDK | Required for compiling native Node addons (`better-sqlite3`) |
| **Git** | `>= 2.40` | Version control |

> [!WARNING]
> **Python Version Constraint**: MediaPipe does **not** support Python 3.13+ yet. Ensure your Python virtual environment uses **Python 3.10, 3.11, or 3.12**.

### Operating System Privileges
> [!IMPORTANT]
> **Administrator Privileges Required on Windows**:
> Focus Engine contains a kernel-level DNS/hosts file blocker (`src/main/blocking/hostsBlocker.ts`) that writes loopback records (`127.0.0.1 domain.com`) to `C:\Windows\System32\drivers\etc\hosts` to enforce distraction-free focus sessions.
>
> You **MUST** launch your terminal (PowerShell, Command Prompt, or VS Code / IDE) with **"Run as Administrator"**. If run without elevation, hosts modification will be blocked by Windows User Account Control (UAC).

### Hardware Requirements
- **Webcam**: Required for the Computer Vision attention pipeline (eye gaze tracking, face presence, look-away detection). If no camera is detected, the engine gracefully falls back to peripheral-only telemetry (keyboard & mouse tracking) and automatically reweights focus scores.

---

## 3. Step-by-Step Installation

### Step 1: Navigate to Project Directory
Open your terminal as Administrator and navigate to the root of `Focus_Engine`:
```powershell
cd "d:\Practical Training\Focus_Engine"
```

---

### Step 2: Install Node Dependencies
Install all package dependencies. This will automatically invoke `electron-builder install-app-deps` to compile native C++ binaries for `better-sqlite3` and `node-global-key-listener` targeting Electron's internal V8 ABI:

```powershell
npm install
```

> [!NOTE]
> If you encounter a C++ compilation error during `better-sqlite3` build on Windows, install the Visual Studio C++ workload via:
> ```powershell
> npm install --global --production windows-build-tools
> ```
> Or install **Visual Studio Community** with the *"Desktop development with C++"* workload checked.

---

### Step 3: Configure Python Virtual Environment

Focus Engine spawns a dedicated Python child process (`python/cv_engine/main.py`) that runs MediaPipe Face Landmarker and communicates with Electron over local WebSockets (`ws://127.0.0.1:8765`).

#### 1. Create the virtual environment inside `python/cv_env`:
```powershell
# Using Python launcher with 3.12:
py -3.12 -m venv python\cv_env

# Or using standard python on PATH:
python -m venv python\cv_env
```

#### 2. Activate the virtual environment:
```powershell
.\python\cv_env\Scripts\Activate.ps1
```

> [!TIP]
> If PowerShell blocks script execution with `Execution_Policies` error, run:
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```

#### 3. Upgrade pip:
```powershell
python -m pip install --upgrade pip
```

#### 4. Install Computer Vision dependencies:
```powershell
pip install -r python\cv_engine\requirements.txt
```
*Installed packages: `mediapipe==0.10.14`, `numpy==2.5.1`, `opencv-python==4.10.0.84`, `websockets==12.0`*

#### 5. Install Machine Learning dependencies:
```powershell
pip install pandas numpy scikit-learn joblib
```

---

### Step 4: Verify Asset and Model Integrity

Ensure pre-trained models and assets are present:

1. **MediaPipe Face Landmarker Task**:
   - Location: `python/cv_engine/face_landmarker.task`
   - Size: `~3.7 MB`
2. **Trained ML Models**:
   - Location: `python/ml/models/focus_model.pkl`
   - Location: `python/ml/models/anomaly_model.pkl`
   - Location: `python/ml/models/focus_model_metadata.json`

Verify via PowerShell:
```powershell
Get-Item python\cv_engine\face_landmarker.task, python\ml\models\focus_model.pkl
```

---

## 4. Running the Application

### Development Mode (Recommended)

To launch Focus Engine with Vite Hot Module Replacement (HMR) and Electron live reloading:

```powershell
npm run dev
```

### What Happens on Launch:
1. `electron-vite dev` starts Vite development server on an ephemeral localhost port.
2. The Electron main process boots and initializes the SQLite database at `AppData/Roaming/Focus_Engine/focus_engine.db` (or development local DB).
3. The application window opens at dimensions `900 x 670` (dark mode theme).
4. When a Focus Session begins:
   - Electron spawns `python\cv_env\Scripts\python.exe python\cv_engine\main.py`.
   - The Python CV engine opens the webcam and starts the WebSocket server at `ws://127.0.0.1:8765`.
   - Electron connects to the WebSocket stream and maps 30-fps facial telemetry into focus multipliers.
   - The active window tracker polls the foreground window every 1000 ms.
   - The process watchdog monitors blacklisted applications every 2000 ms.

---

## 5. Other Useful Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts Vite dev server + Electron with hot reload |
| `npm run typecheck` | Runs TypeScript typechecks for both Node (main/preload) and Web (renderer) |
| `npm run typecheck:node` | Typechecks main process and preload scripts |
| `npm run typecheck:web` | Typechecks React frontend components |
| `npm run lint` | Runs ESLint across the codebase |
| `npm run format` | Runs Prettier to format source files |
| `npm run build` | Compiles production assets (`electron-vite build`) |
| `npm run build:unpack` | Compiles and unpacks Electron binary to `dist/win-unpacked` |
| `npm run dist` | Generates full Windows installer (`.exe`) via `electron-builder` |

---

## 6. Troubleshooting & FAQ

### Issue 1: `better-sqlite3` NODE_MODULE_VERSION Mismatch
**Symptom**: App crashes on launch with:
`Error: The module '...better_sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION XX.`

**Resolution**: Recompile native addons against the installed Electron version:
```powershell
npx electron-builder install-app-deps
```

---

### Issue 2: EPERM: operation not permitted on `hosts`
**Symptom**: Console logs `[hostsBlocker] Error: EPERM: operation not permitted, open 'C:\Windows\System32\drivers\etc\hosts'`.

**Resolution**: You are running the terminal without administrative elevation. Close your terminal, right-click PowerShell or your IDE icon, select **"Run as Administrator"**, and re-run `npm run dev`.

---

### Issue 3: Python WebSocket connection refused (`ECONNREFUSED 127.0.0.1:8765`)
**Symptom**: CV attention stays at 0% or console logs connection failure to WebSocket.

**Resolution**:
1. Check that the virtual environment exists at `python/cv_env`.
2. Test running the CV script manually in a separate terminal:
   ```powershell
   .\python\cv_env\Scripts\python.exe python\cv_engine\main.py
   ```
3. If an error is printed (e.g., missing package or webcam open error), verify webcam permissions in Windows:
   *Windows Settings $\rightarrow$ Privacy & Security $\rightarrow$ Camera $\rightarrow$ Let desktop apps access your camera $\rightarrow$ ON*.

---

### Issue 4: MediaPipe `ModuleNotFoundError` or Crash on Python 3.13
**Symptom**: `pip install mediapipe` fails or crashes on Python 3.13+.

**Resolution**: MediaPipe wheels are compiled for Python 3.8 – 3.12. Install Python 3.12 from [python.org](https://www.python.org/downloads/release/python-3120/) and recreate the venv using `py -3.12 -m venv python\cv_env`.

---

### Issue 5: Port Conflict on 8765
**Symptom**: Python reports `OSError: [WinError 10048] Only one usage of each socket address is normally permitted`.

**Resolution**: An orphaned Python process is holding port 8765. Terminate it via PowerShell:
```powershell
Stop-Process -Name python -Force
```

---

## 7. Verification Checklist

After setup, verify your environment is functioning properly:

- [ ] `npm run typecheck` passes with 0 errors.
- [ ] Terminal opened as Administrator.
- [ ] `python/cv_env` virtual environment created and activated.
- [ ] `python/cv_engine/face_landmarker.task` is present (~3.7 MB).
- [ ] `npm run dev` opens the $900 \times 670$ desktop window.
- [ ] Starting a session displays the dynamic focus buffer energy reservoir.
