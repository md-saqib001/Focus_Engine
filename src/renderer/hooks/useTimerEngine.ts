import { useState, useEffect, useRef, useCallback } from 'react'
import { SessionMode, SessionType, TimerState } from '../types/timer'

export const useTimerEngine = () => {
  const [mode, setMode] = useState<SessionMode>('pomodoro')
  const [state, setState] = useState<TimerState>('idle')
  const [sessionType, setSessionType] = useState<SessionType | null>(null)
  
  // Holds current remaining seconds (pomodoro) or elapsed seconds (standard)
  const [time, setTime] = useState<number>(0)
  
  // Total duration of the current pomodoro session
  const [totalDurationSeconds, setTotalDurationSeconds] = useState<number>(0)

  // Track the actual start timestamp of the entire session (uses state to prevent stale reads)
  const [sessionStartTime, setSessionStartTime] = useState<number>(0)

  // Anchor refs to track precise elapsed duration against CPU throttling
  const startTimeRef = useRef<number>(0)
  const accumulatedSecondsRef = useRef<number>(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Clear interval helper
  const clearIntervalRef = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => clearIntervalRef()
  }, [clearIntervalRef])

  // Helper: compute total elapsed seconds right now
  const getElapsedSeconds = useCallback((): number => {
    if (startTimeRef.current === 0) return accumulatedSecondsRef.current
    const elapsedSinceLastStart = Math.floor((Date.now() - startTimeRef.current) / 1000)
    return accumulatedSecondsRef.current + elapsedSinceLastStart
  }, [])

  // Core tick updater calculating precise time from Date timestamps
  const tick = useCallback(() => {
    const totalElapsedSeconds = getElapsedSeconds()

    if (mode === 'pomodoro') {
      const remaining = totalDurationSeconds - totalElapsedSeconds
      if (remaining <= 0) {
        clearIntervalRef()
        setTime(0)
        setState('completed')
      } else {
        setTime(remaining)
      }
    } else {
      setTime(totalElapsedSeconds)
    }
  }, [mode, totalDurationSeconds, clearIntervalRef, getElapsedSeconds])

  // Latest callback ref pattern to avoid stale closures in setInterval
  const tickRef = useRef<() => void>(tick)
  useEffect(() => {
    tickRef.current = tick
  }, [tick])

  // Start standard mode (stopwatch)
  const startStandard = useCallback(() => {
    clearIntervalRef()
    setMode('standard')
    setSessionType(null)
    setState('running')
    
    const now = Date.now()
    setSessionStartTime(now)
    startTimeRef.current = now
    accumulatedSecondsRef.current = 0
    setTime(0)
    setTotalDurationSeconds(0)

    intervalRef.current = setInterval(() => {
      tickRef.current()
    }, 200)
  }, [clearIntervalRef])

  // Start pomodoro mode (countdown)
  const startPomodoro = useCallback((type: SessionType, durationMinutes: number) => {
    clearIntervalRef()
    setMode('pomodoro')
    setSessionType(type)
    setState('running')
    
    const durationSeconds = durationMinutes * 60
    const now = Date.now()
    setSessionStartTime(now)
    startTimeRef.current = now
    accumulatedSecondsRef.current = 0
    setTime(durationSeconds)
    setTotalDurationSeconds(durationSeconds)

    intervalRef.current = setInterval(() => {
      tickRef.current()
    }, 200)
  }, [clearIntervalRef])

  // Pause session
  const pause = useCallback(() => {
    if (state !== 'running') return
    clearIntervalRef()
    
    const elapsedSinceLastStart = Math.floor((Date.now() - startTimeRef.current) / 1000)
    accumulatedSecondsRef.current += elapsedSinceLastStart
    startTimeRef.current = 0
    
    setState('paused')
  }, [state, clearIntervalRef])

  // Resume session
  const resume = useCallback(() => {
    if (state !== 'paused') return
    setState('running')

    startTimeRef.current = Date.now()
    intervalRef.current = setInterval(() => {
      tickRef.current()
    }, 200)
  }, [state, clearIntervalRef])

  // Manual end / Stop session
  const stop = useCallback(() => {
    clearIntervalRef()
    setState('completed')
  }, [clearIntervalRef])

  // Reset / Abort session
  const reset = useCallback(() => {
    clearIntervalRef()
    setState('idle')
    setTime(0)
    setTotalDurationSeconds(0)
    accumulatedSecondsRef.current = 0
    startTimeRef.current = 0
    setSessionStartTime(0)
  }, [clearIntervalRef])

  const forceEnd = useCallback(() => {
    clearIntervalRef()
    setState('completed')
  }, [clearIntervalRef])

  // Hours, minutes, and seconds elapsed or remaining
  const hours = Math.floor(time / 3600)
  const minutes = Math.floor((time % 3600) / 60)
  const seconds = time % 60

  const progress = mode === 'pomodoro' && totalDurationSeconds > 0 
    ? time / totalDurationSeconds 
    : null

  return {
    mode,
    setMode,
    state,
    sessionType,
    hoursElapsedOrRemaining: hours,
    minutesElapsedOrRemaining: minutes,
    secondsElapsedOrRemaining: seconds,
    progress,
    startPomodoro,
    startStandard,
    pause,
    resume,
    stop,
    reset,
    forceEnd,
    getElapsedSeconds,
    sessionStartTime,
    totalDurationSeconds
  }
}
