import React, { useState, useEffect } from 'react'
import { Card } from './ui'
import { Eye, User, Compass } from 'lucide-react'

interface CVAttentionPanelProps {
  isActive: boolean
}

interface CVData {
  face_present: boolean
  yaw: number | null
  pitch: number | null
  roll: number | null
  gaze_direction: string | null
  looking_at_screen: boolean
  raw_attention_score: number
  smoothed_attention_score: number
  ts: number
  frame: number
  preview_frame?: string
}

const CVAttentionPanel: React.FC<CVAttentionPanelProps> = ({ isActive }) => {
  const [data, setData] = useState<CVData | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!isActive) {
      setData(null)
      setErrorMsg(null)
      return undefined
    }

    const unsubscribeUpdate = window.focusEngineAPI.onCVUpdate((update) => {
      setData(update)
      setErrorMsg(null) // Reset error if we successfully get updates
    })

    const unsubscribeError = window.focusEngineAPI.onCVError((err) => {
      setErrorMsg(err)
    })

    return () => {
      unsubscribeUpdate()
      unsubscribeError()
    }
  }, [isActive])

  if (!isActive) return null

  // Defaults when no data received yet
  const facePresent = data?.face_present ?? false
  const score = data?.smoothed_attention_score ?? 0.0
  const rawScore = data?.raw_attention_score ?? 0.0
  const gaze = data?.gaze_direction ?? 'unknown'
  const yaw = data?.yaw ?? 0.0
  const pitch = data?.pitch ?? 0.0
  const roll = data?.roll ?? 0.0

  // Resolve color states based on smoothed attention score
  let scoreColor = '#ef4444' // Red
  let scoreLabel = 'Distracted'
  if (score >= 0.8) {
    scoreColor = '#10b981' // Green
    scoreLabel = 'Focused'
  } else if (score >= 0.4) {
    scoreColor = '#f59e0b' // Amber
    scoreLabel = 'Unsettled'
  }

  const scorePercentage = Math.round(score * 100)

  return (
    <Card title="Live Attention Diagnostics" style={{ width: '100%', maxWidth: '460px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Live Camera Stream with drawn overlays or error */}
        {errorMsg ? (
          <div style={{ width: '100%', height: '220px', borderRadius: '10px', padding: '16px', border: '1.5px dashed #ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fca5a5', fontSize: '13px', gap: '8px', textAlign: 'center', lineHeight: '1.5' }}>
            <span style={{ fontWeight: 700, color: '#ef4444' }}>⚠️ Camera Connection Failed</span>
            <span style={{ color: '#cbd5e1', fontSize: '12px' }}>{errorMsg}</span>
            <span style={{ color: '#64748b', fontSize: '11px', marginTop: '6px' }}>Make sure your webcam is plugged in, permissions are granted, and it is not in use by another application.</span>
          </div>
        ) : data?.preview_frame ? (
          <div style={{ width: '100%', height: '220px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #1e1e2f', backgroundColor: '#0f0f17', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src={data.preview_frame}
              alt="Live camera tracking preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        ) : (
          <div style={{ width: '100%', height: '220px', borderRadius: '10px', border: '1.5px dashed #232336', backgroundColor: '#0f0f17', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '13px', gap: '8px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2.5px solid #232336', borderTopColor: '#818cf8', animation: 'spin 1s linear infinite' }} />
            <span>Connecting to camera feed...</span>
          </div>
        )}

        {/* 1. Score and Status Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid #1e1e2f' }}>
          <div style={{ position: 'relative', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* SVG Progress Circle */}
            <svg style={{ transform: 'rotate(-90deg)', width: '60px', height: '60px' }}>
              <circle
                cx="30"
                cy="30"
                r="26"
                stroke="#0f0f17"
                strokeWidth="5"
                fill="transparent"
              />
              <circle
                cx="30"
                cy="30"
                r="26"
                stroke={scoreColor}
                strokeWidth="5"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 26}`}
                strokeDashoffset={`${2 * Math.PI * 26 * (1 - score)}`}
                style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.4s ease' }}
              />
            </svg>
            <span style={{ position: 'absolute', fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
              {scorePercentage}%
            </span>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: '14px', color: '#f8fafc' }}>Attention Score</strong>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: `${scoreColor}1d`,
                  color: scoreColor,
                  textTransform: 'capitalize'
                }}
              >
                {scoreLabel}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Raw Score: {rawScore.toFixed(1)} (Blink Filter Active)
            </div>
          </div>
        </div>

        {/* 2. Face Presence Indicator */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <User size={18} style={{ color: facePresent ? '#10b981' : '#ef4444' }} />
            <div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>Camera Tracking</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: facePresent ? '#10b981' : '#ef4444' }}>
                {facePresent ? 'Face Detected' : 'No Face'}
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Eye size={18} style={{ color: gaze === 'center' ? '#10b981' : gaze === 'unknown' ? '#64748b' : '#f59e0b' }} />
            <div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>Gaze Direction</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', textTransform: 'capitalize' }}>
                {gaze}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Pose Angles (Yaw, Pitch, Roll) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed #1e1e2f', paddingTop: '16px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <Compass size={14} style={{ color: '#818cf8' }} />
            Head Pose Orientation
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px', textAlign: 'center' }}>
            <div style={{ padding: '8px', backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '6px' }}>
              <span style={{ color: '#64748b', display: 'block', fontSize: '9px', marginBottom: '2px' }}>YAW</span>
              <strong style={{ color: facePresent ? '#f8fafc' : '#475569' }}>
                {facePresent ? `${yaw.toFixed(1)}°` : '—'}
              </strong>
            </div>

            <div style={{ padding: '8px', backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '6px' }}>
              <span style={{ color: '#64748b', display: 'block', fontSize: '9px', marginBottom: '2px' }}>PITCH</span>
              <strong style={{ color: facePresent ? '#f8fafc' : '#475569' }}>
                {facePresent ? `${pitch.toFixed(1)}°` : '—'}
              </strong>
            </div>

            <div style={{ padding: '8px', backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '6px' }}>
              <span style={{ color: '#64748b', display: 'block', fontSize: '9px', marginBottom: '2px' }}>ROLL</span>
              <strong style={{ color: facePresent ? '#f8fafc' : '#475569' }}>
                {facePresent ? `${roll.toFixed(1)}°` : '—'}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default CVAttentionPanel
