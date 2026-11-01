import { bufferSnapshotsRepository } from '../database/bufferSnapshotsRepository'
import { bufferStateTransitionsRepository } from '../database/bufferStateTransitionsRepository'
import { cvMetricsRepository } from '../database/cvMetricsRepository'
import { getSessionById } from '../database/sessionRepository'

export interface FocusScoreComponents {
  averageBuffer: number
  focusPercentage: number
  attentionPercentage: number | null
  reweighted: boolean
  finalScore: number
}

/**
 * Calculates the automatic Focus Score for a given session.
 * This is the core ML training target for Phase 6.
 */
export function calculateFocusScore(sessionId: string): FocusScoreComponents | null {
  const session = getSessionById(sessionId)
  if (!session || !session.duration_actual_sec || session.duration_actual_sec <= 0) return null

  // 1. Average Buffer (0 - 100%)
  const snapshots = bufferSnapshotsRepository.getSnapshotsForSession(sessionId)
  let averageBuffer = 0
  if (snapshots.length > 0) {
    const sum = snapshots.reduce((acc, curr) => acc + curr.value, 0)
    // FocusBuffer.currentValue is already clamped to 0-100 (see focusBuffer.ts),
    // so the average of snapshot values is already a 0-100 percentage.
    averageBuffer = sum / snapshots.length
  }

  // 2. Focus Percentage (0 - 100%)
  const transitions = bufferStateTransitionsRepository.getForSession(sessionId)
  let focusedMs = 0
  for (const t of transitions) {
    if (t.state === 'focused' && t.duration) {
      focusedMs += t.duration
    }
  }
  const focusPercentage = Math.min(100, Math.max(0, (focusedMs / (session.duration_actual_sec * 1000)) * 100))

  // 3. Attention Percentage (0 - 100%)
  const cvSummary = cvMetricsRepository.getCVSummaryForSession(sessionId)
  
  // Base standard weights
  let x = 0.40
  let y = 0.40
  let z = 0.20
  
  let attentionPercentage: number | null = null
  let reweighted = false

  if (!cvSummary) {
    // CV Disabled: Reweight so max score is still 100% (0.4 / 0.8 = 0.5)
    x = 0.50
    y = 0.50
    z = 0.00
    reweighted = true
  } else {
    // Attention score is usually 0.0 - 1.0. We multiply by 100 to get a percentage.
    attentionPercentage = cvSummary.avg_attention_score * 100
  }

  const finalScore = Math.round(
    (x * averageBuffer) + 
    (y * focusPercentage) + 
    (z * (attentionPercentage || 0))
  )

  return {
    averageBuffer: Math.round(averageBuffer),
    focusPercentage: Math.round(focusPercentage),
    attentionPercentage: attentionPercentage !== null ? Math.round(attentionPercentage) : null,
    reweighted,
    finalScore
  }
}
