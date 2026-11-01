import React from 'react'

export interface TimerDisplayProps {
  hours?: number
  minutes: number
  seconds: number
  state: 'idle' | 'running' | 'paused' | 'completed'
  mode?: 'pomodoro' | 'standard'
  progress?: number | null
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  hours = 0,
  minutes,
  seconds,
  state,
  mode = 'pomodoro',
  progress = null
}) => {
  // Format HH:MM:SS or MM:SS with leading zeroes
  const formattedHours = String(hours).padStart(2, '0')
  const formattedMinutes = String(minutes).padStart(2, '0')
  const formattedSeconds = String(seconds).padStart(2, '0')

  // Colors based on state
  const getStateColor = (): string => {
    switch (state) {
      case 'running':
        return '#818cf8' // Accent purple
      case 'paused':
        return '#f59e0b' // Amber
      case 'completed':
        return '#10b981' // Green on complete
      case 'idle':
      default:
        return '#64748b' // Grey
    }
  }

  const color = getStateColor()

  // SVG Circular progress configurations
  const radius = 90
  const strokeWidth = 8
  const circumference = 2 * Math.PI * radius
  
  // Calculate progress ratio (default to remaining ratio if not explicitly passed)
  const isStandard = mode === 'standard'
  const finalRatio = progress !== null ? progress : 1
  const strokeDashoffset = circumference - finalRatio * circumference

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: '220px',
        height: '220px',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      {/* Progress SVG */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 200 200"
        style={{
          transform: 'rotate(-90deg)',
          position: 'absolute',
          top: 0,
          left: 0
        }}
      >
        {/* Background Track */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="transparent"
          stroke="#1e1e2f"
          strokeWidth={strokeWidth}
          strokeDasharray={isStandard ? '4 4' : 'none'} // Dashed in standard mode to represent open-endedness
        />
        {/* Foreground Circle representing progress (only in Pomodoro mode) */}
        {!isStandard && (
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease'
            }}
          />
        )}
      </svg>

      {/* Timer Text */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          textAlign: 'center',
          padding: '0 20px'
        }}
      >
        <span
          style={{
            fontSize: '40px',
            fontWeight: 700,
            color: '#f8fafc',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            letterSpacing: '-1px'
          }}
        >
          {hours > 0 ? `${formattedHours}:${formattedMinutes}:${formattedSeconds}` : `${formattedMinutes}:${formattedSeconds}`}
        </span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            color: color,
            letterSpacing: '1.5px',
            marginTop: '4px',
            transition: 'color 0.3s ease'
          }}
        >
          {state}
        </span>
        {isStandard && (
          <span
            style={{
              fontSize: '9px',
              color: '#475569',
              marginTop: '6px',
              maxWidth: '120px',
              lineHeight: '1.2'
            }}
          >
            Open-ended session (no progress ring)
          </span>
        )}
      </div>
    </div>
  )
}
