import { getDatabase } from './db'
import { getSessionById } from './sessionRepository'
import { getCategoryBreakdown } from './windowFocusRepository'
import { calculateFocusScore, FocusScoreComponents } from '../buffer/focusScoreCalculator'

export interface TelemetrySummary {
  sessionId: string
  sessionMode: 'pomodoro' | 'standard'
  sessionType: 'focus' | 'shortBreak' | 'longBreak' | null
  durationActualSec: number
  completed: boolean
  endReason: string | null
  startTime: number
  endTime: number | null
  
  // Aggregated Stats
  categoryBreakdown: { [category: string]: number }
  avgKpm: number
  maxKpm: number
  totalClicks: number
  movementEvents: number
  maxIdleDuration: number
  mostUsedApp: string | null
  mostDistractingDomain: string | null
  totalPauses: number
  distractionsAttempted: number
  focusScore: number | null
  focusScoreComponents: FocusScoreComponents | null
}

/**
 * Consolidates telemetry metrics across window focus, keyboard, and mouse logs for a session.
 */
export function getSessionTelemetrySummary(sessionId: string): TelemetrySummary | null {
  const db = getDatabase()
  const session = getSessionById(sessionId)
  if (!session) return null

  // 1. Get Category Breakdown
  const categories = getCategoryBreakdown(sessionId)
  const categoryMap: { [key: string]: number } = {
    productive: 0,
    distraction: 0,
    neutral: 0,
    unknown: 0
  }
  for (const c of categories) {
    categoryMap[c.category || 'unknown'] = c.focus_count
  }

  // 2. Keyboard metrics (KPM)
  const kpmStats = db.prepare(`
    SELECT AVG(kpm) as avg_kpm, MAX(kpm) as max_kpm
    FROM keyboard_metrics
    WHERE session_id = ?
  `).get(sessionId) as { avg_kpm: number | null, max_kpm: number | null }

  const avgKpm = kpmStats && kpmStats.avg_kpm !== null ? Math.round(kpmStats.avg_kpm) : 0
  const maxKpm = kpmStats && kpmStats.max_kpm !== null ? kpmStats.max_kpm : 0

  // 3. Mouse metrics
  const mouseStats = db.prepare(`
    SELECT SUM(click_count) as total_clicks, SUM(movement_count) as total_movements, MAX(idle_duration) as max_idle
    FROM mouse_metrics
    WHERE session_id = ?
  `).get(sessionId) as { total_clicks: number | null, total_movements: number | null, max_idle: number | null }

  const totalClicks = mouseStats && mouseStats.total_clicks !== null ? mouseStats.total_clicks : 0
  const movementEvents = mouseStats && mouseStats.total_movements !== null ? mouseStats.total_movements : 0
  const maxIdleDuration = mouseStats && mouseStats.max_idle !== null ? mouseStats.max_idle : 0

  // 4. Most used app
  const appStats = db.prepare(`
    SELECT app_name, COUNT(*) as count
    FROM window_focus
    WHERE session_id = ?
    GROUP BY app_name
    ORDER BY count DESC
    LIMIT 1
  `).get(sessionId) as { app_name: string, count: number } | null
  const mostUsedApp = appStats ? appStats.app_name : null

  // 5. Most distracting domain
  const distractingDomainStats = db.prepare(`
    SELECT domain, COUNT(*) as count
    FROM window_focus
    WHERE session_id = ? AND category = 'distraction'
    GROUP BY domain
    ORDER BY count DESC
    LIMIT 1
  `).get(sessionId) as { domain: string, count: number } | null
  const mostDistractingDomain = distractingDomainStats ? distractingDomainStats.domain : null

  // 6. Pause Events
  const pauseStats = db.prepare(`
    SELECT COUNT(*) as manual_pauses
    FROM buffer_state_transitions
    WHERE session_id = ? AND state = 'PAUSED'
  `).get(sessionId) as { manual_pauses: number } | undefined
  const totalPauses = (session.auto_paused_count || 0) + (pauseStats?.manual_pauses || 0)

  // 7. Distractions Attempted
  const focusRows = db.prepare(`
    SELECT category
    FROM window_focus
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `).all(sessionId) as { category: string }[]

  let distractionSwitches = 0
  let prevCategory = ''
  for (const row of focusRows) {
    if (row.category === 'distraction' && prevCategory !== 'distraction') {
      distractionSwitches++
    }
    prevCategory = row.category || ''
  }
  const appsKilledCount = session.apps_killed || 0
  const distractionsAttempted = appsKilledCount + distractionSwitches

  // 8. Focus Score Components
  const focusScoreComponents = calculateFocusScore(sessionId)
  const focusScore = focusScoreComponents ? focusScoreComponents.finalScore : null

  return {
    sessionId: session.session_id,
    sessionMode: session.session_mode,
    sessionType: session.session_type,
    durationActualSec: session.duration_actual_sec || 0,
    completed: session.completed === 1,
    endReason: session.end_reason,
    startTime: session.start_time,
    endTime: session.end_time,
    categoryBreakdown: categoryMap,
    avgKpm,
    maxKpm,
    totalClicks,
    movementEvents,
    maxIdleDuration,
    mostUsedApp,
    mostDistractingDomain,
    totalPauses,
    distractionsAttempted,
    focusScore,
    focusScoreComponents
  }
}
