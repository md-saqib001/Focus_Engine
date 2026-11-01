# Error Handling & Fault Tolerance Strategy

## 1. Overview & Defense-in-Depth Philosophy

A desktop application that interacts with low-level OS drivers, the filesystem, hardware cameras, and external subprocesses must be exceptionally resilient. Focus Engine implements a **multi-tiered fault-tolerance matrix** ensuring that failures in non-critical components (such as a disconnected webcam or a temporary rendering glitch) never crash the core application or corrupt user data.

```mermaid
graph TD
    subgraph Tier 1: UI Resilience
        ReactError[UI Component Crash] --> EB[ErrorBoundary.tsx: Catch & Display Recovery Card]
        EB --> TimerSafe[Active Timer Continues Uninterrupted]
    end

    subgraph Tier 2: IPC Resilience
        MainException[Node.js Handler Exception] --> IPCWrap[catch(error) -> { success: false, error }]
        IPCWrap --> UIHandle[UI Renders Error Alert / No Hard Rejection]
    end

    subgraph Tier 3: Subprocess Resilience
        PythonHang[Python Process Hangs > 5s] --> Timeout[predictionService 5s Timeout]
        Timeout --> KillProc[processInstance.kill() & Degraded Fallback]
        CameraDrop[Webcam Unplugged] --> FailureCounter[main_loop: 10 Consecutive Failures Limit]
        FailureCounter --> GracefulExit[Releases Camera Handle & Emits Degraded JSON]
    end

    subgraph Tier 4: OS Safety & Crash Guard
        AppCrash[Electron Sudden Termination / BSOD] --> Watchdog[Detached Watchdog Daemon: PID Monitor]
        Watchdog --> CleanHosts[Restores Original hosts File Automatically]
    end
```

---

## 2. Failure Handling Matrix Across Subsystems

| Subsystem | Potential Failure Mode | Detection Mechanism | Recovery / Mitigation Behavior |
|---|---|---|---|
| **Frontend UI** | Component rendering exception | `ErrorBoundary.tsx` (`componentDidCatch`) | Displays inline fallback card with "Attempt Recovery" button; session timer remains active |
| **Hosts Blocker** | Insufficient administrative permissions (`EACCES`/`EPERM`) | Node.js `fs.promises.writeFile` catch block | Formats actionable guidance (re-run as Admin/sudo) and displays non-blocking banner in UI |
| **Hosts Blocker** | Main Electron app killed via Task Manager | Parent PID liveness polling in `watchdog.js` | Detached watchdog detects parent death within 1s, strips block markers, and restores original file |
| **App Blocker** | Target process not running during `taskkill` | Windows exit code 128 / Unix exit code 1 | Swallowed gracefully; logged as "not running" without throwing errors |
| **App Blocker** | Malicious injection characters in process name | Regex `/^[a-zA-Z0-9_-]+$/` in `sanitizeProcessName` | Throws immediate input validation exception; blocks command execution |
| **CV Engine** | Webcam disconnected or hardware camera failure | 10 consecutive frame read failures in `main_loop.py` | Emits degraded JSON records (`{"face_present": false}`); aborts loop safely and turns off camera LED |
| **CV Engine** | Python environment missing or crashes | Child process `error` and non-zero `exit` events | Disables CV HUD panel in UI; gracefully falls back to OS-only window/keystroke tracking |
| **ML Predictor** | Python script hangs during model prediction | 5-second timeout in `predictionService.ts` | Kills child process with `SIGKILL`; resolves Promise with `{ success: false }` |
| **Database** | Abrupt power outage or system crash | SQLite Write-Ahead Logging (`WAL` mode) | Automatic rollback of uncommitted transactions upon next database launch; zero corruption |
| **Telemetry** | OS window hooks stall or freeze | `TelemetryHealthCheck` 10-second heartbeat | Emits `telemetry:healthWarning` to UI; displays reconnection prompt |

---

## 3. Standardized IPC Failure Contract

All two-way IPC handlers in `src/main/ipc/*` wrap business logic in `try / catch` blocks to guarantee that an exception never propagates as an unhandled Promise rejection:

```typescript
ipcMain.handle('domain:action', async (_event, args) => {
  try {
    const result = await executeAction(args)
    return { success: true, data: result }
  } catch (error: any) {
    console.error('[IPC domain:action] Error:', error)
    return { 
      success: false, 
      error: error.message || String(error) 
    }
  }
})
```

The frontend checks `result.success`:
```typescript
const res = await window.focusEngineAPI.startBlocking()
if (!res.success && res.error) {
  setBlockingStatus('error')
  setBlockingError(res.error)
}
```
This ensures clear user-facing error reporting while keeping the application fully responsive.
