import { BrowserWindow } from 'electron'
import { getActiveWindow } from './activeWindowTracker'
import { insertBatch } from '../database/windowFocusRepository'
import { classifyWindow } from './domainClassifier'

export interface BroadcastActiveWindowInfo {
  appName: string
  windowTitle: string
  domain: string
  category: 'productive' | 'distraction' | 'neutral' | 'unknown'
}

export class TelemetryPoller {
  private intervalId: NodeJS.Timeout | null = null
  private currentSessionId: string | null = null
  
  // In-memory buffer to batch inserts and minimize disk write locks
  private buffer: {
    sessionId: string
    appName: string
    windowTitle: string
    domain: string
    category: string
    timestamp: number
  }[] = []

  private lastTickTime = 0
  private lastActiveWindow: BroadcastActiveWindowInfo | null = null

  public getLastTickTime(): number {
    return this.lastTickTime
  }

  public getLastActiveWindow(): BroadcastActiveWindowInfo | null {
    return this.lastActiveWindow
  }

  private readonly BATCH_SIZE = 12

  private listeners: ((info: BroadcastActiveWindowInfo) => void)[] = []

  /**
   * Registers a callback listener to trigger on every active window poll tick.
   */
  public onTick(cb: (info: BroadcastActiveWindowInfo) => void): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb)
    }
  }

  /**
   * Starts telemetry polling for the active focus session.
   * Runs every 5 seconds.
   */
  public start(sessionId: string): void {
    this.stop() // Safely clear any previous poller first
    this.currentSessionId = sessionId
    this.buffer = [] // Reset buffer on new session start
    this.lastTickTime = Date.now()
    this.lastActiveWindow = null

    const poll = async () => {
      if (!this.currentSessionId) return
      this.lastTickTime = Date.now()

      try {
        const activeWindow = await getActiveWindow()
        if (activeWindow && this.currentSessionId) {
          // Perform classification
          const classification = classifyWindow(activeWindow.appName, activeWindow.windowTitle)
          const now = Date.now()

          // 1. Push record into local in-memory buffer
          this.buffer.push({
            sessionId: this.currentSessionId,
            appName: activeWindow.appName,
            windowTitle: activeWindow.windowTitle,
            domain: classification.domain,
            category: classification.category,
            timestamp: now
          })

          const tickInfo: BroadcastActiveWindowInfo = {
            appName: activeWindow.appName,
            windowTitle: activeWindow.windowTitle,
            domain: classification.domain,
            category: classification.category
          }

          this.lastActiveWindow = tickInfo

          // 2. Broadcast live update immediately to renderer process (Dashboard live dot)
          this.broadcastUpdate(tickInfo)

          // Trigger callbacks for internal observers (e.g. DistractionDetector)
          this.listeners.forEach((l) => {
            try {
              l(tickInfo)
            } catch (e) {
              console.error('[TelemetryPoller] observer callback failed:', e)
            }
          })

          // 3. Flush buffer to SQLite database in a batch if batch size reached
          if (this.buffer.length >= this.BATCH_SIZE) {
            this.flushBuffer()
          }
        }
      } catch (err) {
        console.error('[TelemetryPoller] Tick error:', err)
      }
    }

    // Run once immediately, then poll every 5000ms
    poll()
    this.intervalId = setInterval(poll, 5000)
    console.log(`[TelemetryPoller] Started polling for session: ${sessionId}`)
  }

  /**
   * Stops active telemetry polling and flushes any remaining buffered records to SQLite.
   */
  public stop(): void {
    // Force save any remaining items in the buffer before clearing
    this.flushBuffer()

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.currentSessionId = null
    this.lastActiveWindow = null
    console.log('[TelemetryPoller] Stopped polling')
  }

  /**
   * Writes all buffered items to SQLite using a single database transaction.
   */
  private flushBuffer(): void {
    if (this.buffer.length > 0) {
      try {
        insertBatch(this.buffer)
        console.log(`[TelemetryPoller] Flushed batch of ${this.buffer.length} telemetry records to database.`)
      } catch (err) {
        console.error('[TelemetryPoller] Failed to flush batch to database:', err)
      }
      this.buffer = [] // Always empty buffer after attempting insert
    }
  }

  /**
   * Helper to send IPC event to all open renderer windows.
   */
  private broadcastUpdate(info: BroadcastActiveWindowInfo): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('telemetry:activeWindowUpdate', info)
      }
    }
  }
}

// Export a single global instance for orchestration
export const telemetryPoller = new TelemetryPoller()
