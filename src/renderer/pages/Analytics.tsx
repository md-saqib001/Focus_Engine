import React from 'react'
import { useAnalyticsData } from '../hooks/useAnalyticsData'
import { RecommendationsPanel } from '../components/RecommendationsPanel'
import { StreakDisplay } from '../components/StreakDisplay'
import { ProductivityStatsGrid } from '../components/ProductivityStatsGrid'
import { FocusHeatmap } from '../components/FocusHeatmap'
import { Download, Sparkles, BarChart2, AlertCircle } from 'lucide-react'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Inline styles for the skeleton pulse animation
const skeletonStyles = `
@keyframes pulse-skeleton-anim {
  0% { opacity: 0.5; background-color: #1a1a29; }
  50% { opacity: 1; background-color: #27273d; }
  100% { opacity: 0.5; background-color: #1a1a29; }
}
.pulse-skeleton {
  animation: pulse-skeleton-anim 1.6s infinite ease-in-out;
}
`

const SkeletonBlock: React.FC<{ width: string; height: string; borderRadius?: string; marginBottom?: string }> = ({
  width,
  height,
  borderRadius = '8px',
  marginBottom = '0px'
}) => (
  <div
    className="pulse-skeleton"
    style={{
      width,
      height,
      borderRadius,
      marginBottom,
      backgroundColor: '#181824'
    }}
  />
)

export const Analytics: React.FC = () => {
  const { data, loading, error } = useAnalyticsData()

  // Function to download data blobs
  const downloadFile = (content: string, fileName: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Export as JSON
  const handleExportJSON = () => {
    if (!data) return
    const jsonString = JSON.stringify(data, null, 2)
    downloadFile(jsonString, 'focus-engine-analytics.json', 'application/json;charset=utf-8;')
  }

  // Export as CSV
  const handleExportCSV = () => {
    if (!data) return
    let csvContent = '\uFEFF' // UTF-8 BOM so Excel opens it with correct formatting
    
    // 1. Productivity Summary Section
    csvContent += '--- PRODUCTIVITY SUMMARY ---\r\n'
    csvContent += 'Metric,Value,Unit\r\n'
    
    const p = data.productivity
    const formatH = (hour: number) => {
      if (hour === 0) return '12 AM'
      if (hour === 12) return '12 PM'
      return hour > 12 ? `${hour - 12} PM` : `${hour} AM`
    }
    const formatSec = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`
    
    csvContent += `Total Sessions Completed,${p.totalSessionsCompleted},sessions\r\n`
    csvContent += `Average Focus Score,${p.averageFocusScore ?? '—'},%\r\n`
    csvContent += `Average Session Duration,${p.averageSessionDurationSec ? formatSec(p.averageSessionDurationSec) : '—'},duration\r\n`
    csvContent += `Total Focused Time,${p.totalFocusedMinutes},minutes\r\n`
    csvContent += `Longest Session Duration,${p.longestSession ? formatSec(p.longestSession.durationActualSec) : '—'},duration\r\n`
    csvContent += `Longest Focus Streak,${p.longestFocusStreakMinutes},minutes\r\n`
    csvContent += `Best Hour,${p.bestHour ? formatH(p.bestHour.hour) : '—'},hour\r\n`
    csvContent += `Worst Hour,${p.worstHour ? formatH(p.worstHour.hour) : '—'},hour\r\n`
    csvContent += `Most Productive Day,${p.mostProductiveDay ? DAYS[p.mostProductiveDay.dayOfWeek] : '—'},day\r\n`
    
    csvContent += '\r\n'
    
    // 2. Heatmap Data Section
    csvContent += '--- FOCUS HEATMAP DATA ---\r\n'
    csvContent += 'Day of Week,Hour of Day,Average Score,Session Count\r\n'
    
    data.heatmap.forEach((cell) => {
      csvContent += `"${DAYS[cell.dayOfWeek]}",${formatH(cell.hourOfDay)},${cell.avgScore},${cell.sessionCount}\r\n`
    })
    
    downloadFile(csvContent, 'focus-engine-analytics.csv', 'text/csv;charset=utf-8;')
  }

  // 1. Loading state (premium skeleton loaders)
  if (loading) {
    return (
      <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
        <style>{skeletonStyles}</style>
        
        {/* Header Skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', alignItems: 'center' }}>
          <div>
            <SkeletonBlock width="180px" height="28px" marginBottom="8px" />
            <SkeletonBlock width="320px" height="16px" />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <SkeletonBlock width="110px" height="38px" borderRadius="10px" />
            <SkeletonBlock width="110px" height="38px" borderRadius="10px" />
          </div>
        </div>

        {/* Recommendations Skeleton */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
          <SkeletonBlock width="220px" height="20px" marginBottom="12px" />
          <SkeletonBlock width="100%" height="70px" borderRadius="12px" />
          <SkeletonBlock width="100%" height="70px" borderRadius="12px" />
          <SkeletonBlock width="100%" height="70px" borderRadius="12px" />
        </div>

        {/* Streak Skeleton */}
        <div style={{ backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '16px', padding: '32px', marginBottom: '24px' }}>
          <SkeletonBlock width="100px" height="20px" marginBottom="16px" />
          <div style={{ display: 'flex', gap: '40px', marginBottom: '24px' }}>
            <div>
              <SkeletonBlock width="80px" height="14px" marginBottom="6px" />
              <SkeletonBlock width="160px" height="32px" />
            </div>
            <div>
              <SkeletonBlock width="80px" height="14px" marginBottom="6px" />
              <SkeletonBlock width="100px" height="24px" />
            </div>
          </div>
          <SkeletonBlock width="120px" height="14px" marginBottom="8px" />
          <div style={{ display: 'flex', gap: '6px' }}>
            {Array.from({ length: 14 }).map((_, i) => (
              <SkeletonBlock key={i} width="20px" height="20px" borderRadius="5px" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // 2. Error state
  if (error || !data) {
    return (
      <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto', color: '#ef4444', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <AlertCircle size={24} />
          <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Analytics Load Failure</h2>
        </div>
        <p style={{ color: '#94a3b8' }}>{error || 'Unable to retrieve your focus metrics.'}</p>
      </div>
    )
  }

  const completedSessions = data.productivity.totalSessionsCompleted

  // 3. Unified Empty State: <3 completed sessions shows combined message
  if (completedSessions < 3) {
    const sessionsAway = 3 - completedSessions
    return (
      <div
        style={{
          padding: '64px 32px',
          maxWidth: '560px',
          margin: '80px auto',
          textAlign: 'center',
          fontFamily: 'Inter, sans-serif',
          background: '#0f0f17',
          borderRadius: '24px',
          border: '1px solid #1e1e2f',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px'
        }}
      >
        <div
          style={{
            background: 'rgba(129, 140, 248, 0.1)',
            borderRadius: '50%',
            width: '72px',
            height: '72px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818cf8',
            marginBottom: '8px'
          }}
        >
          <BarChart2 size={36} />
        </div>

        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
          Analytics Locked
        </h2>

        <p style={{ fontSize: '15px', color: '#94a3b8', lineHeight: '1.6', margin: 0 }}>
          Complete at least **3 focus sessions** to build your baseline analytics. We need a minimum amount of data before we can format heatmaps, calculate streaks, or compile statistics.
        </p>

        <div style={{ width: '100%', maxWidth: '340px', marginTop: '12px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '13px',
              color: '#818cf8',
              marginBottom: '8px',
              fontWeight: 600
            }}
          >
            <span>REQUIRED SESSIONS</span>
            <span>{completedSessions} / 3 completed</span>
          </div>
          <div
            style={{
              width: '100%',
              height: '10px',
              backgroundColor: '#1e1e2f',
              borderRadius: '5px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${(completedSessions / 3) * 100}%`,
                height: '100%',
                backgroundColor: '#818cf8',
                borderRadius: '5px',
                transition: 'width 0.4s ease'
              }}
            />
          </div>
          <span
            style={{
              display: 'block',
              marginTop: '12px',
              fontSize: '13px',
              color: '#f59e0b',
              fontWeight: 500
            }}
          >
            🔥 You are only {sessionsAway} session{sessionsAway === 1 ? '' : 's'} away!
          </span>
        </div>
      </div>
    )
  }

  // 4. Normal render (3+ sessions)
  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Header with Title and Export Options */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px', color: '#f8fafc', margin: 0 }}>
            Analytics
          </h1>
          <p style={{ color: '#64748b', fontSize: '15px', margin: '4px 0 0 0' }}>
            Visualize your focus patterns and productivity trends over time.
          </p>
        </div>

        {/* Export Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleExportCSV}
            style={{
              backgroundColor: '#181824',
              border: '1.5px solid #272738',
              borderRadius: '10px',
              color: '#94a3b8',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#383852'
              e.currentTarget.style.color = '#f8fafc'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#272738'
              e.currentTarget.style.color = '#94a3b8'
            }}
          >
            <Download size={15} />
            CSV
          </button>
          <button
            onClick={handleExportJSON}
            style={{
              backgroundColor: '#181824',
              border: '1.5px solid #272738',
              borderRadius: '10px',
              color: '#94a3b8',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#383852'
              e.currentTarget.style.color = '#f8fafc'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#272738'
              e.currentTarget.style.color = '#94a3b8'
            }}
          >
            <Download size={15} />
            JSON
          </button>
        </div>
      </div>

      {/* Unified Banner if sessions are 3-10 */}
      {completedSessions < 10 && (
        <div
          style={{
            background: 'linear-gradient(90deg, rgba(129, 140, 248, 0.08) 0%, rgba(129, 140, 248, 0.03) 100%)',
            border: '1.5px solid rgba(129, 140, 248, 0.2)',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px',
            fontSize: '13px',
            color: '#c7d2fe'
          }}
        >
          <Sparkles size={16} style={{ color: '#818cf8', flexShrink: 0 }} />
          <span>
            Gathering focus insights. Currently based on <strong>{completedSessions} sessions</strong>. Complete <strong>{10 - completedSessions} more</strong> to unlock full personalized recommendations!
          </span>
        </div>
      )}

      {/* COHESIVE LAYOUT: Recommendations → Streaks → Productivity Stats → Heatmap */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* 1. Recommendations Panel */}
        <div>
          <RecommendationsPanel 
            data={data.recommendations} 
            overallScore={data.productivity.averageFocusScore} 
          />
        </div>

        {/* 2. Streak Display Panel */}
        <div
          style={{
            background: '#0f0f17',
            borderRadius: '16px',
            padding: '32px',
            border: '1px solid #1e1e2f',
            boxShadow: '0 4px 24px rgba(0,0,0,0.2)'
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc', marginBottom: '16px', marginTop: 0 }}>
            Streaks
          </h2>
          <StreakDisplay data={data.streaks} />
        </div>

        {/* 3. Productivity Stats Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
            Productivity Summary
          </h2>
          <ProductivityStatsGrid data={data.productivity} />
        </div>

        {/* 4. Weekly Focus Heatmap */}
        <div
          style={{
            background: '#0f0f17',
            borderRadius: '16px',
            padding: '32px',
            border: '1px solid #1e1e2f',
            boxShadow: '0 4px 24px rgba(0,0,0,0.2)'
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc', marginBottom: '8px', marginTop: 0 }}>
            Weekly Focus Heatmap
          </h2>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px', marginTop: 0 }}>
            Average Focus Score by time of day. Darker green indicates higher sustained focus.
          </p>

          <FocusHeatmap data={data.heatmap} />
        </div>

      </div>
    </div>
  )
}

export default Analytics
