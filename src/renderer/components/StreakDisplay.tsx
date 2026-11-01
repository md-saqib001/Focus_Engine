import React from 'react'

export interface StreakData {
  currentStreak: number
  longestStreak: number
  isActive: boolean
  activeDates: string[]
}

interface StreakDisplayProps {
  data: StreakData
}

const DAY_MS = 24 * 60 * 60 * 1000
const CALENDAR_STRIP_DAYS = 14

function getLocalDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const StreakDisplay: React.FC<StreakDisplayProps> = ({ data }) => {
  const activeDateSet = new Set(data.activeDates)
  const today = new Date()
  const strip = Array.from({ length: CALENDAR_STRIP_DAYS }, (_, i) => {
    const d = new Date(today.getTime() - (CALENDAR_STRIP_DAYS - 1 - i) * DAY_MS)
    return getLocalDateString(d)
  })
  const todayStr = getLocalDateString(today)

  const isCold = data.currentStreak === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>Current streak</div>
          <div
            style={{
              fontSize: '32px',
              fontWeight: 700,
              color: isCold ? '#64748b' : '#10b981', // green semantics when active
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <span>{isCold ? '💤' : '🔥'}</span>
            <span>
              {data.currentStreak} day{data.currentStreak === 1 ? '' : 's'} streak
            </span>
          </div>
          {isCold && (
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>
              Complete a focus session today to start a new streak.
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>Longest streak</div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: '#f8fafc' }}>
            {data.longestStreak} day{data.longestStreak === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Last 14 days</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {strip.map((dateStr) => {
            const active = activeDateSet.has(dateStr)
            const isToday = dateStr === todayStr
            return (
              <div
                key={dateStr}
                title={`${dateStr}${active ? ' — completed a session' : ''}`}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '5px',
                  backgroundColor: active ? '#10b981' : '#1e1e2f', // Standard green for active days
                  outline: isToday ? '1px solid #818cf8' : 'none',
                  outlineOffset: '2px'
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
