# Focus Engine — Project Overview

## What Is Focus Engine?

Focus Engine is a **cross-platform desktop productivity application** built with Electron, React, TypeScript, Python, OpenCV, MediaPipe, and scikit-learn. It goes significantly beyond a conventional productivity timer by combining:

1. **A focus session manager** — supporting both Pomodoro countdown mode and open-ended standard mode.
2. **Active distraction blocking** — modifying the OS hosts file to block distracting websites and killing blacklisted applications during sessions.
3. **Live behavioral telemetry** — tracking active windows, keystrokes-per-minute (KPM), and mouse activity second-by-second.
4. **A computer vision attention layer** — using the user's webcam to detect face presence, head pose (yaw/pitch/roll), and gaze direction via Google MediaPipe FaceLandmarker.
5. **A Focus Buffer engine** — a real-time score (0–100) that decays when distraction signals arrive and recovers when the user is engaged.
6. **A personalized machine learning system** — a RandomForestRegressor that predicts focus scores and an IsolationForest anomaly detector, both trained on the user's own behavioral data and retrained automatically every seven days.
7. **Analytics and history** — session history, heatmaps, streaks, productivity summaries, and AI-generated recommendations.

---

## Problem Statement

Existing productivity tools fall into two categories:

- **Passive timers** (e.g., standard Pomodoro apps) — they count time but have no awareness of whether the user is actually focusing.
- **Surveillance tools** — screenshot-based trackers that are invasive, cloud-connected, and inappropriate for professional privacy contexts.

Focus Engine solves a different problem: **can a desktop application determine whether you are genuinely focused, without storing or transmitting any raw image data?**

The answer the project demonstrates: yes, by:
- Measuring gaze direction and head pose numerically (no pixels leave the Python process).
- Fusing that signal with keyboard activity, mouse idle time, and active window classification into a single composite Focus Buffer score.
- Using that buffer score as both a real-time feedback mechanism and a training label for a personalized ML model.

---

## Core Goals

| Goal | Implementation |
|------|---------------|
| Real-time focus awareness | Focus Buffer: 0–100 score updated every second |
| Privacy-safe CV | Only numeric outputs leave Python; no image storage |
| Active enforcement | Hosts file blocking + process killing |
| Personalization | Weekly ML retraining on user's own session data |
| Cold-start robustness | 200 synthetic sessions bootstrap the model until real data accumulates |
| Offline operation | All CV inference (MediaPipe) and ML (scikit-learn) run fully locally |

---

## Project Motivation

The project was built as a practical training exercise to demonstrate mastery of:
- Electron multi-process desktop application architecture
- Secure IPC communication (contextBridge, preload scripts)
- Real-time behavioral signal processing
- Computer vision integration in a desktop context
- Machine learning pipeline design (synthetic data bootstrapping, sliding window retraining, deployment gating)
- SQLite database design for time-series telemetry

---

## What Focus Engine Is Not

- It is **not** a time-tracking SaaS. Everything runs locally.
- It is **not** a surveillance tool. No screenshots are taken. No video is recorded.
- It is **not** a browser extension. Blocking is done at the OS hosts file level.
- It is **not** production-deployed software. It is a training/demonstration project.

---

## Version and Status

- **Package version**: 1.0.3 (`package.json`)
- **Package name**: `focus-engine-temp` (reflects development/training status)
- **Status**: Functional prototype with all core features implemented. Some edge cases and platform-specific behaviors are documented but not fully hardened for production deployment.

---

## Navigation

| Document | Topic |
|----------|-------|
| [system-architecture.md](./system-architecture.md) | Multi-process architecture overview |
| [technology-stack.md](./technology-stack.md) | All languages, frameworks, and libraries |
| [application-lifecycle.md](./application-lifecycle.md) | Application startup and shutdown sequence |
| [system-data-flow.md](./system-data-flow.md) | End-to-end data flow across all modules |
| [../01-database/database-overview.md](../01-database/database-overview.md) | SQLite database architecture |
| [../02-frontend/frontend-overview.md](../02-frontend/frontend-overview.md) | React renderer and timer engine |
| [../03-blocking/blocking-overview.md](../03-blocking/blocking-overview.md) | Website and application blocking |
| [../04-main-process/main-process-overview.md](../04-main-process/main-process-overview.md) | Electron main process |
| [../05-preload/preload-overview.md](../05-preload/preload-overview.md) | Preload security bridge |
| [../06-telemetry/telemetry-overview.md](../06-telemetry/telemetry-overview.md) | Behavioral telemetry pipeline |
| [../07-computer-vision/computer-vision-overview.md](../07-computer-vision/computer-vision-overview.md) | CV engine |
| [../08-machine-learning/machine-learning-overview.md](../08-machine-learning/machine-learning-overview.md) | ML pipeline |
| [../09-integration/module-interactions.md](../09-integration/module-interactions.md) | Cross-module dependencies |
| [../10-development/setup-guide.md](../10-development/setup-guide.md) | Development setup |
