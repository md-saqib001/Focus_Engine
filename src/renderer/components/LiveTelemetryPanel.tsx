import React from 'react'
import { Card } from '@/components/ui'
import { useLiveTelemetry } from '../hooks/useLiveTelemetry'
import { Keyboard, MousePointer, Activity, ShieldAlert, Monitor, CircleDot } from 'lucide-react'

interface LiveTelemetryPanelProps {
  sessionId: string | null
  isActive: boolean
}

const LiveTelemetryPanel: React.FC<LiveTelemetryPanelProps> = ({ sessionId, isActive }) => {
  const { activeWindow, kpm, clicks, movements, idleSeconds, timeline } = useLiveTelemetry(
    sessionId,
    isActive
  )

  if (!isActive) return null

  // Helper to resolve category colors
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'productive':
        return '#10b981' // Green
      case 'distraction':
        return '#ef4444' // Red
      case 'neutral':
        return '#475569' // Gray
      default:
        return '#1e293b' // Dark Slate
    }
  }

  // Format idle duration string
  const formatIdleTime = (sec: number) => {
    if (sec < 60) return `${sec}s`
    const mins = Math.floor(sec / 60)
    const remainingSecs = sec % 60
    return `${mins}m ${remainingSecs}s`
  }

  // Resolve KPM details
  const kpmColor = kpm < 10 ? '#64748b' : kpm <= 60 ? '#10b981' : '#a855f7'
  const kpmLabel = kpm < 10 ? 'Reading' : kpm <= 60 ? 'Writing' : 'Coding'
  const kpmPercentage = Math.min((kpm / 150) * 100, 100)

  // Resolve Activity/Idle Dot color based on thresholds (Green < 60s, Amber 60-300s, Red > 300s)
  const isIdle = idleSeconds >= 5
  const idleColor = !isIdle ? '#10b981' : idleSeconds <= 300 ? '#f59e0b' : '#ef4444'

  return (
    <Card title="Live Session Diagnostics" style={{ width: '100%', maxWidth: '460px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* 1. Current App / Focus Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid #1e1e2f' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#0f0f17', border: '1px solid #232336', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
            {activeWindow?.category === 'distraction' ? <ShieldAlert size={20} style={{ color: '#ef4444' }} /> : <Monitor size={20} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <strong style={{ fontSize: '14px', color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeWindow?.appName || 'Detecting activity...'}
              </strong>
              {activeWindow && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: activeWindow.category === 'productive' ? 'rgba(16, 185, 129, 0.12)' : activeWindow.category === 'distraction' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(71, 85, 105, 0.12)',
                    color: getCategoryColor(activeWindow.category),
                    textTransform: 'capitalize',
                    animation: activeWindow.category === 'productive' ? 'pulse-green 2s infinite' : 'none'
                  }}
                >
                  {activeWindow.category}
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
              {activeWindow?.windowTitle || 'Please focus on any app window.'}
            </div>
            {activeWindow?.domain && (
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                Domain: {activeWindow.domain}
              </div>
            )}
          </div>
        </div>

        {/* 2. KPM Gauge */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Keyboard size={14} /> Keystrokes Per Minute
            </span>
            <strong style={{ fontSize: '12px', color: kpmColor }}>
              {kpm} ({kpmLabel})
            </strong>
          </div>
          {/* Gauge track */}
          <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', overflow: 'hidden' }}>
            <div
              style={{
                width: `${kpmPercentage}%`,
                height: '100%',
                backgroundColor: kpmColor,
                borderRadius: '4px',
                transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            />
          </div>
        </div>

        {/* 3. Mouse Activity & Idle Indicators */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MousePointer size={18} style={{ color: '#818cf8' }} />
            <div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>Mouse actions</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                {clicks} <span style={{ fontSize: '10px', fontWeight: 400, color: '#94a3b8' }}>clicks</span>
              </div>
              <div style={{ fontSize: '10px', color: '#475569' }}>{movements} movements</div>
            </div>
          </div>

          <div style={{ backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CircleDot size={18} style={{ color: idleColor, boxShadow: `0 0 6px ${idleColor}`, borderRadius: '50%' }} />
            <div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>User activity</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: idleColor }}>
                {!isIdle ? 'Active' : 'Idle'}
              </div>
              <div style={{ fontSize: '10px', color: '#475569' }}>
                {!isIdle ? 'Currently using OS' : `Stepped away ${formatIdleTime(idleSeconds)}`}
              </div>
            </div>
          </div>
        </div>

        {/* 4. Mini 5-Minute Timeline Strip */}
        <div style={{ borderTop: '1px dashed #1e1e2f', paddingTop: '16px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={14} style={{ color: '#818cf8' }} />
            Dominant Category Timeline (Last 5m)
          </div>
          <div style={{ display: 'flex', width: '100%', height: '16px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #1e1e2f', backgroundColor: '#0f0f17' }}>
            {timeline.map((cat, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  backgroundColor: getCategoryColor(cat),
                  borderRight: i < 4 ? '1.5px solid #0f0f17' : 'none',
                  transition: 'background-color 0.4s ease'
                }}
                title={`Minute ${5 - i} ago: ${cat}`}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-green {
          0% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
          }
          70% {
            box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }
      `}</style>
    </Card>
  )
}

export default LiveTelemetryPanel
