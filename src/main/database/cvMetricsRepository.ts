import { getDatabase } from './db'

export interface CVMetric {
  id?: number
  session_id: string
  face_present: boolean
  yaw: number | null
  pitch: number | null
  roll: number | null
  gaze_direction: string | null
  looking_at_screen: boolean
  raw_attention_score: number
  smoothed_attention_score: number
  timestamp: number
}

export interface CVSummary {
  session_id: string
  avg_attention_score: number
  min_attention_score: number
  face_present_pct: number
  created_at?: number
}

export const cvMetricsRepository = {
  insertCVMetric(metric: CVMetric): void {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT INTO cv_metrics (
        session_id, face_present, yaw, pitch, roll, gaze_direction,
        looking_at_screen, raw_attention_score, smoothed_attention_score, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      metric.session_id,
      metric.face_present ? 1 : 0,
      metric.yaw,
      metric.pitch,
      metric.roll,
      metric.gaze_direction,
      metric.looking_at_screen ? 1 : 0,
      metric.raw_attention_score,
      metric.smoothed_attention_score,
      metric.timestamp
    )
  },

  getCVMetricsForSession(sessionId: string): CVMetric[] {
    const db = getDatabase()
    const stmt = db.prepare(`SELECT * FROM cv_metrics WHERE session_id = ? ORDER BY timestamp ASC`)
    const rows = stmt.all(sessionId) as any[]
    
    return rows.map((row) => ({
      id: row.id,
      session_id: row.session_id,
      face_present: row.face_present === 1,
      yaw: row.yaw,
      pitch: row.pitch,
      roll: row.roll,
      gaze_direction: row.gaze_direction,
      looking_at_screen: row.looking_at_screen === 1,
      raw_attention_score: row.raw_attention_score,
      smoothed_attention_score: row.smoothed_attention_score,
      timestamp: row.timestamp,
    }))
  },

  summarizeAndCleanup(sessionId: string): void {
    const db = getDatabase()
    
    // 1. Compute summary stats
    const statsStmt = db.prepare(`
      SELECT 
        COUNT(*) as total_frames,
        AVG(smoothed_attention_score) as avg_score,
        MIN(smoothed_attention_score) as min_score,
        SUM(face_present) as total_face_present
      FROM cv_metrics
      WHERE session_id = ?
    `)
    
    const stats = statsStmt.get(sessionId) as {
      total_frames: number,
      avg_score: number | null,
      min_score: number | null,
      total_face_present: number
    }

    if (stats.total_frames === 0) {
      console.warn(`[cvMetricsRepository] No CV metrics to summarize for session ${sessionId}`)
      return
    }

    const avgAttention = stats.avg_score ?? 0.0
    const minAttention = stats.min_score ?? 0.0
    const facePct = stats.total_frames > 0 ? (stats.total_face_present / stats.total_frames) * 100.0 : 0.0

    // 2. Insert into summary table
    const insertSummaryStmt = db.prepare(`
      INSERT INTO cv_metrics_summary (
        session_id, avg_attention_score, min_attention_score, face_present_pct
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        avg_attention_score = excluded.avg_attention_score,
        min_attention_score = excluded.min_attention_score,
        face_present_pct = excluded.face_present_pct
    `)
    
    insertSummaryStmt.run(sessionId, avgAttention, minAttention, facePct)

    // 3. Delete raw metrics to save space
    const deleteRawStmt = db.prepare(`DELETE FROM cv_metrics WHERE session_id = ?`)
    deleteRawStmt.run(sessionId)
    
    console.log(`[cvMetricsRepository] Summarized and cleaned up ${stats.total_frames} raw frames for session ${sessionId}`)
  },

  getCVSummaryForSession(sessionId: string): CVSummary | null {
    const db = getDatabase()
    const stmt = db.prepare(`SELECT * FROM cv_metrics_summary WHERE session_id = ?`)
    const row = stmt.get(sessionId) as any

    if (!row) return null

    return {
      session_id: row.session_id,
      avg_attention_score: row.avg_attention_score,
      min_attention_score: row.min_attention_score,
      face_present_pct: row.face_present_pct,
      created_at: row.created_at,
    }
  }
}
