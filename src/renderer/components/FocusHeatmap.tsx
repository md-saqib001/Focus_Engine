import React from 'react'

export interface HeatmapCell {
  dayOfWeek: number
  hourOfDay: number
  avgScore: number
  sessionCount: number
}

interface FocusHeatmapProps {
  data: HeatmapCell[]
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

export const FocusHeatmap: React.FC<FocusHeatmapProps> = ({ data }) => {
  // Organize into a 2D map
  const dataMap = new Map<string, HeatmapCell>()
  data.forEach((d) => {
    dataMap.set(`${d.dayOfWeek}-${d.hourOfDay}`, d)
  })

  const getColor = (score: number, count: number) => {
    if (count === 0) return '#1e1e2f' // Empty
    if (score >= 80) return '#10b981' // Green (80+)
    if (score >= 50) return '#f59e0b' // Amber (50 - 79)
    return '#ef4444' // Red (under 50)
  }

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM'
    if (hour === 12) return '12 PM'
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', overflowX: 'auto' }}>
        {/* Y-axis labels (Days) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginRight: '12px', marginTop: '24px' }}>
          {DAYS.map((day) => (
            <div key={day} style={{ height: '24px', fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
              {day}
            </div>
          ))}
        </div>

        {/* The Grid and X-axis */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* X-axis labels (Hours) */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', height: '20px' }}>
            {HOURS.map((hour) => (
              <div key={hour} style={{ width: '24px', fontSize: '11px', color: '#64748b', position: 'relative' }}>
                <span style={{ position: 'absolute', left: '-12px', whiteSpace: 'nowrap' }}>
                  {hour % 3 === 0 ? formatHour(hour) : ''}
                </span>
              </div>
            ))}
          </div>

          {/* 7x24 Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {DAYS.map((_, dayIndex) => (
              <div key={dayIndex} style={{ display: 'flex', gap: '6px' }}>
                {HOURS.map((hour) => {
                  const cell = dataMap.get(`${dayIndex}-${hour}`)
                  const score = cell ? cell.avgScore : 0
                  const count = cell ? cell.sessionCount : 0
                  
                  return (
                    <div
                      key={`${dayIndex}-${hour}`}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        backgroundColor: getColor(score, count),
                        cursor: count > 0 ? 'pointer' : 'default',
                        transition: 'all 0.2s ease',
                      }}
                      title={count > 0 ? `${formatHour(hour)}, ${DAYS[dayIndex]}\nSessions: ${count}\nAvg Score: ${Math.round(score)}/100` : `${formatHour(hour)}, ${DAYS[dayIndex]}\nNo sessions`}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '24px', fontSize: '13px', color: '#94a3b8' }}>
        <span style={{ fontWeight: 500 }}>Focus Score:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '14px', height: '14px', borderRadius: '3px', backgroundColor: '#ef4444' }} />
          <span>Under 50</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '14px', height: '14px', borderRadius: '3px', backgroundColor: '#f59e0b' }} />
          <span>50 - 79</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '14px', height: '14px', borderRadius: '3px', backgroundColor: '#10b981' }} />
          <span>80+</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <div style={{ width: '14px', height: '14px', borderRadius: '3px', backgroundColor: '#1e1e2f' }} />
          <span>No Data</span>
        </div>
      </div>
    </div>
  )
}
