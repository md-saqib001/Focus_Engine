import { getWindowFocusHistory } from '../database/windowFocusRepository'
import { cvMetricsRepository } from '../database/cvMetricsRepository'
import { getForSession as getDistractionEvents } from '../database/distractionEventsRepository'
import { bufferSnapshotsRepository } from '../database/bufferSnapshotsRepository'
import { bufferStateTransitionsRepository } from '../database/bufferStateTransitionsRepository'
import { getSessionById, getAllSessions } from '../database/sessionRepository'

export interface StaleAlert {
  timestamp: number
  timeGapSec: number
}

export interface DoublePenaltyAlert {
  domain: string
  timeDiffSec: number
  timestamp: number
}

export interface AuditResult {
  sessionId: string
  windowStaleAlerts: StaleAlert[]
  cvStaleAlerts: StaleAlert[]
  doublePenaltyAlerts: DoublePenaltyAlert[]
  cvArchived: boolean
}

/**
 * Audits a focus session's telemetry timestamps for collection gaps
 * (stale loops) and potential overlapping double penalties.
 */
export function auditTickSynchronization(sessionId: string): AuditResult {
  const windowFocus = getWindowFocusHistory(sessionId)
  const cvMetrics = cvMetricsRepository.getCVMetricsForSession(sessionId)
  const distractionEvents = getDistractionEvents(sessionId)

  const windowStaleAlerts: StaleAlert[] = []
  const cvStaleAlerts: StaleAlert[] = []
  const doublePenaltyAlerts: DoublePenaltyAlert[] = []

  // 1. Audit window_focus timestamp gaps (>10s)
  for (let i = 1; i < windowFocus.length; i++) {
    const gapMs = windowFocus[i].timestamp - windowFocus[i - 1].timestamp
    if (gapMs > 10000) {
      windowStaleAlerts.push({
        timestamp: windowFocus[i].timestamp,
        timeGapSec: Math.round(gapMs / 1000)
      })
    }
  }

  // 2. Audit raw CV metrics gaps (>2s)
  const cvArchived = cvMetrics.length === 0
  if (!cvArchived) {
    for (let i = 1; i < cvMetrics.length; i++) {
      const gapMs = cvMetrics[i].timestamp - cvMetrics[i - 1].timestamp
      if (gapMs > 2000) {
        cvStaleAlerts.push({
          timestamp: cvMetrics[i].timestamp,
          timeGapSec: Math.round(gapMs / 1000)
        })
      }
    }
  }

  // 3. Audit overlapping double penalties (<60s difference for the same domain)
  const parsedEvents = distractionEvents.map((evt) => {
    let domain = ''
    try {
      const parsed = JSON.parse(evt.event_data)
      domain = (parsed.domain || '').toLowerCase().trim()
    } catch {
      // ignore
    }
    return {
      id: evt.id,
      type: evt.event_type,
      domain,
      timestamp: evt.timestamp
    }
  })

  const sustainedEvents = parsedEvents.filter((e) => e.type === 'sustained_distraction')
  const blacklistEvents = parsedEvents.filter((e) => e.type === 'blacklist_visit')

  for (const se of sustainedEvents) {
    if (!se.domain) continue
    for (const be of blacklistEvents) {
      if (be.domain === se.domain) {
        const timeDiffMs = Math.abs(se.timestamp - be.timestamp)
        if (timeDiffMs <= 60000) {
          doublePenaltyAlerts.push({
            domain: se.domain,
            timeDiffSec: Math.round(timeDiffMs / 1000),
            timestamp: Math.min(se.timestamp, be.timestamp)
          })
        }
      }
    }
  }

  return {
    sessionId,
    windowStaleAlerts,
    cvStaleAlerts,
    doublePenaltyAlerts,
    cvArchived
  }
}

export interface SnapshotGap {
  startTime: number
  endTime: number
  gapDurationSec: number
}

export interface ValidationResult {
  sessionId: string
  sessionMode: string
  durationActualSec: number
  expectedCount: number
  actualCount: number
  missingMinutes: number
  gaps: SnapshotGap[]
}

/**
 * Validates the focus buffer snapshots storage for gaps, taking pause states
 * into account to filter out intentional pauses.
 */
export function validateBufferSnapshots(sessionId: string): ValidationResult {
  const session = getSessionById(sessionId)
  if (!session) {
    throw new Error(`Session ${sessionId} not found`)
  }

  const snapshots = bufferSnapshotsRepository.getSnapshotsForSession(sessionId)
  const transitions = bufferStateTransitionsRepository.getForSession(sessionId)

  const durationActualSec = session.duration_actual_sec ?? 0
  const expectedCount = Math.floor(durationActualSec / 60)
  const actualCount = snapshots.length

  const gaps: SnapshotGap[] = []

  // Check gaps between consecutive snapshots
  for (let i = 1; i < snapshots.length; i++) {
    const tPrev = snapshots[i - 1].timestamp
    const tCurr = snapshots[i].timestamp
    const totalDiffSec = (tCurr - tPrev) / 1000

    // Sum paused duration in this window
    let pausedMs = 0
    for (const transition of transitions) {
      if (transition.state === 'paused') {
        const pStart = transition.start_time
        const pEnd = transition.end_time ?? Date.now()

        const overlapStart = Math.max(tPrev, pStart)
        const overlapEnd = Math.min(tCurr, pEnd)

        if (overlapEnd > overlapStart) {
          pausedMs += (overlapEnd - overlapStart)
        }
      }
    }

    const pausedSec = pausedMs / 1000
    const activeDiffSec = totalDiffSec - pausedSec

    // If active duration between two consecutive snapshots is significantly larger than 60s
    if (activeDiffSec > 70) {
      gaps.push({
        startTime: tPrev,
        endTime: tCurr,
        gapDurationSec: Math.round(activeDiffSec)
      })
    }
  }

  // Also check if there is a gap between start_time and the first snapshot
  if (snapshots.length > 0) {
    const tStart = session.start_time
    const tFirst = snapshots[0].timestamp
    const totalDiffSec = (tFirst - tStart) / 1000

    let pausedMs = 0
    for (const transition of transitions) {
      if (transition.state === 'paused') {
        const pStart = transition.start_time
        const pEnd = transition.end_time ?? Date.now()

        const overlapStart = Math.max(tStart, pStart)
        const overlapEnd = Math.min(tFirst, pEnd)

        if (overlapEnd > overlapStart) {
          pausedMs += (overlapEnd - overlapStart)
        }
      }
    }

    const pausedSec = pausedMs / 1000
    const activeDiffSec = totalDiffSec - pausedSec

    if (activeDiffSec > 70) {
      gaps.unshift({
        startTime: tStart,
        endTime: tFirst,
        gapDurationSec: Math.round(activeDiffSec)
      })
    }
  }

  const missingMinutes = Math.max(0, expectedCount - actualCount)

  return {
    sessionId,
    sessionMode: session.session_mode,
    durationActualSec,
    expectedCount,
    actualCount,
    missingMinutes,
    gaps
  }
}

export interface BulkValidationResult {
  totalSessions: number
  sessionsWithGaps: number
  totalExpectedSnapshots: number
  totalActualSnapshots: number
  totalMissingMinutes: number
  details: ValidationResult[]
}

/**
 * Runs snapshot storage validation across all sessions.
 */
export function validateAllBufferData(): BulkValidationResult {
  const sessions = getAllSessions()
  const details: ValidationResult[] = []

  let totalExpectedSnapshots = 0
  let totalActualSnapshots = 0
  let totalMissingMinutes = 0
  let sessionsWithGaps = 0

  for (const session of sessions) {
    try {
      const res = validateBufferSnapshots(session.session_id)
      details.push(res)
      totalExpectedSnapshots += res.expectedCount
      totalActualSnapshots += res.actualCount
      totalMissingMinutes += res.missingMinutes
      if (res.missingMinutes > 0 || res.gaps.length > 0) {
        sessionsWithGaps++
      }
    } catch (err) {
      console.error(`[validateAllBufferData] Error validating session ${session.session_id}:`, err)
    }
  }

  return {
    totalSessions: sessions.length,
    sessionsWithGaps,
    totalExpectedSnapshots,
    totalActualSnapshots,
    totalMissingMinutes,
    details
  }
}
