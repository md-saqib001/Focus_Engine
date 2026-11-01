import { getDatabase } from './db'

export interface MouseMetricsRow {
  id: number
  session_id: string
  click_count: number
  movement_count: number
  idle_duration: number
  timestamp: number
}

/**
 * Inserts rolling mouse activity metrics into the database.
 */
export function insertMouseMetrics(
  sessionId: string,
  clicks: number,
  movements: number,
  idleDuration: number
): void {
  const db = getDatabase()
  db.prepare(`
    INSERT INTO mouse_metrics (session_id, click_count, movement_count, idle_duration, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, clicks, movements, idleDuration, Date.now())
}

/**
 * Retrieves rolling mouse metrics for a given session.
 */
export function getForSession(sessionId: string): MouseMetricsRow[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT id, session_id, click_count, movement_count, idle_duration, timestamp
    FROM mouse_metrics
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `).all(sessionId) as MouseMetricsRow[]
}

/**
 * Retrieves the maximum continuous idle duration (in seconds) recorded in the session.
 */
export function getMaxIdleDuration(sessionId: string): number {
  const db = getDatabase()
  const res = db.prepare(`
    SELECT MAX(idle_duration) as max_idle
    FROM mouse_metrics
    WHERE session_id = ?
  `).get(sessionId) as { max_idle: number | null }

  return res && res.max_idle !== null ? res.max_idle : 0
}
