# Focus Engine

A productivity-tracking desktop application built with Electron + React + TypeScript, with a computer vision layer powered by Python, OpenCV, and MediaPipe, and an offline machine learning prediction system powered by scikit-learn.

---

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

---

## Node / Electron Setup

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

---

## Python / Machine Learning & CV Setup

The CV and Machine Learning subsystems live in `python/cv_engine/` and `python/ml/` respectively. Both execute fully locally in your environment:
- **WebSocket Connection**: The CV process communicates with Node.js via WebSocket (continuous streaming).
- **Spawn-per-Call stdin/stdout**: The ML prediction engine (`predict.py`) is spawned on-demand, consuming JSON feature arrays on stdin, performing inference, writing JSON back to stdout, and exiting immediately to conserve memory.

### 1. Create and activate the virtual environment

> **Python 3.12 is required.** MediaPipe does not yet publish wheels for Python 3.13+.
> Check your versions with `py -0` — if 3.12 is listed, use the commands below.

```powershell
# Windows (PowerShell) — uses the py launcher to select 3.12
py -3.12 -m venv python\cv_env
python\cv_env\Scripts\Activate.ps1

# Windows (CMD)
py -3.12 -m venv python\cv_env
python\cv_env\Scripts\activate.bat

# macOS / Linux (assuming python3.12 is installed)
python3.12 -m venv python/cv_env
source python/cv_env/bin/activate
```

> **Tip (Windows):** If PowerShell blocks script execution, run once:
> `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### 2. Install dependencies (CV + ML)

```bash
pip install -r python/cv_engine/requirements.txt
pip install pandas scikit-learn seaborn
```

### 3. Verify the CV webcam and MediaPipe Face Mesh

```bash
python python/cv_engine/webcam_test.py
python python/cv_engine/mediapipe_test.py
```

---

## ML Pipeline: Observe → Label → Train → Predict → Improve

To solve the "cold start" ML training problem, the application implements a statistical bootstrap strategy:
1. **Calibration Pool**: Generates 200 synthetic sessions modeling High-Focus and Low-Focus behavioral archetypes backdated 60–90 days.
2. **Sliding Training Window**: Re-builds a 40-row dataset of the most recent sessions by sorting both real database logs and the synthetic pool chronologically descending.
3. **Automatic Phasing-Out**: As you complete real focus sessions, they accumulate at the top of the descending sort, naturally displacing the oldest synthetic rows from the 40-row sliding window with zero manual cutover required.
4. **Weekly Retraining**: App launch triggers a background check. If 7+ days have elapsed since the last retrain, it re-slices the 40-row sliding window and re-trains `RandomForestRegressor` and `IsolationForest` models.
5. **Deployment Gate**: The retraining pipeline compares the candidate model's 5-fold cross-validated $R^2$ against the currently active model, overwriting the production pickle file only if performance improves.

---

## Privacy Architecture — Computer Vision

> **No raw frames ever leave the Python process.**

| Principle | Implementation |
|-----------|---------------|
| **In-memory only** | Frames captured via `cv2.VideoCapture` are processed as NumPy arrays in RAM and discarded at the end of each tick. |
| **No disk writes** | `cv2.imwrite`, `cv2.VideoWriter`, and all file-write calls are **absent from production code**. `cv2.imshow` is used exclusively in the `*_test.py` scripts (never imported in production modules). |
| **Numeric outputs only** | The only data that leaves Python are derived numeric metrics — e.g., eye aspect ratio, head-pose angles, blink count, presence flag. Raw pixel data is never serialised or sent over the WebSocket. |
| **Local WebSocket** | The WebSocket server binds to `127.0.0.1` only. No external network interface is exposed. |
| **No model telemetry** | MediaPipe runs fully offline; no frames or landmarks are sent to any remote service. |
| **User consent** | The camera is activated only while a Focus session is running and the user has explicitly enabled the CV feature. |

These constraints mean the CV subsystem satisfies a **"numeric output only"** data-minimisation model: even in the event of a bug, no image data can be leaked over the wire or written to the filesystem from production paths.

---

## Project Structure

```
focus-engine/
├── src/
│   ├── main/                  # Electron main process (TypeScript)
│   │   ├── ml/                # Prediction Service, Recommendations, and Weekly Retraining
│   │   ├── database/          # SQLite repos (sessions, telemetry, transitions, settings)
│   │   └── buffer/            # Live prediction poller and state machines
│   ├── renderer/              # React UI (TypeScript)
│   └── preload/               # Context bridge
├── python/
│   ├── cv_env/                # Python venv (git-ignored)
│   ├── cv_engine/             # Computer Vision capture and gaze estimation scripts
│   └── ml/                    # Data cleanups, extractor, generators, trainers, and predictors
│       ├── data/              # CSV datasets (synthetic pool, sliding window dataset.csv)
│       ├── models/            # Pickle models (.pkl) and model metadata JSONs
│       ├── eda_output/        # Focus score distribution plots and correlation matrices
│       ├── constants.py       # Shared feature order alignment constant
│       └── predict.py         # Stdin/stdout inference responder
└── electron.vite.config.ts    # Build configuration
```
