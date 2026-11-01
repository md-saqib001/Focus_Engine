import React, { useState } from 'react'
import { Button } from './ui'
import { Shield, Eye, Lock, Camera } from 'lucide-react'

interface CVPermissionPromptProps {
  onPermissionResolved: (status: 'granted' | 'denied') => void
}

const CVPermissionPrompt: React.FC<CVPermissionPromptProps> = ({ onPermissionResolved }) => {
  const [loading, setLoading] = useState(false)

  const handleResolve = async (granted: boolean) => {
    setLoading(true)
    try {
      const permission = granted ? 'granted' : 'denied'
      await window.focusEngineAPI.setCVPermission(permission)
      await window.focusEngineAPI.setCVEnabled(granted)
      onPermissionResolved(permission)
    } catch (err) {
      console.error('[CVPermissionPrompt] Failed to resolve permission:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 15, 23, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
    >
      <div
        style={{
          backgroundColor: '#181824',
          border: '1.5px solid #272738',
          borderRadius: '20px',
          padding: '32px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', backgroundColor: 'rgba(129, 140, 248, 0.12)', borderRadius: '12px', color: '#818cf8' }}>
            <Camera size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Attention Tracking</h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Enable webcam-assisted focus analytics</p>
          </div>
        </div>

        <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#cbd5e1', margin: 0 }}>
          Focus Engine can use your webcam to analyze your head pose and gaze directions. This detects when you look away from your screen or get distracted by your phone.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', fontSize: '13px' }}>
            <Lock size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: '#f8fafc' }}>100% Local Processing</strong>
              <div style={{ color: '#94a3b8', marginTop: '2px' }}>Webcam frames are processed purely in-memory in a local Python subprocess.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', fontSize: '13px' }}>
            <Shield style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: '#f8fafc' }}>No Video Storage</strong>
              <div style={{ color: '#94a3b8', marginTop: '2px' }}>No raw images or video files are ever saved on disk or sent over any network.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', fontSize: '13px' }}>
            <Eye style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: '#f8fafc' }}>Numeric Telemetry Only</strong>
              <div style={{ color: '#94a3b8', marginTop: '2px' }}>Only local mathematical outputs (yaw/pitch angles and gaze ratios) are recorded.</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <Button
            variant="ghost"
            onClick={() => handleResolve(false)}
            disabled={loading}
            style={{ flex: 1, border: '1px solid #272738' }}
          >
            Don't Use Webcam
          </Button>
          <Button
            variant="primary"
            onClick={() => handleResolve(true)}
            disabled={loading}
            style={{ flex: 1 }}
          >
            Allow Attention Tracking
          </Button>
        </div>
      </div>
    </div>
  )
}

export default CVPermissionPrompt
