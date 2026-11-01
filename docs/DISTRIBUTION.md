# Application Distribution Guide

This document covers how to compile, package, and distribute Focus Engine as a standalone desktop application.

---

## 📦 1. Python Executable compilation (Prerequisite)

Before compiling the Electron app, you must compile your Python scripts into binary files using PyInstaller so that the end user does not need Python or pip dependencies installed.

Run these commands in your activated `cv_env` virtual environment:

```bash
# 1. Install PyInstaller
pip install pyinstaller

# 2. Compile CV tracker
pyinstaller --onefile --distpath build/bin python/cv_engine/main_loop.py

# 3. Compile ML predictor
pyinstaller --onefile --distpath build/bin python/ml/predict.py

# 4. Compile ML Retrain components
pyinstaller --onefile --distpath build/bin python/ml/dataset_builder.py
pyinstaller --onefile --distpath build/bin python/ml/train_focus_model.py
pyinstaller --onefile --distpath build/bin python/ml/train_anomaly_model.py
```

This populates the `build/bin/` folder with compiled `.exe` (or macOS/Linux binaries) matching your current operating system.

---

## 🚀 2. Packaging the Electron Application

Run the packaging commands depending on your target system:

```bash
# Compile and build setup files
npm run build

# Windows Installer (.exe)
npm run build:win

# macOS Installer (.dmg)
npm run build:mac

# Linux Installer (.AppImage / .deb)
npm run build:linux
```

### What ends up in the output folder?
All packaged outputs land inside the `dist/` directory:
- **Windows**: `dist/focus-engine-temp-1.0.0-setup.exe` (The redistributable installer)
- **macOS**: `dist/focus-engine-temp-1.0.0.dmg` (The redistributable disk image)
- **Linux**: `dist/focus-engine-temp-1.0.0.AppImage` (The standalone executable binary)

*Note: Avoid distributing the raw unpacked files (e.g. `dist/win-unpacked/`). Only distribute the compiled `.exe`, `.dmg`, or `.AppImage` setup file.*

---

## 🔒 3. Handling Unsigned OS Prompts

Since this is an unsigned portfolio build (not signed with a paid $99/year Apple Developer or $200+/year Windows Code Signing certificate), the operating system will block direct execution. This is expected and normal for development builds.

### 🍏 macOS (Gatekeeper Bypass)
1. Double-clicking the `.dmg` installer and running the app will show:
   > *"focus-engine" cannot be opened because it is from an unidentified developer.*
2. **The Fix**: 
   - Right-click (or Control-click) the application icon in your Applications folder and select **Open**.
   - Click **Open** on the secondary confirmation modal. This permanently whitelists the app on your machine.

### 🔌 Windows (SmartScreen Bypass)
1. Launching the setup `.exe` installer will trigger:
   > *Windows Defender SmartScreen prevented an unrecognized app from starting.*
2. **The Fix**:
   - Click the **More info** link.
   - Click the **Run anyway** button that appears.

---

## ☁️ 4. Hosting Your Installers (GitHub Releases)

The easiest, standard way to host your desktop binaries for download is using **GitHub Releases**:

1. Push your code repository to GitHub.
2. Go to your GitHub repository homepage, click **Releases** on the right sidebar, and click **Draft a new release**.
3. Create a version tag (e.g., `v1.0.0`) and title.
4. Drag and drop your compiled distribution files (the `.dmg`, `.exe`, or `.AppImage` files from your `dist/` folder) into the **Attach binaries** dropzone.
5. Publish the release. Users can now download the installer directly from your release page!
