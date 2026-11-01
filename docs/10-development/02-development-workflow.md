# Development Workflow & CLI Tooling

## 1. Development Scripts Overview

All development scripts are defined in `package.json`:

| Script Command | Underlying Execution | Purpose |
|---|---|---|
| `npm run dev` | `electron-vite dev` | Starts Vite HMR server and Electron in development mode |
| `npm run typecheck` | `tsc --noEmit` (node + web) | Enforces strict TypeScript validation across main, preload, and renderer |
| `npm run lint` | `eslint --cache .` | Checks code formatting and syntax rules using ESLint |
| `npm run format` | `prettier --write .` | Formats code according to `.prettierrc.yaml` |
| `npm run build` | `typecheck && electron-vite build` | Compiles production bundles into `./out/` |
| `npm run build:unpack`| `build && electron-builder --dir` | Packages an unpacked native executable for testing |
| `npm run dist` | `electron-builder --publish always` | Creates final distributable installers (`.exe`, `.dmg`, `.AppImage`) |

---

## 2. Fast Feedback Loops (Hot Module Replacement)

Focus Engine uses `electron-vite` to provide instantaneous developer feedback:

### 1. Renderer React Changes (`src/renderer/`)
- Edits to React components, CSS styles, or hooks are pushed via **Vite Hot Module Replacement (HMR)** within $< 50\text{ ms}$.
- Component state is preserved without reloading the browser window or terminating active focus timers.

### 2. Main Process & Preload Changes (`src/main/` & `src/preload/`)
- Changes to Node.js backend files trigger an automatic Rollup re-bundle and seamless main process restart.

---

## 3. Subsystem Standalone Testing Workflows

Engineers can test individual subsystems in isolation without launching the full Electron GUI:

### Testing the Python CV Attention Engine
To verify camera access, head pose estimation, and gaze tracking with an interactive visual HUD:
```bash
# Activate virtual environment first
cd python/cv_engine
python main_loop.py --preview
```
- Opens an annotated OpenCV window.
- Displays live Yaw, Pitch, Roll angles, Gaze direction, and Attention score.
- Press `q` to quit and release the camera.

### Testing the Machine Learning Pipeline
To inspect training metrics, cross-validation scores, and feature importances:
```bash
cd python/ml
# 1. Rebuild dataset from synthetic pool
python dataset_builder.py

# 2. Retrain Focus Model & Anomaly Model
python train_focus_model.py
python train_anomaly_model.py

# 3. Test single-call CLI inference
python predict.py
# (Paste test JSON line into stdin and press Enter)
```

---

## 4. Git Commit Hygiene & Standards

Follow conventional commits for all documentation and engineering milestones:
- `docs: <description>`: Documentation changes or additions.
- `chore: <description>`: Build tasks, dependency adjustments, or migrations.
- `test: <description>`: Unit or integration test suites.
- `refactor: <description>`: Internal code refactoring (prohibited during migration phase).
