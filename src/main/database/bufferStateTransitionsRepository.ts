import { getDatabase } from './db'

export interface StateTransitionRow {
  id?: number
  session_id: string
  state: string
  start_time: number
  end_time: number | null
  duration: number | null
}

export const bufferStateTransitionsRepository = {
  /**
   * Inserts a new buffer state transition event with end_time initially NULL.
   */
  insertTransition(sessionId: string, state: string, startTime: number): void {
    const db = getDatabase()
    db.prepare(`
      INSERT INTO buffer_state_transitions (session_id, state, start_time, end_time, duration)
      VALUES (?, ?, ?, NULL, NULL)
    `).run(sessionId, state, startTime)
  },

  /**
   * Closes out the active state transition (where end_time is NULL) for a session.
   */
  closeOutTransition(sessionId: string, endTime: number): void {
    const db = getDatabase()
    const active = db.prepare(`
      SELECT id, start_time FROM buffer_state_transitions
      WHERE session_id = ? AND end_time IS NULL
      ORDER BY start_time DESC
      LIMIT 1
    `).get(sessionId) as { id: number; start_time: number } | undefined

    if (active) {
      const duration = endTime - active.start_time
      db.prepare(`
        UPDATE buffer_state_transitions
        SET end_time = ?, duration = ?
        WHERE id = ?
      `).run(endTime, duration, active.id)
    }
  },

  /**
   * Retrieves all transitions logged for a session, ordered chronologically.
   */
  getForSession(sessionId: string): StateTransitionRow[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT id, session_id, state, start_time, end_time, duration
      FROM buffer_state_transitions
      WHERE session_id = ?
      ORDER BY start_time ASC
    `).all(sessionId) as StateTransitionRow[]
  },

  /**
   * Summarizes total duration in each state for the given session.
   */
  getTimeInEachState(sessionId: string): { [state: string]: number } {
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT state, SUM(COALESCE(duration, 0)) as total_duration
      FROM buffer_state_transitions
      WHERE session_id = ?
      GROUP BY state
    `).all(sessionId) as { state: string; total_duration: number }[]

    const result: { [state: string]: number } = {
      focused: 0,
      warning: 0,
      critical: 0,
      paused: 0
    }
    for (const r of rows) {
      result[r.state] = r.total_duration
    }
    return result
  }
}
