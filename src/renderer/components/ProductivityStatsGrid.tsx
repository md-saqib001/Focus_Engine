import React from 'react'
import { StatCard } from './ui/StatCard'

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

interface ProductivityStatsGridProps {
  data: ProductivitySummary
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM'
  if (hour === 12) return '12 PM'
  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`
}

function formatDurationSec(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatDurationMin(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export const ProductivityStatsGrid: React.FC<ProductivityStatsGridProps> = ({ data }) => {
  // Determine average focus score color dynamically
  const getAvgScoreColor = (score: number | null): string => {
    if (score === null) return '#818cf8' // Indigo fallback
    if (score >= 80) return '#10b981' // Green
    if (score >= 50) return '#f59e0b' // Amber
    return '#ef4444' // Red
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px'
      }}
    >
      <StatCard
        label={data.bestHour ? `Best Hour · ${formatHour(data.bestHour.hour)}` : 'Best Hour'}
        value={data.bestHour ? Math.round(data.bestHour.avgScore) : '—'}
        unit={data.bestHour ? 'score' : 'no data yet'}
        color="#10b981" // green semantics
      />
      <StatCard
        label={data.worstHour ? `Worst Hour · ${formatHour(data.worstHour.hour)}` : 'Worst Hour'}
        value={data.worstHour ? Math.round(data.worstHour.avgScore) : '—'}
        unit={data.worstHour ? 'score' : 'no data yet'}
        color="#ef4444" // red semantics
      />
      <StatCard
        label="Most Productive Day"
        value={data.mostProductiveDay ? DAYS[data.mostProductiveDay.dayOfWeek] : '—'}
        unit={data.mostProductiveDay ? `${Math.round(data.mostProductiveDay.avgScore)} avg score` : 'no data yet'}
        color="#818cf8"
      />
      <StatCard
        label="Longest Session"
        value={data.longestSession ? formatDurationSec(data.longestSession.durationActualSec) : '—'}
        unit={data.longestSession ? undefined : 'no data yet'}
        color="#f59e0b" // amber duration
      />
      <StatCard
        label="Longest Focus Streak"
        value={data.longestFocusStreakMinutes > 0 ? formatDurationMin(data.longestFocusStreakMinutes) : '—'}
        unit={data.longestFocusStreakMinutes > 0 ? 'continuous focus' : 'no data yet'}
        color="#10b981" // green positive metric
      />
      <StatCard
        label="Avg Focus Score"
        value={data.averageFocusScore !== null ? data.averageFocusScore : '—'}
        unit={data.averageFocusScore !== null ? '/ 100' : 'no data yet'}
        color={getAvgScoreColor(data.averageFocusScore)} // Dynamic score-based color
      />
      <StatCard
        label="Avg Session Duration"
        value={data.averageSessionDurationSec !== null ? formatDurationSec(data.averageSessionDurationSec) : '—'}
        color="#f59e0b" // amber duration
      />
      <StatCard label="Sessions Completed" value={data.totalSessionsCompleted} unit="total" color="#818cf8" />
      <StatCard
        label="Total Focused Time"
        value={data.totalFocusedMinutes > 0 ? formatDurationMin(data.totalFocusedMinutes) : '—'}
        color="#10b981" // green positive metric
      />
    </div>
  )
}
