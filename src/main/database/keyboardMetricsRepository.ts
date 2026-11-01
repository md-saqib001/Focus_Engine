import { getDatabase } from './db'

export interface KeyboardMetricsRow {
  id: number
  session_id: string
  kpm: number
  timestamp: number
}

/**
 * Inserts a rolling 60-second KPM measurement into the database.
 */
export function insertKPM(sessionId: string, kpm: number): void {
  const db = getDatabase()
  db.prepare(`
    INSERT INTO keyboard_metrics (session_id, kpm, timestamp)
    VALUES (?, ?, ?)
  `).run(sessionId, kpm, Date.now())
}

/**
 * Retrieves all KPM records for a given focus session.
 */
export function getForSession(sessionId: string): KeyboardMetricsRow[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT id, session_id, kpm, timestamp
    FROM keyboard_metrics
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `).all(sessionId) as KeyboardMetricsRow[]
}

/**
 * Retrieves the average KPM score for a focus session.
 * Returns 0 if no records exist.
 */
export function getAverageKPM(sessionId: string): number {
  const db = getDatabase()
  const res = db.prepare(`
    SELECT AVG(kpm) as avg_kpm
    FROM keyboard_metrics
    WHERE session_id = ?
  `).get(sessionId) as { avg_kpm: number | null }

  return res && res.avg_kpm !== null ? Math.round(res.avg_kpm) : 0
}

/**
 * Retrieves the maximum and minimum KPM records for a session.
 */
export function getMaxMinKPM(sessionId: string): { maxKpm: number; minKpm: number } {
  const db = getDatabase()
  const res = db.prepare(`
    SELECT MAX(kpm) as max_kpm, MIN(kpm) as min_kpm
    FROM keyboard_metrics
    WHERE session_id = ?
  `).get(sessionId) as { max_kpm: number | null; min_kpm: number | null }

  return {
    maxKpm: res && res.max_kpm !== null ? res.max_kpm : 0,
    minKpm: res && res.min_kpm !== null ? res.min_kpm : 0
  }
}
