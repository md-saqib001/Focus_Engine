import { getDatabase } from '../database/db'
import { heatmapRepository } from './heatmapRepository'

export interface HourStat {
  hour: number // 0-23
  avgScore: number
}

export interface DayStat {
  dayOfWeek: number // 0-6, 0 = Sunday (matches heatmapRepository/SQLite strftime('%w'))
  avgScore: number
}

export interface LongestSession {
  sessionId: string
  durationActualSec: number
  startTime: number
}

export interface ProductivitySummary {
  bestHour: HourStat | null
  worstHour: HourStat | null
  mostProductiveDay: DayStat | null
  longestSession: LongestSession | null
  longestFocusStreakMinutes: number
  averageFocusScore: number | null
  averageSessionDurationSec: number | null
  totalSessionsCompleted: number
  totalFocusedMinutes: number
}

/**
 * Aggregates the (dayOfWeek, hourOfDay) heatmap cells down to one axis at a
 * time, weighting each cell's avgScore by its sessionCount so an hour/day
 * that's only ever seen one lucky (or unlucky) session doesn't get equal
 * say to one backed by dozens of sessions.
 */
function pickBestAndWorstHour(cells: { hourOfDay: number; avgScore: number; sessionCount: number }[]): {
  best: HourStat | null
  worst: HourStat | null
} {
  const byHour = new Map<number, { weightedSum: number; count: number }>()
  for (const cell of cells) {
    if (cell.sessionCount <= 0) continue
    const entry = byHour.get(cell.hourOfDay) || { weightedSum: 0, count: 0 }
    entry.weightedSum += cell.avgScore * cell.sessionCount
    entry.count += cell.sessionCount
    byHour.set(cell.hourOfDay, entry)
  }

  let best: HourStat | null = null
  let worst: HourStat | null = null
  for (const [hour, { weightedSum, count }] of byHour) {
    const avgScore = weightedSum / count
    if (!best || avgScore > best.avgScore) best = { hour, avgScore }
    if (!worst || avgScore < worst.avgScore) worst = { hour, avgScore }
  }
  return { best, worst }
}

function pickMostProductiveDay(cells: { dayOfWeek: number; avgScore: number; sessionCount: number }[]): DayStat | null {
  const byDay = new Map<number, { weightedSum: number; count: number }>()
  for (const cell of cells) {
    if (cell.sessionCount <= 0) continue
    const entry = byDay.get(cell.dayOfWeek) || { weightedSum: 0, count: 0 }
    entry.weightedSum += cell.avgScore * cell.sessionCount
    entry.count += cell.sessionCount
    byDay.set(cell.dayOfWeek, entry)
  }

  let best: DayStat | null = null
  for (const [dayOfWeek, { weightedSum, count }] of byDay) {
    const avgScore = weightedSum / count
    if (!best || avgScore > best.avgScore) best = { dayOfWeek, avgScore }
  }
  return best
}

export const productivityAnalytics = {
  getProductivitySummary(): ProductivitySummary {
    const db = getDatabase()

    const heatmapCells = heatmapRepository.getFocusHeatmapData()
    const { best: bestHour, worst: worstHour } = pickBestAndWorstHour(heatmapCells)
    const mostProductiveDay = pickMostProductiveDay(heatmapCells)

    const longestSessionRow = db
      .prepare(
        `SELECT session_id, duration_actual_sec, start_time
         FROM sessions
         WHERE completed = 1 AND duration_actual_sec IS NOT NULL
         ORDER BY duration_actual_sec DESC
         LIMIT 1`
      )
      .get() as { session_id: string; duration_actual_sec: number; start_time: number } | undefined

    const longestSession: LongestSession | null = longestSessionRow
      ? {
          sessionId: longestSessionRow.session_id,
          durationActualSec: longestSessionRow.duration_actual_sec,
          startTime: longestSessionRow.start_time
        }
      : null

    // "Longest focus streak" here means the single longest UNINTERRUPTED stretch
    // the Focus Buffer state machine spent in the 'focused' state, taking the max
    // across every buffer_state_transitions row (state='focused') from every
    // session ever recorded. This is NOT the same thing as the calendar day-streak
    // computed by streakCalculator.ts (Day 37): that one counts consecutive
    // CALENDAR DAYS with at least one completed session, regardless of how focused
    // any single moment was. This metric instead measures continuous focus *within*
    // a session's runtime, in minutes. It also can't span across two different
    // sessions -- each session gets its own buffer/state-machine instance that
    // resets to a fresh 'focused' state at session start, so the longest row found
    // here is always bounded by a single session's duration.
    const longestFocusStreakRow = db
      .prepare(
        `SELECT MAX(duration) as maxDurationMs
         FROM buffer_state_transitions
         WHERE state = 'focused' AND duration IS NOT NULL`
      )
      .get() as { maxDurationMs: number | null }
    const longestFocusStreakMinutes = longestFocusStreakRow.maxDurationMs
      ? Math.round(longestFocusStreakRow.maxDurationMs / 60000)
      : 0

    const focusScoreRow = db
      .prepare(`SELECT AVG(focus_score) as avgScore FROM sessions WHERE focus_score IS NOT NULL`)
      .get() as { avgScore: number | null }

    const durationRow = db
      .prepare(
        `SELECT AVG(duration_actual_sec) as avgDuration
         FROM sessions
         WHERE completed = 1 AND duration_actual_sec IS NOT NULL`
      )
      .get() as { avgDuration: number | null }

    const completedCountRow = db
      .prepare(`SELECT COUNT(*) as count FROM sessions WHERE completed = 1`)
      .get() as { count: number }

    const totalFocusedRow = db
      .prepare(
        `SELECT SUM(duration) as totalMs
         FROM buffer_state_transitions
         WHERE state = 'focused' AND duration IS NOT NULL`
      )
      .get() as { totalMs: number | null }
    const totalFocusedMinutes = totalFocusedRow.totalMs ? Math.round(totalFocusedRow.totalMs / 60000) : 0

    return {
      bestHour,
      worstHour,
      mostProductiveDay,
      longestSession,
      longestFocusStreakMinutes,
      averageFocusScore: focusScoreRow.avgScore !== null ? Math.round(focusScoreRow.avgScore) : null,
      averageSessionDurationSec: durationRow.avgDuration !== null ? Math.round(durationRow.avgDuration) : null,
      totalSessionsCompleted: completedCountRow.count,
      totalFocusedMinutes
    }
  }
}
