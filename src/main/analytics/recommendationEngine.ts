import { getDatabase } from '../database/db'
import { getPersonalizedRecommendation } from '../ml/personalizedRecommendations'

export interface FocusWindow {
  startHour: number
  endHour: number
  avgScore: number
  sessionCount: number
}

export interface DistractingApp {
  appName: string
  killCount: number
}

export interface DistractingDomain {
  domain: string
  visitCount: number
}

export interface RecommendationResult {
  hasEnoughData: boolean
  totalSessionsCount: number
  bestFocusWindow: FocusWindow | null
  mostDistractingApp: DistractingApp | null
  mostDistractingDomain: DistractingDomain | null
  recommendations: string[]
}

function formatHour(hour: number): string {
  return String(hour).padStart(2, '0') + ':00'
}

export const recommendationEngine = {
  generateRecommendations(): RecommendationResult {
    const db = getDatabase()

    // 1. Calculate total completed sessions count
    const completedCountRow = db
      .prepare(`SELECT COUNT(*) as count FROM sessions WHERE completed = 1`)
      .get() as { count: number }
    const totalSessionsCount = completedCountRow.count
    const hasEnoughData = totalSessionsCount >= 10

    // 2. Calculate best focus window (contiguous 2-hour block, min 3 data points)
    // Fetch start hour and focus score of all completed sessions
    const sessionHours = db
      .prepare(
        `SELECT 
           CAST(strftime('%H', start_time / 1000, 'unixepoch', 'localtime') AS INTEGER) as hour,
           focus_score
         FROM sessions
         WHERE completed = 1 AND focus_score IS NOT NULL`
      )
      .all() as { hour: number; focus_score: number }[]

    // Aggregate sessions by hour of day (0-23)
    const hours = Array.from({ length: 24 }, () => ({ totalScore: 0, count: 0 }))
    for (const s of sessionHours) {
      hours[s.hour].totalScore += s.focus_score
      hours[s.hour].count += 1
    }

    let bestWindow: FocusWindow | null = null

    // Search for best 2-hour contiguous window
    for (let h = 0; h < 24; h++) {
      const h2 = (h + 1) % 24
      const sessionCount = hours[h].count + hours[h2].count
      const totalScore = hours[h].totalScore + hours[h2].totalScore
      const avgScore = sessionCount > 0 ? totalScore / sessionCount : 0

      // Must be backed by at least 3 data points (sessions)
      if (sessionCount >= 3) {
        if (!bestWindow || avgScore > bestWindow.avgScore) {
          bestWindow = {
            startHour: h,
            endHour: (h + 2) % 24,
            avgScore,
            sessionCount
          }
        }
      }
    }

    // 3. Find most distracting app (from app_kill_events)
    const distractingAppRow = db
      .prepare(
        `SELECT app_name, COUNT(*) as killCount 
         FROM app_kill_events 
         GROUP BY app_name 
         ORDER BY killCount DESC 
         LIMIT 1`
      )
      .get() as { app_name: string; killCount: number } | undefined

    const mostDistractingApp: DistractingApp | null = distractingAppRow
      ? {
          appName: distractingAppRow.app_name,
          killCount: distractingAppRow.killCount
        }
      : null

    // 4. Find most distracting domain (from distraction_events of type blacklist_visit)
    const distractingDomainRow = db
      .prepare(
        `SELECT json_extract(event_data, '$.domain') as domain, COUNT(*) as visitCount 
         FROM distraction_events 
         WHERE event_type = 'blacklist_visit' AND json_extract(event_data, '$.domain') IS NOT NULL
         GROUP BY domain 
         ORDER BY visitCount DESC 
         LIMIT 1`
      )
      .get() as { domain: string; visitCount: number } | undefined

    const mostDistractingDomain: DistractingDomain | null = distractingDomainRow
      ? {
          domain: distractingDomainRow.domain,
          visitCount: distractingDomainRow.visitCount
        }
      : null

    // 5. Generate natural-language recommendation sentences
    const recommendations: string[] = [getPersonalizedRecommendation()]

    // Sentence 1: Focus Window advice
    if (bestWindow) {
      const startStr = formatHour(bestWindow.startHour)
      const endStr = formatHour(bestWindow.endHour)
      const roundedScore = Math.round(bestWindow.avgScore)

      if (bestWindow.startHour >= 21 || bestWindow.startHour < 4) {
        recommendations.push(
          `Your focus peaks late at night between **${startStr} and ${endStr}** (avg score: **${roundedScore}%**). If this is when you feel most creative, guard these hours from interruptions.`
        )
      } else if (bestWindow.startHour >= 5 && bestWindow.startHour < 9) {
        recommendations.push(
          `You are highly productive in the early morning between **${startStr} and ${endStr}** (avg score: **${roundedScore}%**). Tackle your hardest coding or planning tasks first thing.`
        )
      } else if (bestWindow.startHour >= 12 && bestWindow.startHour < 17) {
        recommendations.push(
          `Your focus is strongest in the afternoon between **${startStr} and ${endStr}** (avg score: **${roundedScore}%**). This is your golden window for deep execution.`
        )
      } else {
        recommendations.push(
          `Your peak focus window occurs between **${startStr} and ${endStr}** with a strong average focus score of **${roundedScore}%**.`
        )
      }
    } else {
      recommendations.push(
        `No optimal focus window identified yet. Keep completing sessions to help us map your daily focus patterns.`
      )
    }

    // Sentence 2: Distracting App advice
    if (mostDistractingApp) {
      recommendations.push(
        `**${mostDistractingApp.appName}** was force-closed **${mostDistractingApp.killCount}** times during focus sessions. Proactively close it before hitting start to build uninterrupted momentum.`
      )
    } else {
      recommendations.push(
        `Zero app-killing interruptions recorded. Outstanding job keeping distracting apps closed!`
      )
    }

    // Sentence 3: Distracting Domain advice
    if (mostDistractingDomain) {
      recommendations.push(
        `**${mostDistractingDomain.domain}** triggered **${mostDistractingDomain.visitCount}** distraction events. Consider adding it to your blocked domains list or using our hosts blocker to block it.`
      )
    } else {
      recommendations.push(
        `No visits to blocked sites detected during your focused sessions. Your digital discipline is top-tier.`
      )
    }

    // Sentence 4: Overall score advice
    const avgFocusScoreRow = db
      .prepare(`SELECT AVG(focus_score) as avgScore FROM sessions WHERE focus_score IS NOT NULL`)
      .get() as { avgScore: number | null }
    const overallAvg = avgFocusScoreRow.avgScore

    if (overallAvg !== null) {
      const roundedOverall = Math.round(overallAvg)
      if (roundedOverall >= 75) {
        recommendations.push(
          `Your average focus score is a stellar **${roundedOverall}%**! You are maintaining high cognitive presence.`
        )
      } else if (roundedOverall >= 50) {
        recommendations.push(
          `Your average focus score is **${roundedOverall}%**. Minimizing window switching and keeping your phone away could push you past 80%.`
        )
      } else {
        recommendations.push(
          `Your average focus score is currently **${roundedOverall}%**. Try shorter, hyper-focused sessions (e.g., 20-minute sprints) to build up your stamina.`
        )
      }
    }

    return {
      hasEnoughData,
      totalSessionsCount,
      bestFocusWindow: bestWindow,
      mostDistractingApp,
      mostDistractingDomain,
      recommendations
    }
  }
}
