import { ElectronAPI } from '@electron-toolkit/preload'

type SaveSessionArgs =
  | {
      sessionId: string
      mode: 'pomodoro'
      sessionType: 'focus' | 'shortBreak' | 'longBreak'
      startTime: number
      endTime: number
      durationPlannedSec: number
      durationActualSec: number
      completed: boolean
      endReason: 'auto_complete' | 'abandoned'
      autoPausedCount?: number
      pauseCount?: number
    }
  | {
      sessionId: string
      mode: 'standard'
      startTime: number
      endTime: number
      durationActualSec: number
      completed: boolean
      endReason: 'manual_stop' | 'force_ended'
      autoPausedCount?: number
      pauseCount?: number
    }

interface SessionRow {
  session_id: string
  session_mode: 'pomodoro' | 'standard'
  session_type: 'focus' | 'shortBreak' | 'longBreak' | null
  start_time: number
  end_time: number | null
  duration_planned_sec: number | null
  duration_actual_sec: number | null
  completed: number
  end_reason: string | null
  focus_score: number | null
  created_at: number
}

interface BlockedDomainRow {
  domain: string
  enabled: number // 0 or 1
  created_at: number
}

interface BlacklistedAppRow {
  app_name: string
  is_enabled: number // 0 or 1
}

interface IPCResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

interface FocusEngineAPI {
  saveSession: (args: SaveSessionArgs) => Promise<IPCResult<SessionRow>>
  getAllSessions: () => Promise<IPCResult<SessionRow[]>>

  // Hosts blocking endpoints
  startBlocking: () => Promise<IPCResult<void>>
  stopBlocking: () => Promise<IPCResult<void>>
  isBlockingActive: () => Promise<IPCResult<boolean>>
  getBlockedDomains: () => Promise<IPCResult<BlockedDomainRow[]>>
  addBlockedDomain: (domain: string) => Promise<IPCResult<void>>
  removeBlockedDomain: (domain: string) => Promise<IPCResult<void>>
  toggleBlockedDomain: (domain: string, enabled: boolean) => Promise<IPCResult<void>>

  // App blocking endpoints
  killBlacklistedApps: (sessionId: string) => Promise<IPCResult<string[]>>
  getBlacklistedApps: () => Promise<IPCResult<BlacklistedAppRow[]>>
  addBlacklistedApp: (appName: string) => Promise<IPCResult<void>>
  removeBlacklistedApp: (appName: string) => Promise<IPCResult<void>>
  toggleBlacklistedApp: (appName: string, enabled: boolean) => Promise<IPCResult<void>>

  // CV Engine endpoints
  startCV: (sessionId: string, fps?: number) => Promise<IPCResult<void>>
  stopCV: () => Promise<IPCResult<void>>
  getCVSummary: (sessionId: string) => Promise<IPCResult<{
    session_id: string
    avg_attention_score: number
    min_attention_score: number
    face_present_pct: number
  } | null>>
  getCVEnabled: () => Promise<IPCResult<boolean>>
  setCVEnabled: (enabled: boolean) => Promise<IPCResult<void>>
  getCVPermission: () => Promise<IPCResult<'granted' | 'denied' | 'pending'>>
  setCVPermission: (permission: 'granted' | 'denied' | 'pending') => Promise<IPCResult<void>>
  getCalibration: () => Promise<IPCResult<any>>
  setCalibration: (calibration: any) => Promise<IPCResult<void>>
  getDefaultCalibration: () => Promise<IPCResult<any>>
  resetCalibrationToDefault: () => Promise<IPCResult<void>>

  // Telemetry endpoints
  startTelemetry: (sessionId: string, mode: 'pomodoro' | 'standard') => Promise<IPCResult<void>>
  stopTelemetry: () => Promise<IPCResult<void>>
  getWindowHistory: (sessionId: string) => Promise<IPCResult<any[]>>
  getCategoryBreakdown: (sessionId: string) => Promise<IPCResult<any[]>>
  startKPM: (sessionId: string) => Promise<IPCResult<void>>
  stopKPM: () => Promise<IPCResult<void>>
  getKPMHistory: (sessionId: string) => Promise<IPCResult<{
    history: any[]
    average: number
    maxKpm: number
    minKpm: number
  }>>
  startMouse: (sessionId: string) => Promise<IPCResult<void>>
  stopMouse: () => Promise<IPCResult<void>>
  getMouseHistory: (sessionId: string) => Promise<IPCResult<{
    history: any[]
    maxIdleSeconds: number
  }>>
  getSessionSummary: (sessionId: string) => Promise<IPCResult<any>>
  validateSession: (sessionId: string) => Promise<IPCResult<{
    isValid: boolean
    errors: string[]
    warnings: string[]
  }>>
  validateAllSessions: () => Promise<IPCResult<{
    totalSessionsAudited: number
    invalidSessions: number
    totalErrors: number
    totalWarnings: number
    orphanedSessionsCount: number
    results: {
      sessionId: string
      dateLabel: string
      isValid: boolean
      errors: string[]
      warnings: string[]
    }[]
  }>>
  getLatestWindow: () => Promise<IPCResult<{
    appName: string
    windowTitle: string
    domain: string
    category: 'productive' | 'distraction' | 'neutral' | 'unknown'
  } | null>>
  getLiveMouseCounts: () => Promise<IPCResult<{
    clicks: number
    movements: number
  }>>
  getDistractionEvents: (sessionId: string) => Promise<IPCResult<any[]>>
  onActiveWindowUpdate: (
    callback: (info: {
      appName: string
      windowTitle: string
      domain: string
      category: 'productive' | 'distraction' | 'neutral' | 'unknown'
    }) => void
  ) => () => void
  onKpmUpdate: (callback: (kpm: number) => void) => () => void
  onActivityUpdate: (
    callback: (info: {
      status: 'Active' | 'Idle'
      idleSeconds: number
    }) => void
  ) => () => void
  onDistractionEvent: (
    callback: (event: {
      eventType: string
      eventData: any
      timestamp: number
    }) => void
  ) => () => void
  onTelemetryHealthWarning: (
    callback: (status: {
      window: boolean
      kpm: boolean
      mouse: boolean
    }) => void
  ) => () => void
  onCVUpdate: (
    callback: (data: {
      face_present: boolean
      yaw: number | null
      pitch: number | null
      roll: number | null
      gaze_direction: string | null
      gaze_ratio: number | null
      looking_at_screen: boolean
      raw_attention_score: number
      smoothed_attention_score: number
      ts: number
      frame: number
      preview_frame?: string
    }) => void
  ) => () => void
  onCVError: (callback: (error: string) => void) => () => void
  getCurrentFocusBuffer: () => Promise<IPCResult<{
    value: number
    state: string
    history: { timestamp: number; value: number }[]
    signals?: {
      cv: number
      keyboard: number
      mouse: number
      window: number
    }
    isWarmup?: boolean
    autoPausedCount?: number
  }>>
  resumeBuffer: () => Promise<IPCResult<void>>
  pauseBuffer: () => Promise<IPCResult<void>>
  validateAllBufferData: () => Promise<IPCResult<any>>
  onFocusBufferUpdate: (
    callback: (data: {
      value: number
      state: string
      history: { timestamp: number; value: number }[]
      signals?: {
        cv: number
        keyboard: number
        mouse: number
        window: number
      }
      isWarmup?: boolean
      autoPausedCount?: number
    }) => void
  ) => () => void
  onSessionAutoPause: (callback: (data: { reason: string }) => void) => () => void
  onSessionForceEnd: (callback: (data: { reason: string }) => void) => () => void
  getBufferSnapshots: (sessionId: string) => Promise<IPCResult<{
    id: number
    session_id: string
    value: number
    timestamp: number
  }[]>>
  auditSessionBuffer: (sessionId: string) => Promise<IPCResult<{
    sessionId: string
    windowStaleAlerts: { timestamp: number; timeGapSec: number }[]
    cvStaleAlerts: { timestamp: number; timeGapSec: number }[]
    doublePenaltyAlerts: { domain: string; timeDiffSec: number; timestamp: number }[]
    cvArchived: boolean
  }>>
  onFocusBufferStateChanged: (
    callback: (data: {
      previousState: string
      newState: string
      durationInPreviousState: number
    }) => void
  ) => () => void
  getBufferStateTransitions: (sessionId: string) => Promise<IPCResult<{
    id: number
    session_id: string
    state: string
    start_time: number
    end_time: number | null
    duration: number | null
  }[]>>
  getBufferStateTimeSummary: (sessionId: string) => Promise<IPCResult<{
    [state: string]: number
  }>>
  onMLPrediction: (
    callback: (data: {
      focusScore: number
      isAnomaly: boolean
    }) => void
  ) => () => void
  analytics: {
    getHeatmap: () => Promise<IPCResult<{
      dayOfWeek: number
      hourOfDay: number
      avgScore: number
      sessionCount: number
    }[]>>
    getStreaks: () => Promise<IPCResult<{
      currentStreak: number
      longestStreak: number
      isActive: boolean
      activeDates: string[]
    }>>
    getProductivitySummary: () => Promise<IPCResult<{
      bestHour: { hour: number; avgScore: number } | null
      worstHour: { hour: number; avgScore: number } | null
      mostProductiveDay: { dayOfWeek: number; avgScore: number } | null
      longestSession: { sessionId: string; durationActualSec: number; startTime: number } | null
      longestFocusStreakMinutes: number
      averageFocusScore: number | null
      averageSessionDurationSec: number | null
      totalSessionsCompleted: number
      totalFocusedMinutes: number
    }>>
    getRecommendations: () => Promise<IPCResult<{
      hasEnoughData: boolean
      totalSessionsCount: number
      bestFocusWindow: {
        startHour: number
        endHour: number
        avgScore: number
        sessionCount: number
      } | null
      mostDistractingApp: {
        appName: string
        killCount: number
      } | null
      mostDistractingDomain: {
        domain: string
        visitCount: number
      } | null
      recommendations: string[]
    }>>
    triggerRetrain: () => Promise<IPCResult<{
      timestamp: number
      real_sessions: number
      synthetic_sessions: number
      r2_score: number
      mae_score: number
      cv_r2_mean: number
      cv_mae_mean: number
      deployed: boolean
    }>>
    getRetrainHistory: () => Promise<IPCResult<{
      id?: number
      timestamp: number
      real_sessions: number
      synthetic_sessions: number
      r2_score: number
      mae_score: number
      cv_r2_mean: number
      cv_mae_mean: number
      deployed: boolean
    }[]>>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    focusEngineAPI: FocusEngineAPI
  }
}
