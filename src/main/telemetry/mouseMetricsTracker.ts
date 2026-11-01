import { BrowserWindow } from 'electron'
import { mouseTracker } from './mouseTracker'
import { activityTimestampTracker } from './activityTimestampTracker'
import { insertMouseMetrics } from '../database/mouseMetricsRepository'

export class MouseMetricsTracker {
  private minuteIntervalId: NodeJS.Timeout | null = null
  private liveIntervalId: NodeJS.Timeout | null = null
  private currentSessionId: string | null = null
  private segmentStartTime = 0
  private lastTickTime = 0

  public getLastTickTime(): number {
    return this.lastTickTime
  }

  /**
   * Starts tracking mouse activity metrics and live idle states.
   */
  public start(sessionId: string): void {
    this.stop() // Clear previous instances first
    this.currentSessionId = sessionId
    this.segmentStartTime = Date.now()
    this.lastTickTime = Date.now()

    // Start background powershell listener
    mouseTracker.start()

    // 1. Record KPM-like mouse stats every 60 seconds
    this.minuteIntervalId = setInterval(() => {
      this.recordMouseSegment(true)
    }, 60000)

    // 2. Broadcast live idle duration checks every 1 second
    this.liveIntervalId = setInterval(() => {
      this.broadcastLiveActivity()
    }, 1000)

    console.log(`[MouseMetricsTracker] Started mouse telemetry for session: ${sessionId}`)
  }

  /**
   * Stops tracking and flushes final partial segment.
   */
  public stop(): void {
    if (this.currentSessionId) {
      this.recordMouseSegment(false)
    }

    if (this.minuteIntervalId) {
      clearInterval(this.minuteIntervalId)
      this.minuteIntervalId = null
    }

    if (this.liveIntervalId) {
      clearInterval(this.liveIntervalId)
      this.liveIntervalId = null
    }

    mouseTracker.stop()
    this.currentSessionId = null
    console.log('[MouseMetricsTracker] Stopped mouse telemetry.')
  }

  /**
   * flushes metrics to database.
   */
  private recordMouseSegment(isFullMinute: boolean): void {
    if (!this.currentSessionId) return

    const now = Date.now()
    this.lastTickTime = now
    const elapsedMs = now - this.segmentStartTime
    const elapsedSeconds = elapsedMs / 1000

    const rawCounts = mouseTracker.resetCounts()
    this.segmentStartTime = now

    let clicks = rawCounts.clicks
    let movements = rawCounts.movements

    if (!isFullMinute && elapsedSeconds >= 3) {
      // Scale partial metrics to 60-second rate
      clicks = Math.round((rawCounts.clicks / elapsedSeconds) * 60)
      movements = Math.round((rawCounts.movements / elapsedSeconds) * 60)
    }

    const currentIdle = activityTimestampTracker.getIdleSeconds()

    try {
      insertMouseMetrics(this.currentSessionId, clicks, movements, currentIdle)
      console.log(`[MouseMetricsTracker] Logged mouse segment. Clicks: ${clicks}, Moves: ${movements}, Idle: ${currentIdle}s`)
    } catch (err) {
      console.error('[MouseMetricsTracker] Failed to insert mouse metrics:', err)
    }
  }

  /**
   * Broadcasts live active/idle status to renderer UI.
   */
  private broadcastLiveActivity(): void {
    if (!this.currentSessionId) return

    const idleSeconds = activityTimestampTracker.getIdleSeconds()
    // Define active threshold: if no keypress or mouse action within last 5 seconds, user is idle
    const status = idleSeconds >= 5 ? 'Idle' : 'Active'

    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('telemetry:activityUpdate', { status, idleSeconds })
      }
    }
  }
}

// Export singleton instance
export const mouseMetricsTracker = new MouseMetricsTracker()
