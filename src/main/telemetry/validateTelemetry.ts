import { getDatabase } from '../database/db'
import { getSessionById } from '../database/sessionRepository'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface BulkValidationSummary {
  totalSessionsAudited: number
  invalidSessions: number
  totalErrors: number
  totalWarnings: number
  orphanedSessionsCount: number
  results: {
    sessionId: string
    dateLabel: string
    isValid: boolean
    errors: string[]
    warnings: string[]
  }[]
}

/**
 * Validates the telemetry integrity of a completed session.
 */
export function validateSession(sessionId: string): ValidationResult {
  const db = getDatabase()
  const errors: string[] = []
  const warnings: string[] = []

  const session = getSessionById(sessionId)
  if (!session) {
    return {
      isValid: false,
      errors: [`Orphaned Telemetry Error: Session ID ${sessionId} has logged records but does not exist in the main sessions table.`],
      warnings: []
    }
  }

  const durationSec = session.duration_actual_sec || 0

  // 1. Check window_focus records count vs actual session duration (20% tolerance)
  const focusCount = (db.prepare(`
    SELECT COUNT(*) as count FROM window_focus WHERE session_id = ?
  `).get(sessionId) as { count: number }).count

  if (durationSec > 10) {
    const expected = Math.floor(durationSec / 5)
    if (expected > 0) {
      const diff = Math.abs(focusCount - expected)
      const tolerance = expected * 0.2
      if (diff > tolerance) {
        warnings.push(
          `Validation Warning: Captured ${focusCount} window ticks but expected ~${expected} based on ${durationSec}s duration (out of 20% tolerance).`
        )
      }
    }
  } else if (durationSec > 30 && focusCount === 0) {
    errors.push(`Validation Error: Session duration is ${durationSec}s but no window focus ticks were captured.`)
  }

  // 2. Check for KPM gaps > 2 minutes (120 seconds) and check for impossible KPM > 400
  const kpmRecords = db.prepare(`
    SELECT timestamp, kpm FROM keyboard_metrics WHERE session_id = ? ORDER BY timestamp ASC
  `).all(sessionId) as { timestamp: number; kpm: number }[]

  let maxKpm = 0
  for (let i = 0; i < kpmRecords.length; i++) {
    const current = kpmRecords[i]
    if (current.kpm > maxKpm) maxKpm = current.kpm

    if (i > 0) {
      const gapMs = current.timestamp - kpmRecords[i - 1].timestamp
      const gapSec = gapMs / 1000
      if (gapSec > 120) {
        warnings.push(`Validation Warning: KPM gap of ${Math.round(gapSec)}s detected between keystroke intervals.`)
      }
    }
  }

  if (maxKpm > 400) {
    errors.push(`Validation Error: Keystrokes per minute exceeds physical maximum limit (KPM: ${maxKpm} > 400).`)
  }

  // 3. Check for negative values and check if idle_duration exceeds session duration
  const mouseStats = db.prepare(`
    SELECT 
      MAX(idle_duration) as max_idle, 
      MIN(idle_duration) as min_idle,
      MIN(click_count) as min_clicks,
      MIN(movement_count) as min_movements
    FROM mouse_metrics 
    WHERE session_id = ?
  `).get(sessionId) as {
    max_idle: number | null
    min_idle: number | null
    min_clicks: number | null
    min_movements: number | null
  }

  const maxIdle = mouseStats && mouseStats.max_idle !== null ? mouseStats.max_idle : 0
  const minIdle = mouseStats && mouseStats.min_idle !== null ? mouseStats.min_idle : 0
  const minClicks = mouseStats && mouseStats.min_clicks !== null ? mouseStats.min_clicks : 0
  const minMovements = mouseStats && mouseStats.min_movements !== null ? mouseStats.min_movements : 0

  if (maxIdle > durationSec) {
    errors.push(`Validation Error: Maximum idle duration (${maxIdle}s) exceeds the actual session duration (${durationSec}s).`)
  }

  if (minIdle < 0 || minClicks < 0 || minMovements < 0) {
    errors.push(`Validation Error: Found negative value in mouse metrics (idle: ${minIdle}s, clicks: ${minClicks}, movements: ${minMovements}).`)
  }

  // 4. Check for duplicate timestamps in window_focus, keyboard_metrics, and mouse_metrics
  const dupFocus = db.prepare(`
    SELECT timestamp, COUNT(*) as count FROM window_focus WHERE session_id = ? GROUP BY timestamp HAVING count > 1
  `).all(sessionId) as { timestamp: number; count: number }[]

  const dupKpm = db.prepare(`
    SELECT timestamp, COUNT(*) as count FROM keyboard_metrics WHERE session_id = ? GROUP BY timestamp HAVING count > 1
  `).all(sessionId) as { timestamp: number; count: number }[]

  const dupMouse = db.prepare(`
    SELECT timestamp, COUNT(*) as count FROM mouse_metrics WHERE session_id = ? GROUP BY timestamp HAVING count > 1
  `).all(sessionId) as { timestamp: number; count: number }[]

  if (dupFocus.length > 0) {
    errors.push(`Validation Error: Found ${dupFocus.length} duplicate timestamp entries in window_focus table.`)
  }
  if (dupKpm.length > 0) {
    errors.push(`Validation Error: Found ${dupKpm.length} duplicate timestamp entries in keyboard_metrics table.`)
  }
  if (dupMouse.length > 0) {
    errors.push(`Validation Error: Found ${dupMouse.length} duplicate timestamp entries in mouse_metrics table.`)
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Runs bulk telemetry validation across all sessions logged in the database.
 */
export function validateAllSessions(): BulkValidationSummary {
  const db = getDatabase()

  // 1. Gather all unique session IDs across the entire database
  const sessionIdsSet = new Set<string>()

  // From sessions table
  const sessionsRows = db.prepare('SELECT id FROM sessions').all() as { id: string }[]
  sessionsRows.forEach((r) => sessionIdsSet.add(r.id))

  // From telemetry tables (detect potential orphans)
  const focusRows = db.prepare('SELECT DISTINCT session_id FROM window_focus').all() as { session_id: string }[]
  focusRows.forEach((r) => sessionIdsSet.add(r.session_id))

  const kpmRows = db.prepare('SELECT DISTINCT session_id FROM keyboard_metrics').all() as { session_id: string }[]
  kpmRows.forEach((r) => sessionIdsSet.add(r.session_id))

  const mouseRows = db.prepare('SELECT DISTINCT session_id FROM mouse_metrics').all() as { session_id: string }[]
  mouseRows.forEach((r) => sessionIdsSet.add(r.session_id))

  const distRows = db.prepare('SELECT DISTINCT session_id FROM distraction_events').all() as { session_id: string }[]
  distRows.forEach((r) => sessionIdsSet.add(r.session_id))

  const allSessionIds = Array.from(sessionIdsSet)
  
  let invalidSessions = 0
  let totalErrors = 0
  let totalWarnings = 0
  let orphanedSessionsCount = 0

  const results: BulkValidationSummary['results'] = []

  for (const id of allSessionIds) {
    const session = getSessionById(id)
    const result = validateSession(id)

    if (!session) {
      orphanedSessionsCount++
    }

    if (!result.isValid) {
      invalidSessions++
    }

    totalErrors += result.errors.length
    totalWarnings += result.warnings.length

    let dateLabel = 'Unknown Date'
    if (session) {
      dateLabel = new Date(session.start_time).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) + ` (${session.session_type || 'standard'})`
    } else {
      dateLabel = `Orphaned [${id.substring(0, 8)}]`
    }

    results.push({
      sessionId: id,
      dateLabel,
      isValid: result.isValid,
      errors: result.errors,
      warnings: result.warnings
    })
  }

  return {
    totalSessionsAudited: allSessionIds.length,
    invalidSessions,
    totalErrors,
    totalWarnings,
    orphanedSessionsCount,
    results
  }
}
