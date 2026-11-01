import { useEffect, useState } from 'react'

export interface BufferInfo {
  value: number
  state: 'focused' | 'warning' | 'critical' | 'paused'
  history: { timestamp: number; value: number }[]
  signals: {
    cv: number
    keyboard: number
    mouse: number
    window: number
  }
  isWarmup?: boolean
}

/**
 * Hook to manage live focus buffer states and subscription updates.
 */
export function useFocusBuffer(isActive: boolean): BufferInfo {
  const [value, setValue] = useState<number>(100)
  const [state, setState] = useState<BufferInfo['state']>('focused')
  const [history, setHistory] = useState<BufferInfo['history']>([])
  const [isWarmup, setIsWarmup] = useState<boolean>(false)
  const [signals, setSignals] = useState<BufferInfo['signals']>({
    cv: 1.0,
    keyboard: 1.0,
    mouse: 1.0,
    window: 1.0
  })

  // 1. Fetch initial state when active
  useEffect(() => {
    if (!isActive) {
      setValue(100)
      setState('focused')
      setHistory([])
      setIsWarmup(false)
      setSignals({ cv: 1.0, keyboard: 1.0, mouse: 1.0, window: 1.0 })
      return
    }

    const fetchCurrent = async () => {
      try {
        const res = await window.focusEngineAPI.getCurrentFocusBuffer()
        if (res.success && res.data) {
          setValue(res.data.value)
          setState(res.data.state as BufferInfo['state'])
          setHistory(res.data.history)
          setIsWarmup(res.data.isWarmup ?? false)
          if (res.data.signals) {
            setSignals(res.data.signals)
          }
        }
      } catch (err) {
        console.error('[useFocusBuffer] Failed to fetch current buffer:', err)
      }
    }

    fetchCurrent()
  }, [isActive])

  // 2. Listen to real-time updates
  useEffect(() => {
    if (!isActive) return

    const unsubscribe = window.focusEngineAPI.onFocusBufferUpdate((data) => {
      setValue(data.value)
      setState(data.state as BufferInfo['state'])
      setHistory(data.history)
      setIsWarmup(data.isWarmup ?? false)
      if (data.signals) {
        setSignals(data.signals)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [isActive])

  return { value, state, history, signals, isWarmup }
}
