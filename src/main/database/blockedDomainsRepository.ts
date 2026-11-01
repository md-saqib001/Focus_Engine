import { getDatabase } from './db'

export interface BlockedDomainRow {
  domain: string
  enabled: number // 0 or 1
  created_at: number
}

/**
 * Returns all blocked domains in the database.
 */
export function getAllBlockedDomains(): BlockedDomainRow[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM blocked_domains ORDER BY created_at DESC').all() as BlockedDomainRow[]
}

/**
 * Returns a list of enabled domain strings.
 */
export function getEnabledBlockedDomains(): string[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT domain FROM blocked_domains WHERE enabled = 1').all() as { domain: string }[]
  return rows.map((r) => r.domain)
}

/**
 * Adds a new blocked domain. Automatically lowercases and trims whitespace.
 * Validates domain structure (no spaces).
 */
export function addBlockedDomain(domain: string): void {
  const cleanDomain = domain.trim().toLowerCase()
  if (!cleanDomain) {
    throw new Error('Domain cannot be empty')
  }
  if (cleanDomain.includes(' ')) {
    throw new Error('Domain cannot contain spaces')
  }

  const db = getDatabase()
  db.prepare('INSERT OR IGNORE INTO blocked_domains (domain, enabled) VALUES (?, 1)').run(cleanDomain)
}

/**
 * Removes a blocked domain.
 */
export function removeBlockedDomain(domain: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM blocked_domains WHERE domain = ?').run(domain.trim().toLowerCase())
}

/**
 * Toggles the enabled state of a blocked domain.
 */
export function toggleBlockedDomain(domain: string, enabled: boolean): void {
  const db = getDatabase()
  db.prepare('UPDATE blocked_domains SET enabled = ? WHERE domain = ?').run(
    enabled ? 1 : 0,
    domain.trim().toLowerCase()
  )
}
