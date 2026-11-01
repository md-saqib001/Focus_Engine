# Module 10: Development, Testing & Contribution — Presentation & Defense Speech

## 1. Presentation Metadata

- **Target Presentation Duration**: **5 Minutes** (Focused operational & developer experience module)
- **Target Audience**: DevOps Engineers, New Contributors, QA Leads, Technical Evaluators
- **Primary Objective**: Present the developer environment, verification tooling, CI/CD quality gates, and contribution guidelines of Focus Engine, explaining how native C++ dependencies, Python virtual environments, Administrator elevation, and strict TypeScript types are managed across the development lifecycle.
- **Delivery Pace**: ~135 – 145 words per minute (~700 spoken words)

---

## 2. Minute-by-Minute Presentation Timeline

| Time Marker | Section Title | Core Technical Message | Visual / Slide Cue |
|---|---|---|---|
| **00:00 – 01:00** | Prerequisites & The Native Toolchain Challenge | Node.js 20+, Python 3.10–3.12, C++ build tools, and Administrator elevation on Windows. | Developer Setup Matrix table showing versions and purposes. |
| **01:00 – 02:15** | The Dual-Stack Setup Sequence | `npm install` auto-rebuilding `better-sqlite3` via `electron-builder install-app-deps`; `cv_env` virtual environment. | Terminal walkthrough of initial installation commands. |
| **02:15 – 03:30** | Quality Assurance Pipeline & Testing | TypeScript dual-target typechecks (`typecheck:node` and `typecheck:web`), ESLint, standalone test harnesses. | CI/CD Quality Gate flowchart. |
| **03:30 – 05:00** | Contribution Workflow & Evaluator Defense | Conventional commits, workstream branch naming (`eng1/*` to `eng4/*`), packaging via `electron-builder`, and Q&A. | Packaging & distribution pipeline diagram. |

---

## 3. Verbatim Spoken Presentation Track

### [00:00 – 01:00] Section 1: Prerequisites & The Native Toolchain Challenge

> "Good morning. In this 5-minute technical briefing, I will present the developer workflow, build pipeline, and quality assurance system of **Focus Engine**.
> 
> Because Focus Engine integrates both modern web frameworks and low-level operating system bindings, the development environment requires a coordinated dual-stack toolchain:
> 1. **Node.js 20 LTS** and **npm 10+** for the Electron runtime and Vite build server.
> 2. **Python 3.10, 3.11, or 3.12** for our Computer Vision and Machine Learning pipelines. *Note: Python 3.13 is strictly avoided as MediaPipe wheels do not yet support it.*
> 3. **Visual C++ Build Tools** on Windows for compiling native C++ Node addons.
> 4. **Administrator Privileges**: On Windows, developers must launch their terminal using 'Run as Administrator' so the application can modify `C:\Windows\System32\drivers\etc\hosts` during development testing."

---

### [01:00 – 02:15] Section 2: The Dual-Stack Setup Sequence

> "To make onboarding frictionless, the installation sequence is automated in two stages:
> 
> First, running `npm install`. Our `package.json` includes an automated `postinstall` hook that triggers:
> `electron-builder install-app-deps`
> This automatically compiles native C++ binaries for `better-sqlite3` and `node-global-key-listener` directly against Electron's internal V8 ABI (`electron ^39.2.6`), eliminating the infamous `NODE_MODULE_VERSION` mismatch error.
> 
> Second, configuring the Python virtual environment:
> ```powershell
> python -m venv python\cv_env
> .\python\cv_env\Scripts\Activate.ps1
> pip install -r python\cv_engine\requirements.txt
> pip install pandas numpy scikit-learn joblib
> ```
> 
> Once configured, running **`npm run dev`** launches `electron-vite dev`, booting the Vite Hot Module Replacement (HMR) server and the Electron application window in under two seconds."

---

### [02:15 – 03:30] Section 3: Quality Assurance Pipeline & Testing

> "To ensure enterprise stability, our codebase enforces a strict, three-tier quality assurance pipeline:
> 
> 1. **Strict TypeScript Validation**:
>    Because Electron applications contain two distinct JavaScript runtime targets, we run isolated dual typechecks:
>    - `npm run typecheck:node`: Validates the Main Process and Preload bridge against Node.js 22 types.
>    - `npm run typecheck:web`: Validates React 18 components against DOM and Web types.
>    Both must pass with zero errors.
> 2. **Static Linting & Formatting**:
>    Enforced via `eslint` and `prettier` across all TypeScript, CSS, and Markdown documentation.
> 3. **Standalone Subsystem Harnesses**:
>    Developers can test subsystems independently without booting the full GUI:
>    - Testing Python CV: `python python/cv_engine/main.py --preview`
>    - Testing ML training: `python python/ml/train_focus_model.py`"

---

### [03:30 – 05:00] Section 4: Contribution Workflow & Defense Readiness

> "Finally, we maintain a disciplined contribution workflow tailored to our four-engineer architecture:
> - Git branch names follow strict workstream prefixes: `eng1/frontend-db-*`, `eng2/telemetry-buffer-*`, `eng3/blocking-*`, and `eng4/cv-ml-*`.
> - Commits adhere strictly to Conventional Commits: `docs:`, `feat:`, `fix:`, `chore:`.
> - For production packaging, **`npm run build:unpack`** generates a standalone portable directory, while **`npm run dist`** produces a signed Windows executable installer via `electron-builder`.
> 
> Thank you. I welcome your questions regarding our build toolchains, testing harnesses, and developer operations."

---

## 4. Technical Defense: Tough Evaluator Questions & Model Answers

### Question 1: "What causes the `NODE_MODULE_VERSION` error in Electron development, and how does your setup guarantee it won't happen?"
**Model Answer:**
> "Node.js and Electron maintain separate V8 ABI version numbers. When you run `npm install`, native C++ modules (like `better-sqlite3`) compile by default against your system's global Node.js binary. When Electron tries to load that module, it crashes because Electron's internal V8 ABI differs. We solved this permanently by embedding `electron-builder install-app-deps` directly into our `postinstall` script in `package.json`. Every `npm install` automatically recompiles native addons targeting the exact bundled Electron header version (`electron 39.2.6`), guaranteeing ABI alignment."

### Question 2: "Why keep the Python virtual environment at `python/cv_env` inside the repository instead of using the user's global Python environment?"
**Model Answer:**
> "Global Python environments are notorious for package version conflicts: a developer might have `numpy 1.24` or an incompatible version of MediaPipe installed for another project. By isolating dependencies inside `python/cv_env`, Focus Engine guarantees exact version pinning (`mediapipe==0.10.14`, `opencv-python==4.10.0.84`, `numpy==2.5.1`). Furthermore, the path `python/cv_env` is explicitly gitignored, ensuring developer environments remain clean."

