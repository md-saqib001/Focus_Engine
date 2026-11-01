import { useState, useEffect, useRef, useCallback } from 'react'
import { useTimerEngine } from './useTimerEngine'
import { SessionType, SessionMode } from '../types/timer'

export interface SessionSummary {
  session_id: string
  session_mode: SessionMode
  session_type: SessionType | null
  start_time: number
  end_time: number
  duration_planned_sec: number | null
  duration_actual_sec: number
  completed: boolean
  end_reason: 'auto_complete' | 'manual_stop' | 'abandoned' | 'force_ended'
  apps_killed_count: number
  apps_killed: string[]
  auto_paused_count?: number
}

export const useFocusSession = () => {
  const timer = useTimerEngine()
  const [blockingStatus, setBlockingStatus] = useState<'idle' | 'blocking' | 'error'>('idle')
  const [blockingError, setBlockingError] = useState<string | null>(null)
  const [appsKilled, setAppsKilled] = useState<string[]>([])
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [activeWindow, setActiveWindow] = useState<{
    appName: string
    windowTitle: string
    domain: string
    category: 'productive' | 'distraction' | 'neutral' | 'unknown'
  } | null>(null)
  const [kpm, setKpm] = useState<number>(0)
  const [activity, setActivity] = useState<{ status: 'Active' | 'Idle'; idleSeconds: number }>({
    status: 'Active',
    idleSeconds: 0
  })
  const [healthStatus, setHealthStatus] = useState<{ window: boolean; kpm: boolean; mouse: boolean } | null>(null)
  const [showAutoPauseModal, setShowAutoPauseModal] = useState(false)
  const [showForceEndModal, setShowForceEndModal] = useState(false)
  const autoPausedCountRef = useRef<number>(0)
  const pauseCountRef = useRef<number>(0)

  // Track state to prevent duplicate database writes
  const sessionIdRef = useRef<string>('')
  const hasSavedRef = useRef<boolean>(false)
  const isBlockingSessionRef = useRef<boolean>(false)

  // Clean up hosts blocking and telemetry poller
  const performBlockingCleanup = useCallback(async () => {
    try {
      await window.focusEngineAPI.stopTelemetry()
      await window.focusEngineAPI.stopCV()
      
      if (sessionIdRef.current) {
        const cvEnabledRes = await window.focusEngineAPI.getCVEnabled()
        if (cvEnabledRes.success && cvEnabledRes.data) {
          // Trigger summary generation and DB cleanup
          const summaryRes = await window.focusEngineAPI.getCVSummary(sessionIdRef.current)
          console.log('[useFocusSession] CV Summary:', summaryRes)
        }
      }
      
      setActiveWindow(null)
      setKpm(0)
      setActivity({ status: 'Active', idleSeconds: 0 })
    } catch (err) {
      console.error('[useFocusSession] stopTelemetry or stopCV failed:', err)
    }

    if (isBlockingSessionRef.current) {
      try {
        await window.focusEngineAPI.stopBlocking()
        setBlockingStatus('idle')
      } catch (err) {
        console.error('[useFocusSession] stopBlocking failed:', err)
      }
      isBlockingSessionRef.current = false
    }
  }, [])

  const {
    getElapsedSeconds,
    mode,
    sessionType,
    sessionStartTime,
    totalDurationSeconds
  } = timer

  // Finalizes the session by writing it to the SQLite database
  const finalizeSession = useCallback(async (
    completed: boolean,
    endReason: 'auto_complete' | 'manual_stop' | 'abandoned' | 'force_ended'
  ) => {
    if (hasSavedRef.current || !sessionIdRef.current) return
    hasSavedRef.current = true

    const actualDuration = getElapsedSeconds()
    const endTime = Date.now()

    console.log('[finalizeSession] debug:', {
      mode,
      sessionType,
      sessionStartTime,
      endTime,
      elapsedMs: endTime - sessionStartTime,
      actualDuration,
      getElapsedSecondsVal: getElapsedSeconds()
    })

    // Stop blocking system file writes
    await performBlockingCleanup()

    try {
      const saveArgs = mode === 'pomodoro'
        ? {
            sessionId: sessionIdRef.current,
            mode: 'pomodoro' as const,
            sessionType: sessionType as 'focus' | 'shortBreak' | 'longBreak',
            startTime: sessionStartTime,
            endTime,
            durationPlannedSec: totalDurationSeconds,
            durationActualSec: actualDuration,
            completed,
            endReason: endReason as 'auto_complete' | 'abandoned',
            autoPausedCount: autoPausedCountRef.current,
            pauseCount: pauseCountRef.current
          }
        : {
            sessionId: sessionIdRef.current,
            mode: 'standard' as const,
            sessionType: 'focus' as const,
            startTime: sessionStartTime,
            endTime,
            durationActualSec: actualDuration,
            completed,
            endReason: endReason as 'manual_stop' | 'force_ended',
            autoPausedCount: autoPausedCountRef.current,
            pauseCount: pauseCountRef.current
          }

      await window.focusEngineAPI.saveSession(saveArgs)

      if (sessionType === 'focus') {
        setSummary({
          session_id: sessionIdRef.current,
          session_mode: mode,
          session_type: sessionType,
          start_time: sessionStartTime,
          end_time: endTime,
          duration_planned_sec: totalDurationSeconds || null,
          duration_actual_sec: actualDuration,
          completed,
          end_reason: endReason,
          apps_killed_count: appsKilled.length,
          apps_killed: appsKilled,
          auto_paused_count: autoPausedCountRef.current
        })
      } else {
        // If it was a break session, directly reset back to idle focus
        timer.reset()
      }
    } catch (err) {
      console.error('[useFocusSession] Failed to save session:', err)
      if (sessionType !== 'focus') {
        timer.reset()
      }
    }
  }, [
    getElapsedSeconds,
    mode,
    sessionType,
    sessionStartTime,
    totalDurationSeconds,
    appsKilled,
    performBlockingCleanup,
    timer
  ])

  // Listen to live telemetry updates from the main process
  useEffect(() => {
    const unsubscribe = window.focusEngineAPI.onActiveWindowUpdate((info) => {
      setActiveWindow(info)
    })
    const unsubscribeKpm = window.focusEngineAPI.onKpmUpdate((kpmVal) => {
      setKpm(kpmVal)
    })
    const unsubscribeActivity = window.focusEngineAPI.onActivityUpdate((act) => {
      setActivity(act)
    })
    const unsubscribeAutoPause = window.focusEngineAPI.onSessionAutoPause(() => {
      pauseCountRef.current++
      timer.pause()
      setShowAutoPauseModal(true)
    })
    const unsubscribeForceEnd = window.focusEngineAPI.onSessionForceEnd(async () => {
      timer.stop()
      await finalizeSession(false, 'force_ended')
      setShowForceEndModal(true)
    })
    const unsubscribeBufferUpdate = window.focusEngineAPI.onFocusBufferUpdate((data) => {
      if (data.autoPausedCount !== undefined) {
        autoPausedCountRef.current = data.autoPausedCount
      }
    })
    return () => {
      unsubscribe()
      unsubscribeKpm()
      unsubscribeActivity()
      unsubscribeAutoPause()
      unsubscribeForceEnd()
      unsubscribeBufferUpdate()
    }
  }, [timer, finalizeSession])

  // Subscribe to real-time health checker warnings
  useEffect(() => {
    if (timer.state === 'running' || timer.state === 'paused') {
      const unsub = window.focusEngineAPI.onTelemetryHealthWarning((status) => {
        if (!status.window || !status.kpm || !status.mouse) {
          setHealthStatus(status)
        } else {
          setHealthStatus(null)
        }
      })
      return () => {
        unsub()
        setHealthStatus(null)
      }
    } else {
      setHealthStatus(null)
      return undefined
    }
  }, [timer.state])

  // Watch for natural Pomodoro countdown completion at 0:00
  useEffect(() => {
    if (timer.state === 'completed' && !hasSavedRef.current) {
      // Natural countdown completion is always successful and auto_completed
      if (timer.mode === 'pomodoro') {
        finalizeSession(true, 'auto_complete')
      }
    }
  }, [timer.state, timer.mode, finalizeSession])

  // Active mitigation: periodically check and close blacklisted apps during focus sessions
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null

    const runActiveAppBlocking = async () => {
      if (timer.state === 'running' && isBlockingSessionRef.current && sessionIdRef.current) {
        try {
          const res = await window.focusEngineAPI.killBlacklistedApps(sessionIdRef.current)
          if (res.success && res.data && res.data.length > 0) {
            setAppsKilled((prev) => {
              // Merge and remove duplicate app names
              const updated = Array.from(new Set([...prev, ...res.data!]))
              return updated
            })
          }
        } catch (err) {
          console.error('[useFocusSession] Background mitigation app kill failed:', err)
        }
      }
    }

    if (timer.state === 'running' && isBlockingSessionRef.current) {
      // Run once immediately, then check every 30 seconds
      runActiveAppBlocking()
      intervalId = setInterval(runActiveAppBlocking, 30000)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [timer.state])

  // Starts a pomodoro session
  const startPomodoroSession = useCallback(async (type: SessionType, durationMinutes: number) => {
    timer.reset()
    setSummary(null)
    setAppsKilled([])
    setBlockingError(null)
    setBlockingStatus('idle')
    
    sessionIdRef.current = crypto.randomUUID()
    
    // Only block if it is a focus session (breaks do not block)
    const shouldBlock = type === 'focus'
    isBlockingSessionRef.current = shouldBlock

    if (shouldBlock) {
      setBlockingStatus('blocking')
      try {
        const res = await window.focusEngineAPI.startBlocking()
        if (!res.success && res.error) {
          setBlockingStatus('error')
          setBlockingError(res.error)
        }
      } catch (err: any) {
        setBlockingStatus('error')
        setBlockingError(err.message || String(err))
      }

      try {
        const res = await window.focusEngineAPI.killBlacklistedApps(sessionIdRef.current)
        if (res.success && res.data) {
          setAppsKilled(res.data)
        }
      } catch (err) {
        console.error('[useFocusSession] Failed to kill blacklisted apps:', err)
      }
    }

    autoPausedCountRef.current = 0
    pauseCountRef.current = 0

    // Start active window tracking telemetry and CV Engine ONLY for focus sessions
    if (type === 'focus') {
      try {
        await window.focusEngineAPI.startTelemetry(sessionIdRef.current, 'pomodoro')
        const cvEnabledRes = await window.focusEngineAPI.getCVEnabled()
        if (cvEnabledRes.success && cvEnabledRes.data) {
          await window.focusEngineAPI.startCV(sessionIdRef.current)
        } else {
          console.log('[useFocusSession] Webcam attention tracking is disabled in settings. Skipping startCV.')
        }
      } catch (err) {
        console.error('[useFocusSession] Failed to start telemetry/CV:', err)
      }
    } else {
      console.log('[useFocusSession] Break session started. Telemetry, CV, and Buffer loops are disabled.')
    }

    timer.startPomodoro(type, durationMinutes)
    hasSavedRef.current = false
  }, [timer])

  // Starts an open-ended standard session
  const startStandardSession = useCallback(async () => {
    timer.reset()
    setSummary(null)
    setAppsKilled([])
    setBlockingError(null)
    setBlockingStatus('blocking')

    sessionIdRef.current = crypto.randomUUID()
    isBlockingSessionRef.current = true

    autoPausedCountRef.current = 0
    pauseCountRef.current = 0

    try {
      const res = await window.focusEngineAPI.startBlocking()
      if (!res.success && res.error) {
        setBlockingStatus('error')
        setBlockingError(res.error)
      }
    } catch (err: any) {
      setBlockingStatus('error')
      setBlockingError(err.message || String(err))
    }

    try {
      const res = await window.focusEngineAPI.killBlacklistedApps(sessionIdRef.current)
      if (res.success && res.data) {
        setAppsKilled(res.data)
      }
    } catch (err) {
      console.error('[useFocusSession] Failed to kill blacklisted apps:', err)
    }

    // Start active window tracking telemetry and CV Engine
    try {
      await window.focusEngineAPI.startTelemetry(sessionIdRef.current, 'standard')
      const cvEnabledRes = await window.focusEngineAPI.getCVEnabled()
      if (cvEnabledRes.success && cvEnabledRes.data) {
        await window.focusEngineAPI.startCV(sessionIdRef.current)
      } else {
        console.log('[useFocusSession] Webcam attention tracking is disabled in settings. Skipping startCV.')
      }
    } catch (err) {
      console.error('[useFocusSession] Failed to start telemetry/CV:', err)
    }

    timer.startStandard()
    hasSavedRef.current = false
  }, [timer])

  const pauseSession = useCallback(async () => {
    pauseCountRef.current++
    await window.focusEngineAPI.pauseBuffer()
    timer.pause()
  }, [timer])

  const resumeSession = useCallback(async () => {
    await window.focusEngineAPI.resumeBuffer()
    timer.resume()
  }, [timer])

  // Stop session (works for both modes — manual stop or early end)
  const stopSession = useCallback(async () => {
    timer.stop()
    // Standard mode manual stop counts as completed successfully.
    // Pomodoro manual stop counts as abandoned early.
    const completed = timer.mode === 'standard'
    const endReason = timer.mode === 'standard' ? 'manual_stop' : 'abandoned'
    await finalizeSession(completed, endReason)
  }, [timer, finalizeSession])

  const resetSession = useCallback(async () => {
    if (timer.mode === 'standard') {
      console.warn('[useFocusSession] Warning: resetSession is a no-op in standard mode. Standard sessions must be stopped using stopSession.')
      return
    }
    // Finalize session first while we still have the elapsed timer context
    await finalizeSession(false, 'abandoned')
    timer.reset()
  }, [timer, finalizeSession])

  const clearSummary = useCallback(() => {
    const prevSummary = summary
    setSummary(null)

    if (prevSummary && prevSummary.completed && prevSummary.session_mode === 'pomodoro' && prevSummary.session_type === 'focus') {
      // Automatically transition and start a 5-minute short break session
      startPomodoroSession('shortBreak', 5)
    }
  }, [summary, startPomodoroSession])

  const setMode = useCallback((newMode: SessionMode) => {
    timer.setMode(newMode)
    timer.reset()
    setSummary(null)
    setAppsKilled([])
    setBlockingError(null)
    setBlockingStatus('idle')
    setKpm(0)
    setActivity({ status: 'Active', idleSeconds: 0 })
  }, [timer])

  return {
    mode: timer.mode,
    setMode,
    sessionId: sessionIdRef.current,
    timerState: timer.state,
    hoursElapsedOrRemaining: timer.hoursElapsedOrRemaining,
    minutesElapsedOrRemaining: timer.minutesElapsedOrRemaining,
    secondsElapsedOrRemaining: timer.secondsElapsedOrRemaining,
    progress: timer.progress,
    sessionType: timer.sessionType,
    blockingStatus,
    blockingError,
    appsKilled,
    summary,
    activeWindow,
    kpm,
    activity,
    healthStatus,
    startPomodoroSession,
    startStandardSession,
    pauseSession,
    resumeSession,
    stopSession,
    resetSession,
    clearSummary,
    showAutoPauseModal,
    setShowAutoPauseModal,
    showForceEndModal,
    setShowForceEndModal,
    handleResumeFromAutoPause: useCallback(async () => {
      await window.focusEngineAPI.resumeBuffer()
      timer.resume()
      setShowAutoPauseModal(false)
    }, [timer]),
    handleEndFromAutoPause: useCallback(async () => {
      setShowAutoPauseModal(false)
      await stopSession()
    }, [stopSession])
  }
}
