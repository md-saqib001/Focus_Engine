import { BrowserWindow } from 'electron'
import { getDatabase } from '../database/db'
import { bufferOrchestrator } from './bufferOrchestrator'
import { predictionService } from '../ml/predictionService'
import { bufferStateTransitionsRepository } from '../database/bufferStateTransitionsRepository'

class LivePredictionPoller {
  private intervalId: NodeJS.Timeout | null = null
  private sessionId: string | null = null

  public start(sessionId: string): void {
    this.stop()
    this.sessionId = sessionId
    console.log(`[LivePredictionPoller] Starting ML prediction poller for session ${sessionId}...`)
    
    // Poll every 60 seconds (60000ms)
    this.intervalId = setInterval(() => {
      this.poll()
    }, 60000)
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.sessionId = null
  }

  private async poll(): Promise<void> {
    if (!this.sessionId) return
    
    const activeSessionId = bufferOrchestrator.getSessionId()
    if (activeSessionId !== this.sessionId) {
      this.stop()
      return
    }

    try {
      const db = getDatabase()
      const elapsedSeconds = bufferOrchestrator.getSecondsElapsed()
      if (elapsedSeconds <= 0) return

      const currentBuffer = bufferOrchestrator.getCurrentValue()

      // 1. Buffer Snapshots Stats
      const snapshots = db.prepare(`
        SELECT value FROM buffer_snapshots
        WHERE session_id = ?
      `).all(this.sessionId) as { value: number }[]

      let avg_buffer = currentBuffer
      let min_buffer = currentBuffer
      let max_buffer = currentBuffer

      if (snapshots.length > 0) {
        const vals = snapshots.map((s) => s.value)
        avg_buffer = vals.reduce((a, b) => a + b, 0) / vals.length
        min_buffer = Math.min(...vals)
        max_buffer = Math.max(...vals)
      }

      // 2. Focus Time from transitions (handling active transition)
      const transitions = bufferStateTransitionsRepository.getForSession(this.sessionId)
      let focusTimeMs = 0
      for (const t of transitions) {
        let dur = t.duration || 0
        if (t.end_time === null) {
          dur = Date.now() - t.start_time
        }
        if (t.state === 'focused') {
          focusTimeMs += dur
        }
      }
      const focus_time = focusTimeMs / 1000.0

      // 3. Attention Time from cv_metrics
      const cvStats = db.prepare(`
        SELECT COUNT(*) as total, SUM(face_present) as present
        FROM cv_metrics
        WHERE session_id = ?
      `).get(this.sessionId) as { total: number; present: number } | undefined

      const cvRatio = cvStats && cvStats.total > 0 ? cvStats.present / cvStats.total : 1.0
      const attention_time = cvRatio * elapsedSeconds

      // 4. Avg KPM
      const kpmStats = db.prepare(`
        SELECT AVG(kpm) as avg_kpm
        FROM keyboard_metrics
        WHERE session_id = ?
      `).get(this.sessionId) as { avg_kpm: number | null } | undefined
      const avg_kpm = kpmStats?.avg_kpm ?? 0.0

      // 5. Mouse Activity
      const mouseStats = db.prepare(`
        SELECT SUM(click_count + movement_count) as act
        FROM mouse_metrics
        WHERE session_id = ?
      `).get(this.sessionId) as { act: number | null } | undefined
      const mouse_activity = mouseStats?.act ?? 0

      // 6. Pause Count
      const pause_count = bufferOrchestrator.getPauseCount()

      // 7. App Switches
      const switchStats = db.prepare(`
        SELECT COUNT(*) as cnt
        FROM window_focus
        WHERE session_id = ?
      `).get(this.sessionId) as { cnt: number } | undefined
      const app_switches = switchStats?.cnt ?? 0

      // 8. Mode & Temporal
      const mode = bufferOrchestrator.getSessionMode()
      const session_mode_is_standard = mode === 'standard' ? 1 : 0
      
      const startTime = Date.now() - elapsedSeconds * 1000
      const startDate = new Date(startTime)
      const hour_of_day = startDate.getHours()
      const day_of_week = startDate.getDay()

      // Compile feature vector dictionary
      const features = {
        avg_buffer: round(avg_buffer, 2),
        min_buffer: round(min_buffer, 2),
        max_buffer: round(max_buffer, 2),
        focus_time: round(focus_time, 2),
        attention_time: round(attention_time, 2),
        avg_kpm: round(avg_kpm, 2),
        mouse_activity,
        pause_count,
        app_switches,
        session_duration: elapsedSeconds,
        hour_of_day,
        day_of_week,
        session_mode_is_standard
      }

      console.log(`[LivePredictionPoller] Running prediction for session ${this.sessionId} at ${elapsedSeconds}s...`)
      
      const result = await predictionService.getPrediction(features)
      if (result.success && result.focus_score !== undefined && result.is_anomaly !== undefined) {
        console.log(`[LivePredictionPoller] ML Prediction: score=${result.focus_score}, isAnomaly=${result.is_anomaly}`)
        
        // Broadcast prediction result to renderer
        const windows = BrowserWindow.getAllWindows()
        for (const win of windows) {
          if (!win.isDestroyed()) {
            win.webContents.send('ml:prediction', {
              focusScore: result.focus_score,
              isAnomaly: result.is_anomaly
            })
          }
        }
      } else {
        console.warn('[LivePredictionPoller] Prediction returned failure:', result.error)
      }

    } catch (err) {
      console.error('[LivePredictionPoller] Poller execution failed:', err)
    }
  }
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

export const livePredictionPoller = new LivePredictionPoller()
