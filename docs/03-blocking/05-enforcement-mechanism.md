# Enforcement Mechanisms & Crash-Resilient Watchdog

## 1. Overview & Failure Modes

A major danger of operating-system-level hosts file modification is **system lock-out**:
- If the application crashes unexpectedly (e.g. out-of-memory exception or native segfault),
- If the user kills the process via Task Manager or `kill -9`,
- Or if system power is abruptly interrupted,

The `# FOCUS_ENGINE_BLOCK_START` block would remain permanently inside `hosts`, leaving domains like `youtube.com` and `reddit.com` inaccessible even after Focus Engine is closed.

Focus Engine addresses this through a multi-tier enforcement and recovery architecture:
1. **Periodic Background Enforcement Loops**: Continuously auditing processes and open browser windows.
2. **Synchronous Exit Handlers**: Immediate restoration during clean app shutdown (`restoreHostsSync`).
3. **The Detached Watchdog Daemon**: An independent background process that monitors parent process liveness and cleans the hosts file upon ungraceful parent termination.

---

## 2. The Detached Watchdog Daemon (`watchdogManager.ts`)

```mermaid
graph TD
    subgraph Electron App
        Parent[Focus Engine Main Process: PID P]
        HFM[hostsFileManager.ts]
    end

    subgraph Independent OS Process
        Watchdog[Detached Watchdog Node Process: PID W]
    end

    subgraph OS Resources
        HostsFile[C:\Windows\System32\drivers\etc\hosts]
    end

    HFM -->|Spawn with ELECTRON_RUN_AS_NODE: '1'| Watchdog
    Watchdog -.->|Polls every 1000ms: process.kill(P, 0)| Parent
    
    Parent -.->|If Parent Dies Abruptly| Crash[Parent Disappears]
    Crash -->|process.kill throws error| TriggerCleanup[Watchdog Catches Error]
    TriggerCleanup -->|stripBlockingBlock & writeFileSync| HostsFile
    TriggerCleanup -->|Exit 0| Exit[Watchdog Terminates]
```

### 1. Spawning Mechanics
When blocking activates in `hostsFileManager.ts`, it invokes `startWatchdog(hostsPath)`:
- Focus Engine generates an inline Node.js script string (`WATCHDOG_SCRIPT`) and writes it to `userData/watchdog.js`.
- It spawns the script using the Electron binary itself, passing `ELECTRON_RUN_AS_NODE: '1'`. This executes Electron as a lightweight, headless Node.js CLI runtime without launching any GUI:
  ```typescript
  watchdogProcess = spawn(
    process.execPath,
    [scriptPath, process.pid.toString(), hostsPath],
    {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      detached: true,
      stdio: 'ignore'
    }
  )
  watchdogProcess.unref()
  ```
- **`detached: true`**: Isolates the child process from the parent's process group so that OS termination signals sent to Focus Engine do not cascade to the watchdog.
- **`unref()`**: Prevents the child process from holding the Node.js event loop open.

### 2. Liveness Heartbeat Check
Inside `watchdog.js`, a 1000ms interval runs:
```javascript
function checkParent() {
  try {
    // kill(pid, 0) checks if the PID exists without sending an actual signal
    process.kill(parentPid, 0);
  } catch (e) {
    // Parent process has died! Clean up hosts file immediately
    try {
      if (fs.existsSync(hostsPath)) {
        const content = fs.readFileSync(hostsPath, 'utf8');
        if (content.includes(BLOCK_START_MARKER)) {
          const cleaned = stripBlockingBlock(content);
          fs.writeFileSync(hostsPath, cleaned, 'utf8');
        }
      }
    } catch (err) {}
    process.exit(0);
  }
}
setInterval(checkParent, 1000);
```

### 3. Clean Teardown
When a session ends normally via `stopBlocking()`, `stopWatchdog()` calls `watchdogProcess.kill()` to cleanly terminate the watchdog, preventing unnecessary background processes from lingering.

---

## 3. Continuous Periodic Enforcement

Enforcement is maintained actively throughout the entire session duration:

| Watcher / Loop | Location | Interval | Target | Action |
|---|---|---|---|---|
| **Tab Closer Loop** | `blockingHandlers.ts` | 30 seconds (`30,000 ms`) | Chrome, Brave, Edge, Firefox, Safari | Closes windows/tabs matching blocked domain keywords |
| **App Blacklist Loop** | `useFocusSession.ts` | 30 seconds (`30,000 ms`) | Windows/Unix running process tree | Kills blacklisted EXEs (`taskkill` / `pkill`) |
| **DNS Redirection** | OS Kernel | Real-time (Static) | Network socket requests | Resolves blocked domains to `127.0.0.1` |
| **Telemetry Health Check** | `telemetryHealthCheck.ts` | 10 seconds | Poller listeners | Verifies active window tracking is responsive |

---

## 4. Multi-Layered Shutdown Assurance

Focus Engine guarantees that the hosts file is restored under all exit scenarios:

1. **User stops session cleanly in UI**:
   - `useFocusSession.stopSession()` $\rightarrow$ IPC `blocking:stop` $\rightarrow$ `restoreHosts()`.
2. **User quits app cleanly** (File $\rightarrow$ Exit or window close):
   - `src/main/index.ts` listens to Electron's `app.on('before-quit')` and calls `restoreHostsSync()`.
3. **Application crashes or is killed by Task Manager**:
   - The detached watchdog daemon detects parent death within 1 second and cleans the hosts file.
