import React, { useState, useEffect } from 'react'
import { Card, Button } from '@/components/ui'
import { Trash2, Plus, Globe, ShieldAlert, Laptop, Camera, ShieldCheck, UserCheck, RotateCcw } from 'lucide-react'
import CVCalibrationHelper from '../components/CVCalibrationHelper'

interface BlockedDomainRow {
  domain: string
  enabled: number // 0 or 1
  created_at: number
}

interface BlacklistedAppRow {
  app_name: string
  is_enabled: number // 0 or 1
}

const Settings: React.FC = () => {
  // Domain blocking states
  const [domains, setDomains] = useState<BlockedDomainRow[]>([])
  const [newDomain, setNewDomain] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  // App blocking states
  const [apps, setApps] = useState<BlacklistedAppRow[]>([])
  const [newApp, setNewApp] = useState('')
  const [loading, setLoading] = useState(true)

  const [cvEnabled, setCvEnabled] = useState(true)
  const [showCalibration, setShowCalibration] = useState(false)
  const [calibrationData, setCalibrationData] = useState<any>(null)

  const handleResetCalibration = async () => {
    try {
      await window.focusEngineAPI.resetCalibrationToDefault()
      await fetchCVSettings()
    } catch (err) {
      console.error('[Settings] Failed to reset calibration:', err)
    }
  }

  const fetchCVSettings = async (): Promise<void> => {
    try {
      const enabledRes = await window.focusEngineAPI.getCVEnabled()
      if (enabledRes.success && enabledRes.data !== undefined) {
        setCvEnabled(enabledRes.data)
      }
      const calibrationRes = await window.focusEngineAPI.getCalibration()
      if (calibrationRes.success) {
        setCalibrationData(calibrationRes.data)
      }
    } catch (err) {
      console.error('[Settings] Fetch CV settings error:', err)
    }
  }

  const fetchDomains = async (): Promise<void> => {
    try {
      const res = await window.focusEngineAPI.getBlockedDomains()
      if (res.success && res.data) {
        setDomains(res.data)
      }
    } catch (err) {
      console.error('[Settings] Get domains error:', err)
    }
  }

  const fetchApps = async (): Promise<void> => {
    try {
      const res = await window.focusEngineAPI.getBlacklistedApps()
      if (res.success && res.data) {
        setApps(res.data)
      }
    } catch (err) {
      console.error('[Settings] Get blacklisted apps error:', err)
    }
  }

  useEffect(() => {
    const init = async (): Promise<void> => {
      setLoading(true)
      await Promise.all([fetchDomains(), fetchApps(), fetchCVSettings()])
      setLoading(false)
    }
    init()
  }, [])

  const handleAddDomain = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    const clean = newDomain.trim().toLowerCase()
    if (!clean) return

    if (clean.includes(' ')) {
      setError('Domain cannot contain spaces')
      return
    }

    try {
      const res = await window.focusEngineAPI.addBlockedDomain(clean)
      if (res.success) {
        setNewDomain('')
        await fetchDomains()
      } else {
        setError(res.error || 'Failed to add domain')
      }
    } catch (err: any) {
      setError(err.message || String(err))
    }
  }

  const handleRemoveDomain = async (domainName: string): Promise<void> => {
    setError(null)
    try {
      const res = await window.focusEngineAPI.removeBlockedDomain(domainName)
      if (res.success) {
        await fetchDomains()
      } else {
        setError(res.error || 'Failed to remove domain')
      }
    } catch (err: any) {
      setError(err.message || String(err))
    }
  }

  const handleToggleDomain = async (domainName: string, currentlyEnabled: boolean): Promise<void> => {
    setError(null)
    try {
      const res = await window.focusEngineAPI.toggleBlockedDomain(domainName, !currentlyEnabled)
      if (res.success) {
        await fetchDomains()
      } else {
        setError(res.error || 'Failed to toggle domain')
      }
    } catch (err: any) {
      setError(err.message || String(err))
    }
  }

  // App blocking handlers
  const handleAddApp = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    const clean = newApp.trim()
    if (!clean) return

    try {
      const res = await window.focusEngineAPI.addBlacklistedApp(clean)
      if (res.success) {
        setNewApp('')
        await fetchApps()
      } else {
        setError(res.error || 'Failed to add app')
      }
    } catch (err: any) {
      setError(err.message || String(err))
    }
  }

  const handleRemoveApp = async (appName: string): Promise<void> => {
    setError(null)
    try {
      const res = await window.focusEngineAPI.removeBlacklistedApp(appName)
      if (res.success) {
        await fetchApps()
      } else {
        setError(res.error || 'Failed to remove app')
      }
    } catch (err: any) {
      setError(err.message || String(err))
    }
  }

  const handleToggleApp = async (appName: string, currentlyEnabled: boolean): Promise<void> => {
    setError(null)
    try {
      const res = await window.focusEngineAPI.toggleBlacklistedApp(appName, !currentlyEnabled)
      if (res.success) {
        await fetchApps()
      } else {
        setError(res.error || 'Failed to toggle app')
      }
    } catch (err: any) {
      setError(err.message || String(err))
    }
  }

  const handleToggleCV = async (): Promise<void> => {
    setError(null)
    try {
      const nextVal = !cvEnabled
      const res = await window.focusEngineAPI.setCVEnabled(nextVal)
      if (res.success) {
        setCvEnabled(nextVal)
      } else {
        setError(res.error || 'Failed to toggle camera tracking')
      }
    } catch (err: any) {
      setError(err.message || String(err))
    }
  }

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#f8fafc', margin: '0 0 4px 0' }}>Settings</h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>Configure your focus settings, blocked domains, and blacklisted apps.</p>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1.5px dashed #ef4444',
            borderRadius: '12px',
            padding: '16px',
            color: '#fca5a5',
            fontSize: '13px',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start'
          }}
        >
          <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>{error}</div>
        </div>
      )}

      {/* Domain Blocking Manager */}
      <Card title="Blocked Domains List">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '8px 0' }}>
          <form onSubmit={handleAddDomain} style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              placeholder="e.g. reddit.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              style={{
                flex: 1,
                backgroundColor: '#0f0f17',
                border: '1.5px solid #232336',
                borderRadius: '10px',
                padding: '10px 14px',
                color: '#f8fafc',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
            />
            <Button variant="secondary" size="md" type="submit">
              <Plus size={16} />
              <span>Add Domain</span>
            </Button>
          </form>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
              Loading domains...
            </div>
          ) : domains.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '14px' }}>
              No domains configured. Add one above!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {domains.map((row) => {
                const isEnabled = row.enabled === 1
                return (
                  <div
                    key={row.domain}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: '#0f0f17',
                      border: '1px solid #1e1e2f',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Globe size={16} style={{ color: isEnabled ? '#818cf8' : '#475569' }} />
                      <span style={{ fontSize: '14px', color: isEnabled ? '#f8fafc' : '#64748b', fontWeight: 550 }}>
                        {row.domain}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <button
                        onClick={() => handleToggleDomain(row.domain, isEnabled)}
                        style={{
                          width: '40px',
                          height: '22px',
                          borderRadius: '11px',
                          backgroundColor: isEnabled ? '#818cf8' : '#232336',
                          border: 'none',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'background-color 0.2s ease',
                          padding: 0
                        }}
                      >
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            backgroundColor: '#ffffff',
                            position: 'absolute',
                            top: '3px',
                            left: isEnabled ? '21px' : '3px',
                            transition: 'left 0.2s ease'
                          }}
                        />
                      </button>

                      <button
                        onClick={() => handleRemoveDomain(row.domain)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '6px',
                          borderRadius: '6px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
                        title="Delete domain"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Blacklisted Apps Manager */}
      <Card title="Blacklisted Applications">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '8px 0' }}>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '0', lineHeight: '1.5' }}>
            These applications will be terminated automatically and periodically during active focus sessions to prevent distraction.
          </p>

          <form onSubmit={handleAddApp} style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              placeholder="e.g. Discord"
              value={newApp}
              onChange={(e) => setNewApp(e.target.value)}
              style={{
                flex: 1,
                backgroundColor: '#0f0f17',
                border: '1.5px solid #232336',
                borderRadius: '10px',
                padding: '10px 14px',
                color: '#f8fafc',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
            />
            <Button variant="secondary" size="md" type="submit">
              <Plus size={16} />
              <span>Add App</span>
            </Button>
          </form>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
              Loading apps...
            </div>
          ) : apps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '14px' }}>
              No applications configured. Add one above!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {apps.map((row) => {
                const isEnabled = row.is_enabled === 1
                return (
                  <div
                    key={row.app_name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: '#0f0f17',
                      border: '1px solid #1e1e2f',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Laptop size={16} style={{ color: isEnabled ? '#818cf8' : '#475569' }} />
                      <span style={{ fontSize: '14px', color: isEnabled ? '#f8fafc' : '#64748b', fontWeight: 550 }}>
                        {row.app_name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <button
                        onClick={() => handleToggleApp(row.app_name, isEnabled)}
                        style={{
                          width: '40px',
                          height: '22px',
                          borderRadius: '11px',
                          backgroundColor: isEnabled ? '#818cf8' : '#232336',
                          border: 'none',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'background-color 0.2s ease',
                          padding: 0
                        }}
                      >
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            backgroundColor: '#ffffff',
                            position: 'absolute',
                            top: '3px',
                            left: isEnabled ? '21px' : '3px',
                            transition: 'left 0.2s ease'
                          }}
                        />
                      </button>

                      <button
                        onClick={() => handleRemoveApp(row.app_name)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '6px',
                          borderRadius: '6px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
                        title="Delete app"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Webcam Attention Tracking Card */}
      <Card title="Attention Tracking (Webcam)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '8px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ display: 'block', fontSize: '14px', color: '#f8fafc' }}>
                Enable Webcam Attention Tracking
              </strong>
              <span style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                Uses local face and gaze telemetry to detect distraction in real time.
              </span>
            </div>
            <button
              onClick={handleToggleCV}
              style={{
                width: '40px',
                height: '22px',
                borderRadius: '11px',
                backgroundColor: cvEnabled ? '#818cf8' : '#232336',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background-color 0.2s ease',
                padding: 0
              }}
            >
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  position: 'absolute',
                  top: '3px',
                  left: cvEnabled ? '21px' : '3px',
                  transition: 'left 0.2s ease'
                }}
              />
            </button>
          </div>

          {cvEnabled && (
            <div style={{ borderTop: '1px solid #1e1e2f', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '14px', color: '#f8fafc' }}>
                  Camera Baseline Calibration
                </strong>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 10px 0', lineHeight: '1.5' }}>
                  Custom baselines align the gaze tracker to your setup. Recalibrate if you adjust your camera position or monitor angle.
                </p>

                {calibrationData ? (
                  <div style={{ padding: '12px', backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '8px', fontSize: '12px', color: '#cbd5e1', lineHeight: '1.6' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '6px' }}>
                      <UserCheck size={16} style={{ color: '#10b981' }} />
                      <strong>Baseline Calibration Found (v{calibrationData.version || 1})</strong>
                    </div>
                    {calibrationData.version === 2 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '8px' }}>
                        <div>
                          <strong style={{ color: '#818cf8', display: 'block', marginBottom: '4px' }}>Screen Targets</strong>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', color: '#94a3b8' }}>
                            <div>• <strong>Center</strong>: Yaw {calibrationData.screen?.center?.yaw ?? 0}°, Pitch {calibrationData.screen?.center?.pitch ?? 0}°, Gaze {calibrationData.screen?.center?.gaze_ratio ?? 0.5}</div>
                            <div>• <strong>Top-Left</strong>: Yaw {calibrationData.screen?.top_left?.yaw ?? 0}°, Pitch {calibrationData.screen?.top_left?.pitch ?? 0}°, Gaze {calibrationData.screen?.top_left?.gaze_ratio ?? 0.5}</div>
                            <div>• <strong>Top-Right</strong>: Yaw {calibrationData.screen?.top_right?.yaw ?? 0}°, Pitch {calibrationData.screen?.top_right?.pitch ?? 0}°, Gaze {calibrationData.screen?.top_right?.gaze_ratio ?? 0.5}</div>
                            <div>• <strong>Bottom-Left</strong>: Yaw {calibrationData.screen?.bottom_left?.yaw ?? 0}°, Pitch {calibrationData.screen?.bottom_left?.pitch ?? 0}°, Gaze {calibrationData.screen?.bottom_left?.gaze_ratio ?? 0.5}</div>
                            <div>• <strong>Bottom-Right</strong>: Yaw {calibrationData.screen?.bottom_right?.yaw ?? 0}°, Pitch {calibrationData.screen?.bottom_right?.pitch ?? 0}°, Gaze {calibrationData.screen?.bottom_right?.gaze_ratio ?? 0.5}</div>
                          </div>
                        </div>
                        <div>
                          <strong style={{ color: '#10b981', display: 'block', marginBottom: '4px' }}>Keyboard Targets</strong>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', color: '#94a3b8' }}>
                            <div>• <strong>Center</strong>: Yaw {calibrationData.keyboard?.center?.yaw ?? 0}°, Pitch {calibrationData.keyboard?.center?.pitch ?? 0}°</div>
                            <div>• <strong>Top-Left</strong>: Yaw {calibrationData.keyboard?.top_left?.yaw ?? 0}°, Pitch {calibrationData.keyboard?.top_left?.pitch ?? 0}°</div>
                            <div>• <strong>Top-Right</strong>: Yaw {calibrationData.keyboard?.top_right?.yaw ?? 0}°, Pitch {calibrationData.keyboard?.top_right?.pitch ?? 0}°</div>
                            <div>• <strong>Bottom-Left</strong>: Yaw {calibrationData.keyboard?.bottom_left?.yaw ?? 0}°, Pitch {calibrationData.keyboard?.bottom_left?.pitch ?? 0}°</div>
                            <div>• <strong>Bottom-Right</strong>: Yaw {calibrationData.keyboard?.bottom_right?.yaw ?? 0}°, Pitch {calibrationData.keyboard?.bottom_right?.pitch ?? 0}°</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>• <strong>Active Screen</strong>: Yaw {calibrationData.screen?.yaw}°, Pitch {calibrationData.screen?.pitch}°</div>
                        <div>• <strong>Distraction (Phone/Lap)</strong>: Yaw {calibrationData.distract?.yaw}°, Pitch {calibrationData.distract?.pitch}°</div>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '12px', backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px dashed #f59e0b', borderRadius: '8px', fontSize: '12px', color: '#fef3c7', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <Camera size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <span>No custom baselines detected. Run calibration to improve distraction detection accuracy.</span>
                  </div>
                )}
              </div>
 
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="secondary" size="md" onClick={() => setShowCalibration(true)}>
                  <Camera size={14} style={{ marginRight: '6px' }} />
                  <span>{calibrationData ? 'Recalibrate Tracker' : 'Calibrate Tracker'}</span>
                </Button>
                {calibrationData && (
                  <Button variant="ghost" size="md" onClick={handleResetCalibration} style={{ border: '1px solid #272738' }}>
                    <RotateCcw size={14} style={{ marginRight: '6px' }} />
                    <span>Reset to Default</span>
                  </Button>
                )}
              </div>
            </div>
          )}

          <div style={{ backgroundColor: '#0f0f17', borderRadius: '8px', padding: '12px', display: 'flex', gap: '10px', fontSize: '12px', color: '#64748b', border: '1px solid #1e1e2f' }}>
            <ShieldCheck size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ lineHeight: '1.5' }}>
              <strong>Webcam Privacy Policy</strong>: Webcam feeds are analyzed in-memory purely locally on your machine. No frames or video files are ever saved, archived, or transmitted over any network. Only numeric landmarks leave the subprocess.
            </div>
          </div>
        </div>
      </Card>

      {/* Calibration Helper Overlay */}
      {showCalibration && (
        <CVCalibrationHelper
          onClose={() => {
            setShowCalibration(false)
            fetchCVSettings()
          }}
        />
      )}
    </div>
  )
}

export default Settings
