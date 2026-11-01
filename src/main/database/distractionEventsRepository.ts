import { getDatabase } from './db'

export interface DistractionEventRow {
  id: number
  session_id: string
  event_type: 'sustained_distraction' | 'excessive_switching' | 'blacklist_visit' | 'extended_idle'
  event_data: string // JSON payload
  timestamp: number
}

/**
 * Logs a discrete distraction event to the database.
 */
export function logDistractionEvent(
  sessionId: string,
  eventType: string,
  eventData: any
): void {
  const db = getDatabase()
  db.prepare(`
    INSERT INTO distraction_events (session_id, event_type, event_data, timestamp)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, eventType, JSON.stringify(eventData), Date.now())
}

/**
 * Retrieves all distraction events for a given session.
 */
export function getForSession(sessionId: string): DistractionEventRow[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT id, session_id, event_type, event_data, timestamp
    FROM distraction_events
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `).all(sessionId) as DistractionEventRow[]
}

/**
 * Retrieves distraction events logged after a certain timestamp for a session.
 */
export function getEventsSince(
  sessionId: string,
  timestamp: number
): DistractionEventRow[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT id, session_id, event_type, event_data, timestamp
    FROM distraction_events
    WHERE session_id = ? AND timestamp > ?
    ORDER BY timestamp ASC
  `).all(sessionId, timestamp) as DistractionEventRow[]
}

/**
 * Retrieves distraction event counts grouped by event type for a session.
 */
export function getEventCounts(sessionId: string): { [type: string]: number } {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT event_type, COUNT(*) as count
    FROM distraction_events
    WHERE session_id = ?
    GROUP BY event_type
  `).all(sessionId) as { event_type: string; count: number }[]

  const result: { [type: string]: number } = {
    sustained_distraction: 0,
    excessive_switching: 0,
    blacklist_visit: 0,
    extended_idle: 0
  }
  for (const r of rows) {
    result[r.event_type] = r.count
  }
  return result
}

/**
 * Queries cross-session metrics to find the most frequent distraction value (e.g. top blacklisted domain visited).
 */
export function getMostCommonDistraction(): { value: string; count: number } | null {
  const db = getDatabase()
  
  // Query all blacklist visit domains and find the most frequent one
  const res = db.prepare(`
    SELECT event_data, COUNT(*) as count
    FROM distraction_events
    WHERE event_type = 'blacklist_visit'
    GROUP BY event_data
    ORDER BY count DESC
    LIMIT 1
  `).get() as { event_data: string; count: number } | null

  if (!res) return null

  try {
    const parsed = JSON.parse(res.event_data)
    return {
      value: parsed.domain || 'Unknown',
      count: res.count
    }
  } catch {
    return null
  }
}
