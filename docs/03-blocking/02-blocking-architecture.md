# Blocking Architecture & Data Flow

## 1. Subsystem Architecture

The Blocking Subsystem sits within the Electron main process, orchestrating OS-level network configuration and process control. It exposes clean IPC endpoints to the renderer while abstracting all operating system differences.

```mermaid
graph TD
    subgraph Renderer Hook
        UFS[useFocusSession.ts]
    end

    subgraph IPC Dispatchers
        BH[blockingHandlers.ts]
        ABH[appBlockingHandlers.ts]
    end

    subgraph Database Layer
        BDR[blockedDomainsRepository.ts]
        BAR[blacklistedAppsRepository.ts]
    end

    subgraph Core Execution Engines
        HFM[hostsFileManager.ts]
        TC[tabCloser.ts]
        WM[watchdogManager.ts]
        PM[processManager.ts]
    end

    subgraph Host OS Environment
        Hosts[OS Hosts File]
        WDProcess[Detached Node Watchdog Process]
        Browsers[Browser Windows / Tabs]
        AppProcesses[OS Running Process Tree]
    end

    UFS -->|IPC 'blocking:start'| BH
    UFS -->|IPC 'blocking:stop'| BH
    UFS -->|IPC 'appBlocking:killBlacklisted'| ABH

    BH --> BDR
    ABH --> BAR

    BH --> HFM
    BH --> TC
    HFM --> Hosts
    HFM --> WM
    WM --> WDProcess
    TC --> Browsers

    ABH --> PM
    PM --> AppProcesses
```

---

## 2. Activation Sequence (Session Start)

When a focus session starts (`type === 'focus'`), `useFocusSession.ts` initiates the dual blocking pipeline:

```mermaid
sequenceDiagram
    autonumber
    participant UI as useFocusSession.ts
    participant BH as blockingHandlers.ts
    participant BDR as blockedDomainsRepository.ts
    participant HFM as hostsFileManager.ts
    participant TC as tabCloser.ts
    participant WM as watchdogManager.ts
    participant PM as processManager.ts
    participant DB as SQLite

    UI->>BH: invoke('blocking:start')
    BH->>BDR: getEnabledBlockedDomains()
    BDR-->>BH: ['youtube.com', 'reddit.com', ...]
    
    BH->>HFM: blockDomains(domains)
    HFM->>HFM: backupHosts() (if no backup exists)
    HFM->>HFM: Append # FOCUS_ENGINE_BLOCK_START ...
    HFM->>WM: startWatchdog(hostsPath)
    WM-->>WM: Spawn detached Node.js monitor

    BH->>TC: closeActiveBlockedTabs(domains) (immediate trigger)
    BH->>BH: Start 30s interval for periodic tab closer
    BH-->>UI: { success: true }

    UI->>PM: invoke('appBlocking:killBlacklisted', { sessionId })
    PM->>PM: Scan processes (tasklist / ps)
    PM->>PM: killProcess(app) (taskkill / pkill)
    PM->>DB: logKillEvent(sessionId, app)
    PM-->>UI: { success: true, data: ['steam', 'discord'] }
```

---

## 3. Continuous Enforcement Loop (While Session Runs)

Blocking is not merely a one-time event at session startup. Users may attempt to open blocked applications or launch distraction websites midway through a focus session:

1. **Active Application Watchdog**:
   - In `useFocusSession.ts`, an interval runs every **30 seconds** (`runActiveAppBlocking`):
     ```typescript
     intervalId = setInterval(runActiveAppBlocking, 30000)
     ```
   - Checks running processes and kills any blacklisted applications launched during the session.
   - Updates the UI `appsKilled` state list in real time.
2. **Periodic Tab Closer Loop**:
   - In `blockingHandlers.ts`, `tabCloserInterval` fires every **30 seconds** (`30,000 ms`):
     ```typescript
     tabCloserInterval = setInterval(() => {
       closeActiveBlockedTabs(domains).catch(...)
     }, 30000)
     ```
   - Scans browser window titles and closes any newly opened windows/tabs attempting to reach blocked keywords.
3. **Persistent DNS Redirection**:
   - The OS `hosts` file redirection remains active 100% of the time, causing any new HTTP/HTTPS requests to fail instantly with `ERR_CONNECTION_REFUSED`.

---

## 4. Deactivation Sequence (Session End / Stop)

When a session finishes naturally, is manually stopped, or is abandoned:

```mermaid
sequenceDiagram
    autonumber
    participant UI as useFocusSession.ts
    participant BH as blockingHandlers.ts
    participant HFM as hostsFileManager.ts
    participant WM as watchdogManager.ts

    UI->>BH: invoke('blocking:stop')
    BH->>BH: clearInterval(tabCloserInterval)
    BH->>HFM: restoreHosts()
    HFM->>HFM: Read hosts file & strip # FOCUS_ENGINE_BLOCK_*
    HFM->>HFM: Write clean hosts content
    HFM->>WM: stopWatchdog()
    WM-->>WM: Kill detached watchdog process
    BH-->>UI: { success: true }
```

---

## 5. Emergency Shutdown Path (`restoreHostsSync`)

If the user initiates a sudden application quit (`app.on('before-quit')`), asynchronous IPC calls and Node.js event-loop microtasks cannot be awaited reliably:
- Focus Engine exposes `restoreHostsSync()` in `src/main/blocking/hostsFileManager.ts`.
- Uses `fs.readFileSync` and `fs.writeFileSync`.
- Executed synchronously on the main thread during `app.on('before-quit')` in `src/main/index.ts`, guaranteeing that the user's internet access is restored before the process terminates.
