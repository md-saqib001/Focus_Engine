import { getDatabase } from './db'

export interface BufferSnapshotRow {
  id?: number
  session_id: string
  value: number
  timestamp: number
}

export const bufferSnapshotsRepository = {
  /**
   * Inserts a single focus buffer snapshot into the database.
   */
  insertSnapshot(sessionId: string, value: number, timestamp: number): void {
    const db = getDatabase()
    db.prepare(`
      INSERT INTO buffer_snapshots (session_id, value, timestamp)
      VALUES (?, ?, ?)
    `).run(sessionId, value, timestamp)
  },

  /**
   * Retrieves all focus buffer snapshots for a session in chronological order.
   */
  getSnapshotsForSession(sessionId: string): BufferSnapshotRow[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT id, session_id, value, timestamp
      FROM buffer_snapshots
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `).all(sessionId) as BufferSnapshotRow[]
  }
}
