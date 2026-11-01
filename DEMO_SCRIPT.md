# Focus Engine — 3-5 Minute Demo Script Outline

This outline provides a step-by-step walkthrough to showcase the core functionalities, ML bootstrap transitions, and privacy systems of Focus Engine during a live demo or video recording.

---

## 🎬 Part 1: The Core Value Proposition (0:00 – 0:45)
1. **Show Dashboard**: Start on the main **Dashboard** view with the application idle.
2. **Hook the Audience**:
   - *"Focus Engine is not a standard Pomodoro timer — it is a self-correcting behavioral learning system. Instead of relying on manual user focus ratings (which people skip or lie about), it automatically labels your session focus score based on live, multi-modal telemetry."*
3. **Point out the Elements**: Briefly point out the interface:
   - Timer Card (top)
   - Live Telemetry metrics (left)
   - Computer Vision Attention panel (middle)
   - Focus Buffer Gauge & Signal Breakdown (bottom)

---

## 👁️ Part 2: Starting a Session & Live Computer Vision (0:45 – 1:45)
1. **Click "Start Session"**:
   - Standard or Pomodoro focus mode.
2. **Showcase the Gaze Tracker**:
   - Enable the Webcam Gaze tracking checkbox.
   - Show how the **CV Attention Panel** updates in real-time with your face presence, head angles (yaw/pitch/roll), and screen-looking classification.
3. **Show privacy transparency**:
   - Point out that there is zero raw video being recorded or stored on disk; the system only captures derived numeric metrics.
4. **Demonstrate Buffer & Decay**:
   - Intentionally look away or check your phone for 10-15 seconds.
   - Show how the **Focus Buffer Gauge** starts decaying and enters the **Warning** state, and the **Distraction Alert** panel flashes to nudge you back to task.
   - Look back at the screen; show how the buffer recovers instantly.

---

## 🤖 Part 3: Live ML Predictions & Features (1:45 – 2:30)
1. **Highlight the Live Prediction Badge**:
   - Note the badge: `"Trending: Calibrating..."` at the start of the session.
   - Explain: *"During the first 60 seconds, the background Live Prediction Poller is gathering your first block of features. When the 60-second mark ticks, it runs our trained Random Forest and Isolation Forest models on demand."*
2. **Show prediction update (simulate or wait)**:
   - Once the prediction arrives, point out: `"Trending: 82 (on track)"` or the warning badge if you were distracted.
   - Explain how Node spawns `predict.py` on-demand with standard input, receives predictions in milliseconds, and closes to conserve resources.

---

## 🔄 Part 4: The Cold-Start Bootstrap & Retrain History (2:30 – 3:30)
1. **Show the Recommendations Panel / Analytics**:
   - Point out the honest calibration framing: *"Analyzing focus habits... complete 15 real sessions to unlock personalized recommendations."*
   - Explain the 15-session threshold design rule: *"We don't claim 'for you specifically' until we have enough real data to back it up, avoiding overconfident synthetic bias."*
2. **Show the Retrain History Table (SQL/Log)**:
   - Open a terminal or show the `retrain_history` database records.
   - Show the transition:
     - **Week 1**: 0 real / 40 synthetic (fully bootstrapped)
     - **Week 2**: 8 real / 32 synthetic
     - **Week 4**: 25 real / 15 synthetic
     - **Week 6**: 40 real / 0 synthetic (completely trained on the user's personal behavioral habits)
   - Explain: *"As real sessions accumulate, they naturally push synthetic sessions out of our 40-row training window because we query and sort descending by timestamp. The bootstrap phases itself out completely automatically with zero manual cutover logic."*

---

## 💡 Part 5: Summary & Takeaways (3:30 – 4:00)
1. **Final Summary**:
   - *"Focus Engine closes the loop of observation, automated labeling, retraining, and prediction—all running 100% locally and privately on your desktop."*
2. **End Session**: Click "Stop". Show the **Session Summary Modal** displaying the final focus score and duration.
