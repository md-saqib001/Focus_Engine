import React from 'react'

export interface StatCardProps {
  label: string
  value: string | number
  unit?: string
  trend?: string
  color?: string
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  unit,
  trend,
  color = '#818cf8'
}) => {
  // Determine trend color
  const getTrendColor = (): string => {
    if (!trend) return 'transparent'
    if (trend.startsWith('+')) return '#10b981' // Green
    if (trend.startsWith('-')) return '#ef4444' // Red
    return '#64748b' // Grey fallback
  };

  return (
    <div
      style={{
        backgroundColor: '#181824',
        border: '1.5px solid #272738',
        borderRadius: '20px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        fontFamily: 'Inter, sans-serif',
        minWidth: '180px',
        flex: 1
      }}
    >
      {/* Label */}
      <span
        style={{
          fontSize: '13px',
          fontWeight: 500,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}
      >
        {label}
      </span>

      {/* Value & Unit */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span
          style={{
            fontSize: '36px',
            fontWeight: 700,
            color: '#f8fafc',
            lineHeight: 1
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            style={{
              fontSize: '16px',
              fontWeight: 500,
              color: '#64748b'
            }}
          >
            {unit}
          </span>
        )}
      </div>

      {/* Trend indicator or Color highlight strip */}
      {trend ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600, color: getTrendColor() }}>
          <span>{trend}</span>
          <span style={{ color: '#64748b', fontWeight: 400 }}>vs last week</span>
        </div>
      ) : (
        <div style={{ height: '4px', width: '24px', borderRadius: '2px', backgroundColor: color, marginTop: '8px' }} />
      )}
    </div>
  )
}
