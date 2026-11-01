import { useEffect, useState, useRef } from 'react'

export interface LiveTelemetryInfo {
  activeWindow: {
    appName: string
    windowTitle: string
    domain: string
    category: 'productive' | 'distraction' | 'neutral' | 'unknown'
  } | null
  kpm: number
  clicks: number
  movements: number
  idleSeconds: number
  timeline: ('productive' | 'distraction' | 'neutral' | 'unknown')[]
}

interface TelemetryTick {
  category: 'productive' | 'distraction' | 'neutral' | 'unknown'
  timestamp: number
}

/**
 * Custom hook to aggregate live window focus, KPM, mouse activity, and a rolling 5-minute timeline.
 */
export function useLiveTelemetry(sessionId: string | null, isActive: boolean): LiveTelemetryInfo {
  const [activeWindow, setActiveWindow] = useState<LiveTelemetryInfo['activeWindow']>(null)
  const [kpm, setKpm] = useState<number>(0)
  const [clicks, setClicks] = useState<number>(0)
  const [movements, setMovements] = useState<number>(0)
  const [idleSeconds, setIdleSeconds] = useState<number>(0)
  const [ticks, setTicks] = useState<TelemetryTick[]>([])

  // Store ticks ref to prevent stale closures in event listeners
  const ticksRef = useRef<TelemetryTick[]>([])
  ticksRef.current = ticks

  // 1. Fetch history when sessionId is set to populate initial timeline ticks
  useEffect(() => {
    if (!sessionId) {
      setTicks([])
      setActiveWindow(null)
      setKpm(0)
      setClicks(0)
      setMovements(0)
      setIdleSeconds(0)
      return
    }

    const fetchHistory = async () => {
      try {
        const res = await window.focusEngineAPI.getWindowHistory(sessionId)
        if (res.success && res.data) {
          const historicalTicks: TelemetryTick[] = res.data.map((t: any) => ({
            category: t.category || 'unknown',
            timestamp: t.timestamp
          }))
          setTicks(historicalTicks)
        }
      } catch (err) {
        console.error('[useLiveTelemetry] Failed to load focus ticks history:', err)
      }
    }

    fetchHistory()
  }, [sessionId])

  // 2. Subscribe to real-time events from IPC
  useEffect(() => {
    if (!isActive || !sessionId) return

    const unsubWindow = window.focusEngineAPI.onActiveWindowUpdate((info) => {
      setActiveWindow(info)
      // Accumulate tick
      const newTick: TelemetryTick = {
        category: info.category,
        timestamp: Date.now()
      }
      setTicks((prev) => [...prev, newTick])
    })

    const unsubKpm = window.focusEngineAPI.onKpmUpdate((kpmVal) => {
      setKpm(kpmVal)
    })

    const unsubActivity = window.focusEngineAPI.onActivityUpdate((info) => {
      setIdleSeconds(info.idleSeconds)
    })

    return () => {
      unsubWindow()
      unsubKpm()
      unsubActivity()
    }
  }, [isActive, sessionId])

  // 3. Poll every 3 seconds for active window fallback and live mouse counts
  useEffect(() => {
    if (!isActive || !sessionId) return

    const pollStatus = async () => {
      try {
        // Fallback active window poll
        const winRes = await window.focusEngineAPI.getLatestWindow()
        if (winRes.success && winRes.data) {
          setActiveWindow(winRes.data)
        }

        // Live mouse counts poll
        const mouseRes = await window.focusEngineAPI.getLiveMouseCounts()
        if (mouseRes.success && mouseRes.data) {
          setClicks(mouseRes.data.clicks)
          setMovements(mouseRes.data.movements)
        }
      } catch (err) {
        console.error('[useLiveTelemetry] Polling failed:', err)
      }
    }

    // Trigger immediately
    pollStatus()

    const intervalId = setInterval(pollStatus, 3000)
    return () => clearInterval(intervalId)
  }, [isActive, sessionId])

  // 4. Compute 5-minute timeline strip (one dominant category per minute block)
  const computeTimeline = (): ('productive' | 'distraction' | 'neutral' | 'unknown')[] => {
    const now = Date.now()
    const result: ('productive' | 'distraction' | 'neutral' | 'unknown')[] = []

    // Check each of the 5 one-minute bins (ending at "now")
    for (let i = 4; i >= 0; i--) {
      const binStart = now - (i + 1) * 60 * 1000
      const binEnd = now - i * 60 * 1000

      // Filter ticks within this minute bin
      const binTicks = ticks.filter((t) => t.timestamp >= binStart && t.timestamp < binEnd)

      if (binTicks.length === 0) {
        result.push('unknown')
        continue
      }

      // Count occurrences in bin
      const counts = binTicks.reduce(
        (acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )

      // Find the dominant category in this bin
      let dominant: 'productive' | 'distraction' | 'neutral' | 'unknown' = 'unknown'
      let maxCount = 0
      for (const [cat, count] of Object.entries(counts)) {
        if (count > maxCount) {
          maxCount = count
          dominant = cat as any
        }
      }
      result.push(dominant)
    }

    return result
  }

  return {
    activeWindow,
    kpm,
    clicks,
    movements,
    idleSeconds,
    timeline: computeTimeline()
  }
}
