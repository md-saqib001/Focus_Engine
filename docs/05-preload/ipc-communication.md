# Preload IPC Communication & The Unsubscribe Pattern

## 1. Overview

The Preload script translates high-level JavaScript function calls into low-level Electron IPC messages. It handles:
1. **Asynchronous Request-Response Dispatching** (`ipcRenderer.invoke`).
2. **Push Event Subscription Management** (`ipcRenderer.on` paired with explicit unsubscription).

---

## 2. The Unsubscribe Pattern (Preventing React Memory Leaks)

In React applications, components frequently mount and unmount as users navigate between tabs (`Dashboard`, `History`, `Settings`).
If a component subscribes to an IPC event using standard `ipcRenderer.on` without cleanup:
- The listener remains permanently registered in Electron's internal EventEmitter table.
- Every subsequent page visit adds an additional duplicate listener.
- After navigating between tabs 10 times, a single window focus event triggers 10 identical callback executions, causing severe UI lag and memory leaks.

Focus Engine solves this across **every single event subscriber** in `src/preload/index.ts` using the **Unsubscribe Closure Pattern**:

```typescript
onActiveWindowUpdate: (
  callback: (info: {
    appName: string
    windowTitle: string
    domain: string
    category: 'productive' | 'distraction' | 'neutral' | 'unknown'
  }) => void
) => {
  // 1. Define an explicit internal listener reference
  const subscription = (
    _event: any,
    data: {
      appName: string
      windowTitle: string
      domain: string
      category: 'productive' | 'distraction' | 'neutral'
    }
  ) => callback(data)

  // 2. Attach listener to ipcRenderer
  ipcRenderer.on('telemetry:activeWindowUpdate', subscription)

  // 3. Return an idempotent teardown function
  return () => {
    ipcRenderer.removeListener('telemetry:activeWindowUpdate', subscription)
  }
}
```

### Clean Consumption in React Hooks:
```typescript
useEffect(() => {
  const unsubscribe = window.focusEngineAPI.onActiveWindowUpdate((info) => {
    setActiveWindow(info)
  })
  // Automatically called by React on component unmount!
  return () => unsubscribe()
}, [])
```

---

## 3. Preload IPC Mapping Directory

| Preload API Function | IPC Channel Invoked | Protocol | Arguments Sent | Response Returned |
|---|---|---|---|---|
| `saveSession(args)` | `session:save` | `invoke` | Normalised session object | `IPCResponse<boolean>` |
| `getAllSessions()` | `session:getAll` | `invoke` | None | `IPCResponse<SessionRow[]>` |
| `getSessionSummary(id)` | `telemetry:getSessionSummary` | `invoke` | `{ sessionId: id }` | `IPCResponse<SessionSummary>` |
| `startBlocking()` | `blocking:start` | `invoke` | None | `IPCResponse<void>` |
| `stopBlocking()` | `blocking:stop` | `invoke` | None | `IPCResponse<void>` |
| `killBlacklistedApps(id)`| `appBlocking:killBlacklisted`| `invoke` | `{ sessionId: id }` | `IPCResponse<string[]>` |
| `startTelemetry(id, m)` | `telemetry:start` | `invoke` | `{ sessionId: id, mode: m }` | `IPCResponse<void>` |
| `stopTelemetry()` | `telemetry:stop` | `invoke` | None | `IPCResponse<void>` |
| `startCV(id, fps)` | `cv:start` | `invoke` | `id, fps` | `IPCResponse<void>` |
| `stopCV()` | `cv:stop` | `invoke` | None | `IPCResponse<void>` |
| `getCurrentFocusBuffer()`| `buffer:getCurrent` | `invoke` | None | `IPCResponse<BufferInfo>` |
| `pauseBuffer()` | `buffer:pause` | `invoke` | None | `IPCResponse<void>` |
| `resumeBuffer()` | `buffer:resume` | `invoke` | None | `IPCResponse<void>` |
| `onActiveWindowUpdate` | `telemetry:activeWindowUpdate`| `on` | Callback | Unsubscribe `() => void` |
| `onFocusBufferUpdate` | `buffer:update` | `on` | Callback | Unsubscribe `() => void` |
| `onSessionAutoPause` | `session:autoPause` | `on` | Callback | Unsubscribe `() => void` |
| `onSessionForceEnd` | `session:forceEnd` | `on` | Callback | Unsubscribe `() => void` |
| `onTelemetryHealthWarning`| `telemetry:healthWarning` | `on` | Callback | Unsubscribe `() => void` |
| `analytics.getHeatmap()` | `analytics:getHeatmap` | `invoke` | None | `IPCResponse<HeatmapCell[]>` |
| `analytics.getStreaks()` | `analytics:getStreaks` | `invoke` | None | `IPCResponse<StreakData>` |
| `analytics.getProductivitySummary()` | `analytics:getProductivitySummary` | `invoke` | None | `IPCResponse<ProductivitySummary>` |
| `analytics.getRecommendations()` | `analytics:getRecommendations` | `invoke` | None | `IPCResponse<RecommendationResult>` |
