import { BrowserWindow } from 'electron'
import { telemetryPoller } from './telemetryPoller'
import { kpmTracker } from './kpmTracker'
import { mouseMetricsTracker } from './mouseMetricsTracker'

export class TelemetryHealthCheck {
  private intervalId: NodeJS.Timeout | null = null
  private currentSessionId: string | null = null

  /**
   * Starts periodic health checks for telemetry pollers (runs every 30s).
   */
  public start(sessionId: string): void {
    this.stop()
    this.currentSessionId = sessionId

    this.intervalId = setInterval(() => {
      this.checkHealth()
    }, 3000) // Poll more frequently internally for prompt reaction (3s) but check relative ages

    console.log(`[TelemetryHealthCheck] Started periodic audits for session: ${sessionId}`)
  }

  /**
   * Stops periodic health audits.
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.currentSessionId = null
  }

  /**
   * Verifies if each tracker/poller has written ticks within their respective tolerances.
   */
  private checkHealth(): void {
    if (!this.currentSessionId) return

    const now = Date.now()

    // Tolerance thresholds
    const windowAge = now - telemetryPoller.getLastTickTime()
    const kpmAge = now - kpmTracker.getLastTickTime()
    const mouseAge = now - mouseMetricsTracker.getLastTickTime()

    // Expected: window = 5s (dead if >15s), kpm/mouse = 60s (dead if >150s)
    const windowAlive = windowAge <= 15000
    const kpmAlive = kpmAge <= 150000
    const mouseAlive = mouseAge <= 150000

    const isHealthy = windowAlive && kpmAlive && mouseAlive

    if (!isHealthy) {
      console.warn(`[TelemetryHealthCheck] Detected unhealthy poller! windowAge=${windowAge}ms, kpmAge=${kpmAge}ms, mouseAge=${mouseAge}ms`)
      this.broadcastWarning({
        window: windowAlive,
        kpm: kpmAlive,
        mouse: mouseAlive
      })
    } else {
      // Broadcast healthy state to clear warnings
      this.broadcastWarning({
        window: true,
        kpm: true,
        mouse: true
      })
    }
  }

  private broadcastWarning(status: { window: boolean; kpm: boolean; mouse: boolean }): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('telemetry:healthWarning', status)
      }
    }
  }
}

export const telemetryHealthCheck = new TelemetryHealthCheck()
