import { getDatabase } from './db'

export interface WindowFocusRow {
  session_id: string
  app_name: string
  window_title: string
  domain: string | null
  category: string | null
  timestamp: number
}

export interface AppUsageStats {
  app_name: string
  focus_count: number
}

export interface CategoryBreakdown {
  category: string
  focus_count: number
}

/**
 * Inserts a new window focus entry with domain and category details into the database.
 */
export function insertWindowFocus(
  sessionId: string,
  appName: string,
  windowTitle: string,
  domain: string,
  category: string
): void {
  const db = getDatabase()
  db.prepare(`
    INSERT INTO window_focus (session_id, app_name, window_title, domain, category, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, appName, windowTitle, domain, category, Date.now())
}

/**
 * Retrieves the full window focus history for a given session.
 */
export function getWindowFocusHistory(sessionId: string): WindowFocusRow[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT session_id, app_name, window_title, domain, category, timestamp
    FROM window_focus
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `).all(sessionId) as WindowFocusRow[]
}

/**
 * Retrieves grouped stats for the most used applications in a session.
 */
export function getMostUsedApps(sessionId: string): AppUsageStats[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT app_name, COUNT(*) as focus_count
    FROM window_focus
    WHERE session_id = ?
    GROUP BY app_name
    ORDER BY focus_count DESC
  `).all(sessionId) as AppUsageStats[]
}

/**
 * Retrieves counts of 5-second telemetry ticks grouped by category for a session.
 */
export function getCategoryBreakdown(sessionId: string): CategoryBreakdown[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT category, COUNT(*) as focus_count
    FROM window_focus
    WHERE session_id = ?
    GROUP BY category
    ORDER BY focus_count DESC
  `).all(sessionId) as CategoryBreakdown[]
}

/**
 * Inserts a batch of window focus records within a single database transaction.
 */
export function insertBatch(
  records: { sessionId: string; appName: string; windowTitle: string; domain: string; category: string; timestamp: number }[]
): void {
  if (records.length === 0) return
  const db = getDatabase()
  const insertStmt = db.prepare(`
    INSERT INTO window_focus (session_id, app_name, window_title, domain, category, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const transaction = db.transaction((rows) => {
    for (const r of rows) {
      insertStmt.run(r.sessionId, r.appName, r.windowTitle, r.domain, r.category, r.timestamp)
    }
  })
  transaction(records)
}

