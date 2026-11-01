import React, { useState, useEffect } from 'react'

interface LivePredictionBadgeProps {
  isActive: boolean
}

export const LivePredictionBadge: React.FC<LivePredictionBadgeProps> = ({ isActive }) => {
  const [score, setScore] = useState<number | null>(null)
  const [isAnomaly, setIsAnomaly] = useState<boolean | null>(null)

  useEffect(() => {
    if (!isActive) {
      setScore(null)
      setIsAnomaly(null)
      return undefined
    }

    // Subscribe to IPC live predictions
    const unsubscribe = window.focusEngineAPI.onMLPrediction((data) => {
      setScore(data.focusScore)
      setIsAnomaly(data.isAnomaly)
    })

    return () => {
      unsubscribe()
    }
  }, [isActive])

  if (!isActive) {
    return null
  }

  // Define styling based on state
  let textColor = '#94a3b8' // Slate gray
  let bgColor = 'rgba(148, 163, 184, 0.06)'
  let borderColor = 'rgba(148, 163, 184, 0.15)'
  let dotColor = '#94a3b8'
  let label = 'Trending: Calibrating...'
  let pulseAnimation = 'pulseGray 1.5s infinite'

  if (score !== null) {
    if (isAnomaly) {
      textColor = '#ef4444' // Red
      bgColor = 'rgba(239, 68, 68, 0.08)'
      borderColor = 'rgba(239, 68, 68, 0.25)'
      dotColor = '#ef4444'
      label = `⚠️ Warning: Distracted (${score})`
      pulseAnimation = 'pulseRed 1.2s infinite'
    } else {
      textColor = '#10b981' // Green
      bgColor = 'rgba(16, 185, 129, 0.08)'
      borderColor = 'rgba(16, 185, 129, 0.25)'
      dotColor = '#10b981'
      label = `Trending: ${score} (on track)`
      pulseAnimation = 'pulseGreen 2s infinite'
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '6px 14px',
        borderRadius: '20px',
        backgroundColor: bgColor,
        border: `1.5px solid ${borderColor}`,
        color: textColor,
        fontSize: '12px',
        fontWeight: 600,
        fontFamily: "'Outfit', 'Inter', sans-serif",
        margin: '10px auto 16px auto',
        width: 'fit-content',
        boxShadow: '0 2px 8px -1px rgba(0, 0, 0, 0.2)',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        animation: 'fadeInScale 0.3s ease-out'
      }}
    >
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: dotColor,
          display: 'inline-block',
          animation: pulseAnimation
        }}
      />
      <span style={{ letterSpacing: '0.3px' }}>{label}</span>
      
      {/* Inject custom CSS keyframes dynamically */}
      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulseGray {
          0% { box-shadow: 0 0 0 0 rgba(148, 163, 184, 0.4); }
          70% { box-shadow: 0 0 0 5px rgba(148, 163, 184, 0); }
          100% { box-shadow: 0 0 0 0 rgba(148, 163, 184, 0); }
        }
        @keyframes pulseRed {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
          70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes pulseGreen {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); }
          70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>
    </div>
  )
}
export default LivePredictionBadge
