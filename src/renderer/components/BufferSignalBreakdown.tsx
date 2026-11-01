import React from 'react'
import { Card } from './ui'
import { useFocusBuffer } from '../hooks/useFocusBuffer'
import { Eye, Keyboard, MousePointer, Monitor, Circle } from 'lucide-react'

interface BufferSignalBreakdownProps {
  isActive: boolean
}

const BufferSignalBreakdown: React.FC<BufferSignalBreakdownProps> = ({ isActive }) => {
  const { signals } = useFocusBuffer(isActive)

  if (!isActive) return null

  const getStatusColor = (mult: number) => {
    if (mult >= 1.0) return '#10b981' // Optimal Green
    if (mult >= 0.85) return '#f59e0b' // Warning Amber
    return '#ef4444' // Penalty Red
  }

  const getStatusText = (mult: number) => {
    if (mult >= 1.0) return 'Optimal'
    if (mult >= 0.85) return 'Warn'
    return 'Decay'
  }

  const signalItems = [
    {
      name: 'Computer Vision',
      key: 'cv',
      value: signals.cv,
      icon: Eye,
      description: 'Tracks eye gaze and face presence bounds'
    },
    {
      name: 'Keyboard Activity',
      key: 'keyboard',
      value: signals.keyboard,
      icon: Keyboard,
      description: 'Tracks KPM against active window category'
    },
    {
      name: 'Mouse Activity',
      key: 'mouse',
      value: signals.mouse,
      icon: MousePointer,
      description: 'Tracks clicks and movement idle durations'
    },
    {
      name: 'Active Window',
      key: 'window',
      value: signals.window,
      icon: Monitor,
      description: 'App and site productive classification'
    }
  ]

  return (
    <Card title="Focus Signal Multipliers" style={{ width: '100%', maxWidth: '460px', flex: '1 1 360px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '6px 0' }}>
        
        {/* Signal rows */}
        {signalItems.map((item) => {
          const Icon = item.icon
          const color = getStatusColor(item.value)
          const status = getStatusText(item.value)

          return (
            <div 
              key={item.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '10px',
                backgroundColor: '#0f0f17',
                border: '1px solid #1c1c2b',
                transition: 'all 0.3s ease'
              }}
            >
              {/* Left Side: Icon & Details */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div 
                  style={{ 
                    padding: '8px', 
                    borderRadius: '8px', 
                    backgroundColor: `${color}15`, 
                    color: color, 
                    display: 'flex',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <Icon size={18} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 650, color: '#f8fafc' }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: '10px', color: '#64748b', lineHeight: '1.3', maxWidth: '200px' }}>
                    {item.description}
                  </span>
                </div>
              </div>

              {/* Right Side: Multiplier Value & Status badge */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                  {item.value.toFixed(2)}x
                </span>
                
                {/* Micro Status Dot Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Circle size={6} fill={color} stroke="none" />
                  <span style={{ fontSize: '9px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {status}
                  </span>
                </div>
              </div>

            </div>
          )
        })}

        <div style={{ borderTop: '1px solid #232336', marginTop: '4px', paddingTop: '10px' }}>
          <p style={{ fontSize: '10px', color: '#64748b', lineHeight: '1.4', textAlign: 'center', margin: '0 4px' }}>
            Multipliers strictly scale the Focus Buffer. Any values below <span style={{ color: '#f59e0b' }}>1.00x</span> trigger exponential decay. High focus resets multipliers to <span style={{ color: '#10b981' }}>1.00x</span> for additive recovery.
          </p>
        </div>

      </div>
    </Card>
  )
}

export default BufferSignalBreakdown
