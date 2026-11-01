# Data Lifecycle

This document traces the complete journey of every data type from creation to final storage and consumption.

---

## Session Data Lifecycle

```mermaid
stateDiagram-v2
    [*] --> InMemory: User starts session
    InMemory --> InMemory: Timer ticks (200ms)
    InMemory --> InMemory: Buffer updates (1s)
    InMemory --> Finalizing: User stops / timer completes
    Finalizing --> Persisted: saveSession() IPC call
    Persisted --> Displayed: getAllSessions() for History page
    Persisted --> Aggregated: getSessionTelemetrySummary()
    Aggregated --> Displayed: TelemetrySummary in Debug/History
```

**Key insight**: Session data lives entirely in React state during the session. The database only receives a single write at the very end. This means:
- If the app crashes mid-session, **that session is lost** (no partial saves).
- Database writes never block the timer or UI.

---

## Window Focus Data Lifecycle

```mermaid
flowchart LR
    OS["OS API\n(active window)"]
    Poller["TelemetryPoller\n(every 5s)"]
    Classify["domainClassifier\n(synchronous)"]
    Buffer["In-memory buffer\n(up to 12 records)"]
    DB["window_focus table"]
    Analytics["Analytics queries"]

    OS --> Poller
    Poller --> Classify
    Classify --> Buffer
    Buffer -->|"batch flush at 12 records\nor on stop()"| DB
    DB --> Analytics
```

**Batch size**: 12 records × 5s interval = flush every ~60 seconds.

**On stop**: `TelemetryPoller.stop()` calls `flushBuffer()` unconditionally before clearing state, ensuring no records are lost when a session ends.

---

## Keyboard Metrics Lifecycle

```mermaid
flowchart LR
    KeyHook["node-global-key-listener\n(OS keyboard hook)"]
    Counter["KeystrokeCounter\n(counts raw events)"]
    KPMCalc["KPMTracker\n(10s rolling window)"]
    IPC["IPC push\ntelemetry:kpmUpdate"]
    DB["keyboard_metrics table"]
    Buffer["BufferOrchestrator\n(reads every 1s)"]

    KeyHook --> Counter
    Counter --> KPMCalc
    KPMCalc --> IPC
    KPMCalc -->|"INSERT every 10s"| DB
    KPMCalc --> Buffer
```

---

## CV Data Lifecycle

```mermaid
flowchart LR
    Camera["Webcam hardware"]
    Capture["WebcamCapture\n(cv2.VideoCapture)"]
    Detector["FaceDetector\n(MediaPipe)"]
    Pose["HeadPoseEstimator\n(solvePnP)"]
    Gaze["GazeEstimator"]
    Combiner["AttentionCombiner"]
    Smoother["ExponentialSmoother\n(α=0.15)"]
    Stdout["stdout NDJSON\n(~2 fps)"]
    PyCVMgr["PythonCVProcessManager"]
    CVMetrics["cv_metrics table"]
    CVSummary["cv_metrics_summary table"]
    IPCPush["IPC push cv:update\n→ renderer"]
    BufferOrch["BufferOrchestrator\n(reads getLastRecord)"]

    Camera --> Capture
    Capture --> Detector
    Detector --> Pose
    Detector --> Gaze
    Pose --> Combiner
    Gaze --> Combiner
    Combiner --> Smoother
    Smoother --> Stdout
    Stdout --> PyCVMgr
    PyCVMgr --> CVMetrics
    PyCVMgr --> IPCPush
    PyCVMgr --> BufferOrch
    CVMetrics -->|"on session end"| CVSummary
```

**Privacy boundary**: Everything to the left of `stdout NDJSON` runs in the Python process. No pixel data crosses the process boundary. Only the numeric fields shown in the JSON schema are transmitted.

---

## Focus Buffer Lifecycle

```mermaid
flowchart TD
    Start["Session starts\nFocusBuffer.reset() → value=100"]
    Tick["BufferOrchestrator.tick()\nevery 1 second"]
    Warmup{"Seconds <= 10?\n(warmup period)"}
    AllMult1["All multipliers = 1.0\n(no decay during warmup)"]
    ComputeMult["Compute cv/keyboard/mouse/window multipliers"]
    QueryEvents["Query new distraction_events\nsince last tick"]
    CalcPenalty["calculatePenalty(events)"]
    Update["FocusBuffer.update(multipliers, penalty)"]
    CheckState["Evaluate state machine\n(focused/warning/critical/paused)"]
    CheckThreshold{"value < 10?"}
    AutoPause["triggerAutoPause()\nor triggerForceEnd()"]
    Snapshot{"secondsElapsed % 60 == 0?"}
    PersistSnap["INSERT INTO buffer_snapshots"]
    Broadcast["IPC push buffer:update\n→ renderer"]
    LivePred{"Every 60 ticks?\n(livePredictionPoller)"}
    Predict["Spawn predict.py\nIPC push ml:prediction"]

    Start --> Tick
    Tick --> Warmup
    Warmup -- yes --> AllMult1
    Warmup -- no --> ComputeMult
    AllMult1 --> Update
    ComputeMult --> QueryEvents
    QueryEvents --> CalcPenalty
    CalcPenalty --> Update
    Update --> CheckState
    CheckState --> CheckThreshold
    CheckThreshold -- yes --> AutoPause
    CheckThreshold -- no --> Snapshot
    Snapshot -- yes --> PersistSnap
    Snapshot -- no --> Broadcast
    PersistSnap --> Broadcast
    Broadcast --> LivePred
    LivePred -- yes --> Predict
    LivePred -- no --> Tick
```

---

## ML Feature Data Lifecycle

```mermaid
flowchart LR
    Sessions["sessions table"]
    KBMetrics["keyboard_metrics table"]
    MouseMetrics["mouse_metrics table"]
    BufSnaps["buffer_snapshots table"]
    BufTrans["buffer_state_transitions table"]
    WinFocus["window_focus table"]
    
    LivePred["LivePredictionPoller\n(every 60s during session)"]
    Dataset["dataset_builder.py\n(real_data_extractor.py)"]
    
    Sessions --> LivePred
    KBMetrics --> LivePred
    MouseMetrics --> LivePred
    BufSnaps --> LivePred
    BufTrans --> LivePred
    WinFocus --> LivePred
    
    LivePred -->|"stdin JSON"| PredictPy["predict.py"]
    PredictPy -->|"stdout JSON"| LivePred
    LivePred -->|"IPC push ml:prediction"| Renderer

    Sessions --> Dataset
    KBMetrics --> Dataset
    MouseMetrics --> Dataset
    BufSnaps --> Dataset
    Dataset -->|"dataset.csv (40 rows)"| TrainFocus["train_focus_model.py"]
    TrainFocus -->|"focus_model.pkl"| ModelFile["models/"]
    TrainFocus --> RetrainHistory["retrain_history table"]
```

---

## Data Retention Summary

| Data | Created | Updated | Deleted |
|------|---------|---------|---------|
| Session row | At session end | Never (except focus_score update) | Never |
| Window focus | Every 5s during session | Never | Never |
| Keyboard metrics | Every ~10s during session | Never | Never |
| Mouse metrics | Every ~10s during session | Never | Never |
| CV metrics | ~Every 500ms during session | Never | Never |
| CV summary | At session end | Never | Never |
| Buffer snapshots | Every 60s during session | Never | Never |
| Buffer transitions | On state change | `end_time`/`duration` set on next change | Never |
| Distraction events | On detection | Never | Never |
| App kill events | On app termination | Never | Never |
| Settings | On first launch / user change | On user change | Never |
| Retrain history | On each retrain | Never | Never |

> **No data is ever deleted from the database.** The application has no purge, archival, or GDPR-style deletion mechanism. As sessions accumulate over months and years, the database will grow. This is a known limitation with no current mitigation.
