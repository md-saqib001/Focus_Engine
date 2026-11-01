import { getDatabase } from './db'

export interface SessionRow {
  session_id: string
  session_mode: 'pomodoro' | 'standard'
  session_type: 'focus' | 'shortBreak' | 'longBreak' | null
  start_time: number
  end_time: number | null
  duration_planned_sec: number | null
  duration_actual_sec: number | null
  completed: number // 0 or 1 (SQLite doesn't have booleans)
  end_reason: string | null
  focus_score: number | null
  auto_paused_count: number
  pause_count: number
  created_at: number
  apps_killed?: number
}

/**
 * Saves a completed/terminated session to the database.
 * Volatile state is held in React; SQLite is only written to once when the session reaches
 * a terminal state (completed, abandoned, or force ended) to prevent database desync.
 * 
 * Enforces the Mode/Duration/Type contracts:
 *  - Pomodoro MUST have planned duration and session type
 *  - Standard MUST NOT have planned duration or session type
 */
export function saveSession(params: {
  sessionId: string
  mode: 'pomodoro' | 'standard'
  sessionType: 'focus' | 'shortBreak' | 'longBreak' | null
  startTime: number
  endTime: number
  durationPlannedSec: number | null
  durationActualSec: number
  completed: boolean
  endReason: 'auto_complete' | 'manual_stop' | 'abandoned' | 'force_ended'
  autoPausedCount?: number
  pauseCount?: number
}): SessionRow {
  const {
    sessionId,
    mode,
    sessionType,
    startTime,
    endTime,
    durationPlannedSec,
    durationActualSec,
    completed,
    endReason,
    autoPausedCount = 0,
    pauseCount = 0
  } = params

  // Validate mode contract
  if (mode === 'pomodoro') {
    if (durationPlannedSec === null || durationPlannedSec <= 0) {
      throw new Error(
        `[SessionRepository] Pomodoro session requires a positive durationPlannedSec, ` +
        `but received: ${durationPlannedSec}.`
      )
    }
    if (sessionType === null) {
      throw new Error(
        `[SessionRepository] Pomodoro session requires a sessionType, but received null.`
      )
    }
  } else if (mode === 'standard') {
    if (durationPlannedSec !== null) {
      throw new Error(
        `[SessionRepository] Standard session must NOT have a durationPlannedSec ` +
        `(received: ${durationPlannedSec}).`
      )
    }
    if (sessionType !== null && sessionType !== 'focus') {
      throw new Error(
        `[SessionRepository] Standard session sessionType must be null or 'focus' ` +
        `(received: ${sessionType}).`
      )
    }
  }

  const db = getDatabase()

  const stmt = db.prepare(`
    INSERT INTO sessions (
      session_id, session_mode, session_type, start_time, end_time,
      duration_planned_sec, duration_actual_sec, completed, end_reason, created_at,
      auto_paused_count, pause_count
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    sessionId,
    mode,
    sessionType,
    startTime,
    endTime,
    durationPlannedSec,
    durationActualSec,
    completed ? 1 : 0,
    endReason,
    startTime,
    autoPausedCount,
    pauseCount
  )

  return {
    session_id: sessionId,
    session_mode: mode,
    session_type: sessionType,
    start_time: startTime,
    end_time: endTime,
    duration_planned_sec: durationPlannedSec,
    duration_actual_sec: durationActualSec,
    completed: completed ? 1 : 0,
    end_reason: endReason,
    focus_score: null,
    auto_paused_count: autoPausedCount,
    pause_count: pauseCount,
    created_at: startTime
  }
}

/**
 * Retrieves all sessions, ordered by most recent first.
 */
export function getAllSessions(): SessionRow[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT s.*, COUNT(e.id) as apps_killed
    FROM sessions s
    LEFT JOIN app_kill_events e ON s.session_id = e.session_id
    GROUP BY s.session_id
    ORDER BY s.start_time DESC
  `)
  return stmt.all() as SessionRow[]
}

/**
 * Retrieves a single session by ID.
 */
export function getSessionById(sessionId: string): SessionRow | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT s.*, COUNT(e.id) as apps_killed
    FROM sessions s
    LEFT JOIN app_kill_events e ON s.session_id = e.session_id
    WHERE s.session_id = ?
    GROUP BY s.session_id
  `)
  return (stmt.get(sessionId) as SessionRow) || null
}

/**
 * Updates the focus_score for a completed session.
 */
export function updateSessionFocusScore(sessionId: string, focusScore: number): void {
  const db = getDatabase()
  db.prepare(`
    UPDATE sessions
    SET focus_score = ?
    WHERE session_id = ?
  `).run(focusScore, sessionId)
}

/**
 * Retrieves sessions within a date range (start_time between startMs and endMs).
 */
export function getSessionsInDateRange(startMs: number, endMs: number): SessionRow[] {
  const db = getDatabase()
  const stmt = db.prepare(
    `SELECT * FROM sessions WHERE start_time >= ? AND start_time <= ? ORDER BY start_time DESC`
  )
  return stmt.all(startMs, endMs) as SessionRow[]
}
