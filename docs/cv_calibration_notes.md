# CV Attention Tracking Calibration Notes & Findings

This document tracks the observation findings and performance limits of the personalized head pose attention tracker on different environments.

## Calibration Parameters

| Metric | Screen Baseline (Center) | Distracted Baseline (Lap/Phone) | Calculated Midpoint | Personalized Tolerance |
|---|---|---|---|---|
| **Yaw** | | | — | |
| **Pitch**| | | | |

*Note: Midpoint calculations are automatically computed on Python startup as `midpoint = (screen + distract) / 2`.*

---

## Scenario Testing Observations

Document your findings for each of the structured manual scenarios below. For each test, record the stability and typical values of the `smoothed_attention_score` (ideal target is close to **1.0** for focus, **0.2** for distraction, and **0.0** for blocked).

### Scenario 1: Focus Mode (Coding/Reading)
*   **Action:** 2 minutes of standard coding or reading, looking directly at the screen.
*   **Observed Attention Score:**
*   **Stability / Noise:**
*   **Observations:**

### Scenario 2: Relaxed Watch (Leaning back/sideways)
*   **Action:** Watching a video or reading code with a relaxed posture (leaning slightly back or to the side, eyes still on screen).
*   **Observed Attention Score:**
*   **Stability / Noise:**
*   **Observations:**

### Scenario 3: Phone Check (Lap)
*   **Action:** Looking down at a phone held in your lap or placed on your desk.
*   **Observed Attention Score:**
*   **Drop Latency (seconds to hit < 0.3):**
*   **Observations:**

### Scenario 4: Side Discussion (Looking away)
*   **Action:** Turning head fully away (> 35 degrees) to talk to someone or look out a window.
*   **Observed Attention Score:**
*   **Drop Latency (seconds to hit < 0.3):**
*   **Observations:**

### Scenario 5: Blocked Webcam (Hands cover)
*   **Action:** Cover your webcam lens with your hand or a privacy slider.
*   **Observed Attention Score:**
*   **Recovery Latency (seconds to return to 1.0 after unblocking):**
*   **Observations:**

### Scenario 6: Poor Lighting (Low light/harsh shadows)
*   **Action:** Test under low light or with a strong background light source.
*   **Face Tracking Stability:**
*   **Observed Attention Score:**
*   **Observations:**

---

## Calibration Limitations & Edge Cases

Record any noted limitations or failure points (e.g., severe posture changes, tracking loss on extreme head tilts, impact of glasses or hair, etc.):
- 
- 
- 
