import { useState, useEffect, useCallback } from 'react'

export interface HeatmapCell {
  dayOfWeek: number
  hourOfDay: number
  avgScore: number
  sessionCount: number
}

export interface StreakData {
  currentStreak: number
  longestStreak: number
  isActive: boolean
  activeDates: string[]
}

export interface ProductivitySummary {
  bestHour: { hour: number; avgScore: number } | null
  worstHour: { hour: number; avgScore: number } | null
  mostProductiveDay: { dayOfWeek: number; avgScore: number } | null
  longestSession: { sessionId: string; durationActualSec: number; startTime: number } | null
  longestFocusStreakMinutes: number
  averageFocusScore: number | null
  averageSessionDurationSec: number | null
  totalSessionsCompleted: number
  totalFocusedMinutes: number
}

export interface RecommendationResult {
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
}

export interface AnalyticsData {
  heatmap: HeatmapCell[]
  streaks: StreakData
  productivity: ProductivitySummary
  recommendations: RecommendationResult
}

export function useAnalyticsData() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [heatmapRes, streaksRes, productivityRes, recommendationsRes] = await Promise.all([
        window.focusEngineAPI.analytics.getHeatmap(),
        window.focusEngineAPI.analytics.getStreaks(),
        window.focusEngineAPI.analytics.getProductivitySummary(),
        window.focusEngineAPI.analytics.getRecommendations()
      ])

      if (!heatmapRes.success || !heatmapRes.data) {
        throw new Error(heatmapRes.error || 'Failed to load heatmap data')
      }
      if (!streaksRes.success || !streaksRes.data) {
        throw new Error(streaksRes.error || 'Failed to load streak data')
      }
      if (!productivityRes.success || !productivityRes.data) {
        throw new Error(productivityRes.error || 'Failed to load productivity stats')
      }
      if (!recommendationsRes.success || !recommendationsRes.data) {
        throw new Error(recommendationsRes.error || 'Failed to load recommendations')
      }

      setData({
        heatmap: heatmapRes.data,
        streaks: streaksRes.data,
        productivity: productivityRes.data,
        recommendations: recommendationsRes.data
      })
    } catch (err: any) {
      console.error('[useAnalyticsData]', err)
      setError(err.message || 'An error occurred while loading analytics data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refetch: fetchData
  }
}
