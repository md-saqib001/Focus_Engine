import { BrowserWindow } from 'electron'
import { keystrokeCounter } from './keystrokeCounter'
import { insertKPM } from '../database/keyboardMetricsRepository'

export class KpmTracker {
  private intervalId: NodeJS.Timeout | null = null
  private currentSessionId: string | null = null
  private segmentStartTime = 0
  private lastTickTime = 0
  private lastKpm = 0

  public getLastTickTime(): number {
    return this.lastTickTime
  }

  public getLastKPM(): number {
    return this.lastKpm
  }

  /**
   * Starts global keyboard metrics tracking for the session.
   */
  public start(sessionId: string): void {
    this.stop() // Clear previous tracker instance if active
    this.currentSessionId = sessionId
    this.segmentStartTime = Date.now()
    this.lastTickTime = Date.now()
    this.lastKpm = 0

    // Start the global keystroke counter hook
    keystrokeCounter.start()

    // Interval to record KPM every 60 seconds
    this.intervalId = setInterval(() => {
      this.recordKPMMinutesegment(true)
    }, 60000)

    console.log(`[KpmTracker] Started KPM tracking for session: ${sessionId}`)
  }

  /**
   * Stops tracking and flushes any partial-minute KPM to SQLite.
   */
  public stop(): void {
    if (this.currentSessionId) {
      // Record any remaining keystrokes in a scaled final block
      this.recordKPMMinutesegment(false)
    }

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    // Stop keyhook to kill background logger binary
    keystrokeCounter.stop()
    this.currentSessionId = null
    this.lastKpm = 0
    console.log('[KpmTracker] Stopped KPM tracking.')
  }

  /**
   * Calculates and saves KPM for the current segment.
   * If finalSegment is false, scales the count to minute rate.
   */
  private recordKPMMinutesegment(isFullMinute: boolean): void {
    if (!this.currentSessionId) return

    const now = Date.now()
    this.lastTickTime = now
    const elapsedMs = now - this.segmentStartTime
    const elapsedSeconds = elapsedMs / 1000

    const rawCount = keystrokeCounter.resetCount()
    this.segmentStartTime = now

    let kpm = 0
    if (isFullMinute) {
      kpm = rawCount
    } else {
      // Scale partial minute count to 60-second rate
      // Only scale if session was active for at least 3 seconds to avoid outlier spikes
      if (elapsedSeconds >= 3) {
        kpm = Math.round((rawCount / elapsedSeconds) * 60)
      } else {
        kpm = rawCount // fallback to raw count if stopped immediately
      }
    }

    try {
      // 1. Insert metric into SQLite
      insertKPM(this.currentSessionId, kpm)
      this.lastKpm = kpm
      
      // 2. Broadcast KPM to all renderer windows
      this.broadcastKpmUpdate(kpm)
      console.log(`[KpmTracker] Logged KPM: ${kpm} (raw: ${rawCount}, elapsed: ${elapsedSeconds.toFixed(1)}s)`)
    } catch (error) {
      console.error('[KpmTracker] Failed to record KPM segment:', error)
    }
  }

  /**
   * Broadcasts live KPM value over IPC.
   */
  private broadcastKpmUpdate(kpm: number): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('telemetry:kpmUpdate', kpm)
      }
    }
  }
}

// Export global singleton instance
export const kpmTracker = new KpmTracker()
