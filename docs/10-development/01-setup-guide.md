# Development Environment Setup Guide

## 1. Prerequisites

Before setting up Focus Engine, ensure your system meets the following requirements:

| Tool / Dependency | Recommended Version | Purpose |
|---|---|---|
| **Node.js** | `>= 20.x LTS` (Node 22 supported) | JavaScript runtime for Electron and Vite |
| **npm** | `>= 10.x` | Node package manager |
| **Python** | `3.10` or `3.11` (64-bit) | Runtime for OpenCV, MediaPipe, and Scikit-Learn |
| **Git** | `>= 2.40` | Version control |
| **OS Privileges** | **Administrator** (Windows) / `sudo` (Unix) | Required for OS `hosts` file modification |

---

## 2. Step-by-Step Installation

### Step 1: Clone Repository
```bash
git clone https://github.com/your-org/Focus_Engine.git
cd Focus_Engine
```

---

### Step 2: Install Node Dependencies & Native Modules
Focus Engine relies on `better-sqlite3`, which requires compiling against Electron's internal V8 ABI:

```bash
npm install
```

> [!NOTE]
> The `postinstall` script automatically executes:
> `electron-builder install-app-deps`
> to compile native C++ binaries for `better-sqlite3` targeting the bundled Electron version (`electron ^39.2.6`).

If you encounter native rebuild errors on Windows, ensure Visual Studio C++ Build Tools or Windows SDK is installed.

---

### Step 3: Configure Python Environment (CV & ML Pipelines)
The Computer Vision engine and Machine Learning models require an isolated Python virtual environment:

#### On Windows (PowerShell):
```powershell
# 1. Create virtual environment inside python/cv_env
python -m venv python\cv_env

# 2. Activate virtual environment
.\python\cv_env\Scripts\Activate.ps1

# 3. Upgrade pip
python -m pip install --upgrade pip

# 4. Install CV dependencies
pip install -r python\cv_engine\requirements.txt

# 5. Install ML dependencies
pip install pandas numpy scikit-learn joblib
```

#### On macOS / Linux:
```bash
# 1. Create virtual environment
python3 -m venv python/cv_env

# 2. Activate virtual environment
source python/cv_env/bin/activate

# 3. Install dependencies
pip install --upgrade pip
pip install -r python/cv_engine/requirements.txt
pip install pandas numpy scikit-learn joblib
```

---

### Step 4: Verify Python CV Model Bundle
Verify that the MediaPipe Face Landmarker model exists:
```bash
# File size should be ~3.7 MB
ls -lh python/cv_engine/face_landmarker.task
```

---

### Step 5: Launch Development Server

> [!IMPORTANT]
> Because Focus Engine modifies `C:\Windows\System32\drivers\etc\hosts` (Windows) or `/etc/hosts` (macOS/Linux) to enforce website blocking, **you must run the terminal with elevated administrative privileges**:
> - **Windows**: Right-click PowerShell $\rightarrow$ "Run as Administrator".
> - **macOS / Linux**: Run with elevated permissions or launch standard dev mode (hosts blocker will report a permission banner in the UI if unprivileged).

```bash
npm run dev
```

This launches `electron-vite dev`, booting the Vite HMR server and the Electron application window ($900 \times 670$).
