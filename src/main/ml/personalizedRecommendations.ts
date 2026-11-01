import * as fs from 'fs'
import { getDatabase } from '../database/db'
import { getModelsPath } from '../utils/paths'

/**
 * Generates a personalized focus recommendation based on the top feature importance of the trained ML model.
 * Enforces a minimum threshold of 15 real sessions to avoid showing overconfident personalized claims
 * that are actually backed mostly by synthetic baseline data.
 */
export function getPersonalizedRecommendation(): string {
  const db = getDatabase()

  // 1. Query the database for completed REAL focus sessions.
  // The database contains only genuine sessions (all feature test runs were purged in Day 40.5,
  // and synthetic sessions exist only in the CSV dataset pool, never in SQLite).
  const realCountRow = db
    .prepare("SELECT COUNT(*) as count FROM sessions WHERE completed = 1 AND focus_score IS NOT NULL")
    .get() as { count: number } | undefined
  const realCount = realCountRow ? realCountRow.count : 0

  // Threshold of 15 real sessions ensures that personalized recommendations are backed by sufficient
  // user behavioral data before attempting customized user feedback, avoiding overconfident synthetic bias.
  if (realCount < 15) {
    return `Analyzing your focus habits... (Currently calibrating with synthetic baseline data. Complete ${15 - realCount} more focus sessions to unlock personalized recommendations)`
  }

  // 2. Load model feature importances saved during the last training cycle
  try {
    const importancesPath = getModelsPath('feature_importances.json')
    if (!fs.existsSync(importancesPath)) {
      return "Unlock personalized recommendations by completing more focus sessions."
    }

    const importancesContent = fs.readFileSync(importancesPath, 'utf8')
    const importances = JSON.parse(importancesContent) as Record<string, number>

    // Find the feature with the highest importance score
    let topFeature = ''
    let maxVal = -1
    for (const [feat, val] of Object.entries(importances)) {
      if (val > maxVal) {
        maxVal = val
        topFeature = feat
      }
    }

    if (!topFeature) {
      return "Unlock personalized recommendations by completing more focus sessions."
    }

    // 3. Generate feedback sentence based on the top predictive feature
    switch (topFeature) {
      case 'app_switches':
        return "We noticed that switching between applications is your largest focus disruption factor. Try closing distracting tabs or locking your workspace."
      case 'avg_buffer':
      case 'min_buffer':
      case 'max_buffer':
        return "Your focus levels correlate heavily with maintaining a steady focus buffer. Try working in shorter, highly focused Pomodoro segments to keep your momentum."
      case 'avg_kpm':
        return "Active typing rates correlate heavily with your peak focus hours. Try grouping your writing or coding tasks during these high-energy windows."
      case 'mouse_activity':
        return "Frequent mouse clicks and movements correspond to your most productive states. Keep up the active workflows!"
      case 'pause_count':
        return "Frequent pausing disrupts your focus momentum. Try using standard open-ended mode to build longer continuous stretches."
      case 'attention_time':
        return "Webcam gaze attention is highly predictive of your focus scores. Guard your visual workspace from physical distractions."
      case 'focus_time':
        return "The ratio of continuous focused state is the primary predictor of your success. Challenge yourself to build longer blocks."
      case 'session_duration':
        return "Your session length is the main determinant of focus outcomes. Align task sizes to your intended session durations."
      default:
        return "Minimize window switching and limit app notifications to keep your focus trend high."
    }

  } catch (err) {
    console.error('[personalizedRecommendations] Error reading importances:', err)
    return "Unlock personalized recommendations by completing more focus sessions."
  }
}
