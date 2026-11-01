import React, { useState, useEffect } from 'react'
import { Card } from './ui'
import { useFocusBuffer } from '../hooks/useFocusBuffer'
import { Activity, ShieldAlert, CheckCircle, HelpCircle } from 'lucide-react'

interface FocusBufferGaugeProps {
  isActive: boolean
}

const FocusBufferGauge: React.FC<FocusBufferGaugeProps> = ({ isActive }) => {
  const { value, state, isWarmup } = useFocusBuffer(isActive)
  const [isFlashing, setIsFlashing] = useState(false)

  useEffect(() => {
    if (!isActive) return

    const unsubscribe = window.focusEngineAPI.onFocusBufferStateChanged((data) => {
      console.log(`[FocusBufferGauge] State transitioned: ${data.previousState} -> ${data.newState}`)
      setIsFlashing(true)
      const timer = setTimeout(() => {
        setIsFlashing(false)
      }, 800)
      return () => clearTimeout(timer)
    })

    return () => {
      unsubscribe()
    }
  }, [isActive])

  if (!isActive) return null

  // Define colors and labels based on buffer state
  let stateColor = '#818cf8' // default indigo
  let stateLabel = 'Focused'
  let stateDesc = 'Excellent concentration. Keep it up!'
  let StateIcon = CheckCircle

  if (isWarmup) {
    stateColor = '#60a5fa' // Sky blue for camera warmup/calibration
    stateLabel = 'Warming Up'
    stateDesc = 'Initializing camera and tracking sensors...'
    StateIcon = Activity
  } else if (state === 'focused') {
    stateColor = '#10b981' // Green
    stateLabel = 'Focused'
    stateDesc = 'Great concentration. Maintain your pace!'
    StateIcon = CheckCircle
  } else if (state === 'warning') {
    stateColor = '#f59e0b' // Amber
    stateLabel = 'Warning'
    stateDesc = 'Concentration slipping. Refocus on your task.'
    StateIcon = Activity
  } else if (state === 'critical') {
    stateColor = '#ef4444' // Red
    stateLabel = 'Critical'
    stateDesc = 'Attention loss detected! You are drifting away.'
    StateIcon = ShieldAlert
  } else if (state === 'paused') {
    stateColor = '#64748b' // Gray
    stateLabel = 'Paused'
    stateDesc = 'Focus session paused due to prolonged distraction.'
    StateIcon = HelpCircle
  }

  // Circular gauge config
  const radius = 54
  const stroke = 10
  const normalizedRadius = radius - stroke * 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDashoffset = circumference - (value / 100) * circumference

  return (
    <Card title="Focus Energy Buffer" style={{ width: '100%', maxWidth: '460px', flex: '1 1 360px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '10px 0' }}>
        
        {/* Large Circular Progress Gauge */}
        <div 
          style={{ 
            position: 'relative', 
            width: '150px', 
            height: '150px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            animation: isFlashing ? 'gauge-flash 0.8s ease-out' : 'none',
            color: stateColor,
            transition: 'transform 0.2s ease, filter 0.2s ease'
          }}
        >
          <style>{`
            @keyframes gauge-flash {
              0% { transform: scale(1); filter: brightness(1); }
              50% { transform: scale(1.08); filter: brightness(1.8) drop-shadow(0 0 15px currentColor); }
              100% { transform: scale(1); filter: brightness(1); }
            }
          `}</style>
          
          {/* Radial Glow Shadow */}
          <div 
            style={{ 
              position: 'absolute', 
              width: '120px', 
              height: '120px', 
              borderRadius: '50%', 
              backgroundColor: stateColor, 
              filter: 'blur(30px)', 
              opacity: 0.12, 
              transition: 'background-color 0.5s ease' 
            }} 
          />

          <svg style={{ transform: 'rotate(-90deg)', width: '150px', height: '150px', position: 'absolute' }}>
            {/* Background Circle */}
            <circle
              cx="75"
              cy="75"
              r={normalizedRadius}
              stroke="#0f0f17"
              strokeWidth={stroke}
              fill="transparent"
            />
            {/* Active Progress Circle */}
            <circle
              cx="75"
              cy="75"
              r={normalizedRadius}
              stroke={stateColor}
              strokeWidth={stroke}
              strokeDasharray={circumference + ' ' + circumference}
              style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease' }}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          {/* Centered Score */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
            <span style={{ fontSize: '36px', fontWeight: 800, color: '#f8fafc', lineHeight: '1.1' }}>
              {Math.round(value)}%
            </span>
            <span style={{ fontSize: '11px', fontWeight: 650, color: stateColor, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px', transition: 'color 0.5s ease' }}>
              {stateLabel}
            </span>
          </div>
        </div>

        {/* State Information Header */}
        <div 
          style={{ 
            width: '100%', 
            padding: '16px', 
            borderRadius: '12px', 
            backgroundColor: '#0f0f17', 
            border: '1px solid #1e1e2f',
            display: 'flex', 
            gap: '12px', 
            alignItems: 'center' 
          }}
        >
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: `${stateColor}15`, color: stateColor, display: 'flex', transition: 'color 0.5s ease, background-color 0.5s ease' }}>
            <StateIcon size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
              State: <span style={{ color: stateColor, transition: 'color 0.5s ease' }}>{stateLabel}</span>
            </span>
            <span style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.4' }}>
              {stateDesc}
            </span>
          </div>
        </div>

        {/* Informative helper description */}
        <p style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', margin: '0 8px', lineHeight: '1.5' }}>
          Your focus buffer decays when distraction signals are triggered (looking away, off-task windows) and slowly recovers over time when full focus is maintained.
        </p>

      </div>
    </Card>
  )
}

export default FocusBufferGauge
