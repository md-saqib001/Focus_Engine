import { BrowserWindow } from 'electron'
import { telemetryPoller } from './telemetryPoller'
import { activityTimestampTracker } from './activityTimestampTracker'
import { getDatabase } from '../database/db'
import { logDistractionEvent } from '../database/distractionEventsRepository'

export class DistractionDetector {
  private sessionId: string | null = null
  private unsubPoller: (() => void) | null = null
  private idleIntervalId: NodeJS.Timeout | null = null

  // Sustained distraction tracking
  private continuousDistractionTicks = 0
  private isSustainedDistracted = false

  // Excessive switching tracking (rolling 2-minute window)
  private appSwitches: number[] = []
  private lastAppName = ''
  private lastSwitchCooldown = 0

  // Blacklist visit tracking
  private lastBlacklistedDomain = ''

  // Extended idle tracking
  private hasTriggeredIdle = false

  /**
   * Starts distraction event detection for the active session.
   */
  public start(sessionId: string): void {
    this.stop() // Clear existing states
    this.sessionId = sessionId

    // Reset trackers
    this.continuousDistractionTicks = 0
    this.isSustainedDistracted = false
    this.appSwitches = []
    this.lastAppName = ''
    this.lastSwitchCooldown = 0
    this.lastBlacklistedDomain = ''
    this.hasTriggeredIdle = false

    // Subscribe to poller ticks
    this.unsubPoller = telemetryPoller.onTick((info) => {
      this.evaluateTick(info)
    })

    // Poll for extended idle state every 1 second
    this.idleIntervalId = setInterval(() => {
      this.evaluateIdle()
    }, 1000)

    console.log(`[DistractionDetector] Detection started for session: ${sessionId}`)
  }

  /**
   * Stops distraction detection.
   */
  public stop(): void {
    if (this.unsubPoller) {
      this.unsubPoller()
      this.unsubPoller = null
    }
    if (this.idleIntervalId) {
      clearInterval(this.idleIntervalId)
      this.idleIntervalId = null
    }
    this.sessionId = null
    console.log('[DistractionDetector] Detection stopped.')
  }

  /**
   * Evaluates active window tick for switching, domain blacklist, and sustained distraction.
   */
  private evaluateTick(info: {
    appName: string
    windowTitle: string
    domain: string
    category: 'productive' | 'distraction' | 'neutral' | 'unknown'
  }): void {
    if (!this.sessionId) return

    const now = Date.now()

    // 1. Sustained Distraction Check
    if (info.category === 'distraction') {
      this.continuousDistractionTicks++
      if (this.continuousDistractionTicks >= 12 && !this.isSustainedDistracted) {
        // 12 ticks * 5s = 60s continuous distraction
        this.triggerEvent('sustained_distraction', {
          domain: info.domain || 'unknown',
          appName: info.appName,
          windowTitle: info.windowTitle
        })
        this.isSustainedDistracted = true
      }
    } else {
      this.continuousDistractionTicks = 0
      this.isSustainedDistracted = false
    }

    // 2. Excessive Switching Check
    if (this.lastAppName && this.lastAppName !== info.appName) {
      this.appSwitches.push(now)
    }
    this.lastAppName = info.appName

    // Keep switches only from the last 30 seconds (30,000 ms)
    this.appSwitches = this.appSwitches.filter((t) => t >= now - 30000)

    if (this.appSwitches.length >= 8 && now - this.lastSwitchCooldown > 30000) {
      this.triggerEvent('excessive_switching', {
        switchCount: this.appSwitches.length,
        timeframeSeconds: 30
      })
      this.lastSwitchCooldown = now
      // Reset switches to prevent immediate re-trigger
      this.appSwitches = []
    }

    // 3. Blacklist Visit Check
    if (info.domain) {
      if (info.domain !== this.lastBlacklistedDomain) {
        const db = getDatabase()
        const match = db
          .prepare('SELECT enabled FROM blocked_domains WHERE domain = ? AND enabled = 1')
          .get(info.domain) as { enabled: number } | undefined

        if (match) {
          this.triggerEvent('blacklist_visit', {
            domain: info.domain,
            appName: info.appName
          })
        }
        this.lastBlacklistedDomain = info.domain
      }
    } else {
      this.lastBlacklistedDomain = ''
    }
  }

  /**
   * Evaluates if user has gone idle beyond 180s.
   */
  private evaluateIdle(): void {
    if (!this.sessionId) return

    const idleSeconds = activityTimestampTracker.getIdleSeconds()

    if (idleSeconds > 180 && !this.hasTriggeredIdle) {
      this.triggerEvent('extended_idle', {
        idleSeconds
      })
      this.hasTriggeredIdle = true
    } else if (idleSeconds < 5) {
      // Reset trigger once user displays active keyboard or mouse movement
      this.hasTriggeredIdle = false
    }
  }

  /**
   * Helper to log, broadcast and trigger warning notification
   */
  private triggerEvent(eventType: string, eventData: any): void {
    if (!this.sessionId) return

    try {
      // 1. Log to database
      logDistractionEvent(this.sessionId, eventType, eventData)

      // 2. Broadcast live event to renderer windows
      const payload = {
        eventType,
        eventData,
        timestamp: Date.now()
      }
      
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('telemetry:distractionEvent', payload)
        }
      }
      console.log(`[DistractionDetector] Triggered & Logged: ${eventType}`, eventData)
    } catch (err) {
      console.error('[DistractionDetector] Failed to log/broadcast event:', err)
    }
  }
}

// Export singleton
export const distractionDetector = new DistractionDetector()
