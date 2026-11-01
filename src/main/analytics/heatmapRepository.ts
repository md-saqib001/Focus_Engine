import { getDatabase } from '../database/db'

export interface HeatmapCell {
  dayOfWeek: number // 0-6 (0 is Sunday)
  hourOfDay: number // 0-23
  avgScore: number
  sessionCount: number
}

export const heatmapRepository = {
  getFocusHeatmapData(): HeatmapCell[] {
    const db = getDatabase()
    
    // Convert start_time (ms) to seconds for SQLite unixepoch
    // %w: day of week (0-6)
    // %H: hour (00-23)
    const stmt = db.prepare(`
      SELECT 
        CAST(strftime('%w', start_time / 1000, 'unixepoch', 'localtime') AS INTEGER) as dayOfWeek,
        CAST(strftime('%H', start_time / 1000, 'unixepoch', 'localtime') AS INTEGER) as hourOfDay,
        AVG(focus_score) as avgScore,
        COUNT(*) as sessionCount
      FROM sessions
      WHERE focus_score IS NOT NULL
      GROUP BY dayOfWeek, hourOfDay
    `)
    
    return stmt.all() as HeatmapCell[]
  }
}
