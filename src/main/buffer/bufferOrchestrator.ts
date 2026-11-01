import { FocusBuffer } from './focusBuffer'
import { mapCVToMultiplier } from './cvSignalMapper'
import { mapKPMToMultiplier } from './keyboardSignalMapper'
import { mapMouseToMultiplier } from './mouseSignalMapper'
import { mapWindowToMultiplier } from './windowSignalMapper'
import { calculatePenalty } from './distractionPenaltyCalculator'
import { pythonCVProcessManager } from '../cv/pythonProcessManager'
import { kpmTracker } from '../telemetry/kpmTracker'
import { telemetryPoller } from '../telemetry/telemetryPoller'
import { activityTimestampTracker } from '../telemetry/activityTimestampTracker'
import { settingsRepository } from '../database/settingsRepository'
import { bufferSnapshotsRepository } from '../database/bufferSnapshotsRepository'
import { bufferStateTransitionsRepository } from '../database/bufferStateTransitionsRepository'
import { getEventsSince } from '../database/distractionEventsRepository'
import { BufferStateMachine } from './bufferStateMachine'
import { BrowserWindow } from 'electron'
import { livePredictionPoller } from './livePredictionPoller'

// How many consecutive seconds of inattention before CV starts decaying the buffer
const CV_GRACE_PERIOD_SEC = 10

class BufferOrchestrator {
  private buffer: FocusBuffer | null = null
  private intervalId: NodeJS.Timeout | null = null
  private sessionId: string | null = null
  private secondsElapsed: number = 0
  private currentSignals = { cv: 1.0, keyboard: 1.0, mouse: 1.0, window: 1.0 }
  private lastEventQueryTime: number = Date.now()
  private processedEventIds = new Set<number>()
  private stateMachine: BufferStateMachine | null = null
  /** Consecutive seconds where CV attention is below optimal (< 1.0). Resets on focus. */
  private cvLookAwaySeconds: number = 0
  private sessionMode: 'pomodoro' | 'standard' = 'standard'
  private autoPausedCount: number = 0
  private manualPausedCount: number = 0
  private standardForceEndTimeoutId: NodeJS.Timeout | null = null

  /**
   * Starts the buffer tracking loop for a session.
   * Runs at a 1-second tick interval.
   */
  public start(sessionId: string, mode: 'pomodoro' | 'standard' = 'standard'): void {
    this.stop() // Clear any existing runner
    this.sessionId = sessionId
    this.sessionMode = mode
    this.autoPausedCount = 0
    this.manualPausedCount = 0
    this.buffer = new FocusBuffer()
    this.secondsElapsed = 0
    this.cvLookAwaySeconds = 0
    this.currentSignals = { cv: 1.0, keyboard: 1.0, mouse: 1.0, window: 1.0 }
    this.lastEventQueryTime = Date.now()
    this.processedEventIds.clear()
    this.stateMachine = new BufferStateMachine(100)

    try {
      // Record initial state in transitions table
      bufferStateTransitionsRepository.insertTransition(sessionId, 'focused', Date.now())
    } catch (err) {
      console.error('[BufferOrchestrator] Failed to log initial state transition:', err)
    }

    console.log(`[BufferOrchestrator] Starting focus buffer loop for session ${sessionId} in ${mode} mode...`)

    livePredictionPoller.start(sessionId)

    this.intervalId = setInterval(() => {
      this.tick()
    }, 1000)
  }

  /**
   * Stops the buffer tracking loop.
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    if (this.standardForceEndTimeoutId) {
      clearTimeout(this.standardForceEndTimeoutId)
      this.standardForceEndTimeoutId = null
    }

    if (this.sessionId) {
      try {
        bufferStateTransitionsRepository.closeOutTransition(this.sessionId, Date.now())
      } catch (err) {
        console.error('[BufferOrchestrator] Failed to close active state transition on stop:', err)
      }
    }

    livePredictionPoller.stop()

    this.buffer = null
    this.sessionId = null
    this.cvLookAwaySeconds = 0
    this.currentSignals = { cv: 1.0, keyboard: 1.0, mouse: 1.0, window: 1.0 }
    this.lastEventQueryTime = Date.now()
    this.processedEventIds.clear()
    this.stateMachine = null
    console.log('[BufferOrchestrator] Stopped focus buffer tracking loop.')
  }

  /**
   * Internal tick running once per second.
   * Resolves CV data, computes multipliers, updates the buffer,
   * writes snapshots to database once per minute, and broadcasts updates.
   */
  private tick(): void {
    if (!this.buffer || !this.sessionId) return

    this.secondsElapsed++

    const isWarmup = this.secondsElapsed <= 10
    const cvEnabled = settingsRepository.getCVEnabled()
    const cvRecord = pythonCVProcessManager.getLastRecord()

    // 1. Resolve CV Multiplier with 10-second look-away grace period.
    // The buffer only starts decaying from CV signal after CV_GRACE_PERIOD_SEC
    // consecutive seconds of inattention. A single glance away is fully forgiven.
    let cvMult = 1.0
    if (!isWarmup && cvEnabled) {
      if (cvRecord) {
        const rawCVMult = mapCVToMultiplier(
          cvRecord.smoothed_attention_score,
          cvRecord.face_present
        )
        if (rawCVMult < 1.0) {
          // Attention is not optimal — count up the look-away timer
          this.cvLookAwaySeconds++
          if (this.cvLookAwaySeconds > CV_GRACE_PERIOD_SEC) {
            // Grace period expired — apply real multiplier decay
            cvMult = rawCVMult
          } else {
            // Still within grace — hold at 1.0, don't penalize yet
            cvMult = 1.0
          }
        } else {
          // Back to full attention — reset grace counter immediately
          this.cvLookAwaySeconds = 0
          cvMult = 1.0
        }
      } else {
        cvMult = 1.0
      }
    } else {
      cvMult = 1.0
    }

    // 2. Resolve Active Window & Domain Multiplier
    const lastWindow = telemetryPoller.getLastActiveWindow()
    const windowCategory = lastWindow?.category ?? 'unknown'
    const windowDomain = lastWindow?.domain ?? ''
    const windowMult = isWarmup ? 1.0 : mapWindowToMultiplier(windowCategory, windowDomain)

    // 3. Resolve Keyboard Multiplier (KPM has granularity mismatch, which is expected)
    const kpm = kpmTracker.getLastKPM()
    let keyboardMult = isWarmup ? 1.0 : mapKPMToMultiplier(kpm, windowCategory)

    // 4. Resolve Mouse Multiplier (Idle seconds are fine-grained)
    const idleDurationSec = activityTimestampTracker.getIdleSeconds()
    let mouseMult = isWarmup ? 1.0 : mapMouseToMultiplier(idleDurationSec, windowCategory)

    // === INTEGRATED FOCUS LOGIC OVERRIDES ===

    if (!isWarmup) {
      // Rule A: CV Override for Reading / Thinking
      // If user has optimal attention (CV = 1.0), do not apply idle keyboard/mouse penalties
      if (cvMult === 1.0) {
        keyboardMult = 1.0
        mouseMult = 1.0
      }

      // Rule B: Combined Activity Multiplier
      // If actively typing (KPM >= 5), mouse is not penalized
      if (kpm >= 5) {
        mouseMult = 1.0
      }
      // If user interacted within last 20 seconds, keyboard is not penalized
      if (idleDurationSec < 20) {
        keyboardMult = 1.0
      }
    }

    // 5. Assemble multipliers
    const multipliers = {
      cv: cvMult,
      keyboard: keyboardMult,
      mouse: mouseMult,
      window: windowMult
    }

    // 6. Query new distraction events since last tick and compute subtractive penalty
    const queryTime = this.lastEventQueryTime
    const events = getEventsSince(this.sessionId, queryTime).filter(
      (e) => !this.processedEventIds.has(e.id)
    )
    for (const e of events) {
      this.processedEventIds.add(e.id)
    }
    if (events.length > 0) {
      this.lastEventQueryTime = Math.max(...events.map((e) => e.timestamp))
    }
    const penalty = isWarmup ? 0 : calculatePenalty(events)

    this.currentSignals = { ...multipliers }

    // 7. Update the buffer
    const value = this.buffer.update(multipliers, penalty)
    const state = isWarmup ? 'focused' : this.buffer.getState()

    // check for auto-pause triggers (buffer value < 10)
    if (!isWarmup && value < 10) {
      if (this.sessionMode === 'standard' && this.autoPausedCount >= 1) {
        this.triggerForceEnd('sustained_misbehavior')
        return
      } else {
        this.triggerAutoPause()
        return
      }
    }

    // --- Formalize State Transitions ---
    if (this.stateMachine && !isWarmup) {
      const transitionResult = this.stateMachine.evaluate(value)
      if (transitionResult.changed && transitionResult.previousState) {
        try {
          // Close out the old active transition in DB
          bufferStateTransitionsRepository.closeOutTransition(this.sessionId, Date.now())
          // Open the new transition in DB
          bufferStateTransitionsRepository.insertTransition(
            this.sessionId,
            transitionResult.state,
            Date.now()
          )

          console.log(
            `[BufferOrchestrator] FocusState transitioned: ${transitionResult.previousState} -> ${transitionResult.state} (after ${Math.round(transitionResult.durationInPreviousState / 1000)}s)`
          )

          // Broadcast stateChanged event immediately to renderer
          const windows = BrowserWindow.getAllWindows()
          for (const win of windows) {
            if (!win.isDestroyed()) {
              win.webContents.send('buffer:stateChanged', {
                previousState: transitionResult.previousState,
                newState: transitionResult.state,
                durationInPreviousState: transitionResult.durationInPreviousState
              })
            }
          }
        } catch (err) {
          console.error('[BufferOrchestrator] Failed to record state transition in database:', err)
        }
      }
    }

    // 8. Save snapshots to SQLite once per minute (every 60 seconds)
    if (this.secondsElapsed > 0 && this.secondsElapsed % 60 === 0) {
      try {
        bufferSnapshotsRepository.insertSnapshot(this.sessionId, value, Date.now())
        console.log(
          `[BufferOrchestrator] Persisted focus buffer snapshot for session ${this.sessionId}: ${value}%`
        )
      } catch (err) {
        console.error('[BufferOrchestrator] Failed to persist focus buffer snapshot:', err)
      }
    }

    // 9. Broadcast updates immediately to all open renderer windows
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('buffer:update', {
          value,
          state,
          history: this.buffer.getHistory(),
          signals: this.currentSignals,
          isWarmup,
          autoPausedCount: this.autoPausedCount
        })
      }
    }
  }

  private triggerAutoPause(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.autoPausedCount++
    console.log(`[BufferOrchestrator] Focus buffer depleted below 10%. Auto-pausing session. Count: ${this.autoPausedCount}`)

    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('session:autoPause', { reason: 'buffer_depleted' })
      }
    }

    if (this.sessionMode === 'standard') {
      // Start 2-minute countdown (120 seconds) to force-end if not resumed
      this.standardForceEndTimeoutId = setTimeout(() => {
        this.triggerForceEnd('sustained_misbehavior')
      }, 120000)
    }
  }

  private triggerForceEnd(reason: string): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    if (this.standardForceEndTimeoutId) {
      clearTimeout(this.standardForceEndTimeoutId)
      this.standardForceEndTimeoutId = null
    }

    console.log(`[BufferOrchestrator] Force-ending standard session due to: ${reason}`)

    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('session:forceEnd', { reason })
      }
    }
  }

  public pause(): void {
    this.manualPausedCount++
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    console.log('[BufferOrchestrator] Session manually paused. Halting buffer ticks.')
  }

  public resume(): void {
    if (!this.buffer || !this.sessionId) return
    this.buffer.setValue(50.0) // Reset buffer to 50 ("second chance")
    
    if (this.standardForceEndTimeoutId) {
      clearTimeout(this.standardForceEndTimeoutId)
      this.standardForceEndTimeoutId = null
    }

    if (this.stateMachine) {
      this.stateMachine.evaluate(50.0)
    }

    // Restart the interval if it was stopped
    if (!this.intervalId) {
      this.intervalId = setInterval(() => {
        this.tick()
      }, 1000)
    }

    console.log('[BufferOrchestrator] Session manually resumed. Focus buffer reset to 50.0%')
  }

  public getAutoPausedCount(): number {
    return this.autoPausedCount
  }

  public getPauseCount(): number {
    return this.autoPausedCount + this.manualPausedCount
  }

  public getSessionId(): string | null {
    return this.sessionId
  }

  public getSessionMode(): 'pomodoro' | 'standard' {
    return this.sessionMode
  }

  public getSecondsElapsed(): number {
    return this.secondsElapsed
  }

  public getHistory(): any[] {
    return this.buffer ? this.buffer.getHistory() : []
  }

  public getCurrentValue(): number {
    return this.buffer ? this.buffer.getCurrentValue() : 100
  }

  public getState(): string {
    return this.buffer ? this.buffer.getState() : 'focused'
  }

  public getCurrentSignals(): typeof this.currentSignals {
    return { ...this.currentSignals }
  }
}

export const bufferOrchestrator = new BufferOrchestrator()
