import { getDatabase } from '../database/db'

export interface StreakData {
  currentStreak: number
  longestStreak: number
  isActive: boolean
  activeDates: string[] // sorted ascending, 'YYYY-MM-DD' local-calendar dates with >=1 completed session
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function localDateStringToUTCMidnightMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  // Treated purely as a calendar-day index (Date.UTC avoids DST shifting the
  // day-to-day delta), not as an actual instant in time.
  return Date.UTC(y, m - 1, d)
}

function getLocalDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Pure streak math over a list of local-calendar dates that had a completed session.
 * Kept free of SQLite/Electron so it can be unit-tested directly.
 */
export function computeStreaksFromDates(dates: string[], now: Date = new Date()): StreakData {
  const sortedDates = Array.from(new Set(dates)).sort()

  if (sortedDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, isActive: false, activeDates: [] }
  }

  let longestStreak = 1
  let runLength = 1

  for (let i = 1; i < sortedDates.length; i++) {
    const prevMs = localDateStringToUTCMidnightMs(sortedDates[i - 1])
    const currMs = localDateStringToUTCMidnightMs(sortedDates[i])
    const dayDiff = Math.round((currMs - prevMs) / MS_PER_DAY)

    if (dayDiff === 1) {
      runLength += 1
    } else {
      longestStreak = Math.max(longestStreak, runLength)
      runLength = 1
    }
  }
  longestStreak = Math.max(longestStreak, runLength)

  // The streak is "alive" only if the most recent active day is today or
  // yesterday -- otherwise it's a dead run sitting in history.
  const today = getLocalDateString(now)
  const yesterday = getLocalDateString(new Date(now.getTime() - MS_PER_DAY))
  const mostRecentDate = sortedDates[sortedDates.length - 1]
  const isActive = mostRecentDate === today || mostRecentDate === yesterday

  return {
    currentStreak: isActive ? runLength : 0,
    longestStreak,
    isActive,
    activeDates: sortedDates
  }
}

export const streakCalculator = {
  calculateStreaks(): StreakData {
    const db = getDatabase()

    // start_time is a UTC epoch-ms instant. A streak is a sequence of the
    // USER'S calendar days, not UTC calendar days -- a session finished at
    // 1am local time is still "today" to the person who stayed up working,
    // but bucketing by raw UTC date would silently roll it back (or forward,
    // depending on the sign of the offset) into a different day, splitting
    // one real day of work into two dates or merging two real days into one.
    // SQLite's strftime() defaults to UTC; the 'localtime' modifier rebases
    // the instant to the OS timezone before formatting, which is what makes
    // the resulting date match what the user actually experienced as "today".
    const rows = db
      .prepare(
        `
        SELECT DISTINCT strftime('%Y-%m-%d', start_time / 1000, 'unixepoch', 'localtime') as localDate
        FROM sessions
        WHERE completed = 1
        ORDER BY localDate ASC
      `
      )
      .all() as { localDate: string }[]

    return computeStreaksFromDates(rows.map((r) => r.localDate))
  }
}
