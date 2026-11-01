import { getDatabase } from './db'

export interface BlacklistedAppRow {
  app_name: string
  is_enabled: number // 0 or 1
}

/**
 * Returns all configured blacklisted apps.
 */
export function getAllBlacklistedApps(): BlacklistedAppRow[] {
  const db = getDatabase()
  return db.prepare('SELECT app_name, is_enabled FROM blacklisted_apps').all() as BlacklistedAppRow[]
}

/**
 * Returns names of all enabled blacklisted apps.
 */
export function getEnabledApps(): string[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT app_name FROM blacklisted_apps WHERE is_enabled = 1').all() as { app_name: string }[]
  return rows.map((r) => r.app_name)
}

/**
 * Adds an application to the blacklist.
 */
export function addBlacklistedApp(appName: string): void {
  const cleanName = appName.trim()
  if (!cleanName) {
    throw new Error('Application name cannot be empty')
  }

  const db = getDatabase()
  db.prepare('INSERT OR IGNORE INTO blacklisted_apps (app_name, is_enabled) VALUES (?, 1)').run(cleanName)
}

/**
 * Removes an application from the blacklist.
 */
export function removeBlacklistedApp(appName: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM blacklisted_apps WHERE app_name = ?').run(appName.trim())
}

/**
 * Toggles an application's enabled status.
 */
export function toggleBlacklistedApp(appName: string, enabled: boolean): void {
  const db = getDatabase()
  db.prepare('UPDATE blacklisted_apps SET is_enabled = ? WHERE app_name = ?').run(
    enabled ? 1 : 0,
    appName.trim()
  )
}

/**
 * Logs a process termination event to app_kill_events.
 */
export function logKillEvent(sessionId: string, appName: string): void {
  const db = getDatabase()
  db.prepare(`
    INSERT INTO app_kill_events (session_id, app_name)
    VALUES (?, ?)
  `).run(sessionId, appName)
}
