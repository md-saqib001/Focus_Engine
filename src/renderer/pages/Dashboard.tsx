import React, { useState, useEffect } from 'react'
import { Card, TimerDisplay, Button } from '@/components/ui'
import { useFocusSessionContext } from '../context/FocusSessionContext'
import LiveTelemetryPanel from '../components/LiveTelemetryPanel'
import DistractionAlert from '../components/DistractionAlert'
import ErrorBoundary from '../components/ErrorBoundary'
import { Play, Pause, Square, RotateCcw, X, ShieldAlert, CheckCircle, AlertCircle } from 'lucide-react'
import { SessionType } from '../types/timer'
import CVPermissionPrompt from '../components/CVPermissionPrompt'
import CVAttentionPanel from '../components/CVAttentionPanel'
import FocusBufferGauge from '../components/FocusBufferGauge'
import BufferSignalBreakdown from '../components/BufferSignalBreakdown'
import LivePredictionBadge from '../components/LivePredictionBadge'

const DashboardContent: React.FC = () => {
  const {
    mode,
    setMode,
    sessionId,
    timerState,
    hoursElapsedOrRemaining,
    minutesElapsedOrRemaining,
    secondsElapsedOrRemaining,
    progress,
    blockingError,
    summary,
    healthStatus,
    startPomodoroSession,
    startStandardSession,
    pauseSession,
    resumeSession,
    stopSession,
    resetSession,
    clearSummary,
    showAutoPauseModal,
    showForceEndModal,
    setShowForceEndModal,
    handleResumeFromAutoPause,
    handleEndFromAutoPause,
    sessionType
  } = useFocusSessionContext()

  // Selected session type for Pomodoro mode (defaults to focus)
  const [selectedType, setSelectedType] = useState<SessionType>('focus')
  
  // Custom durations (configurable)
  const [durations] = useState({
    focus: 25,
    shortBreak: 5,
    longBreak: 15
  })

  // Visual flash state when session completes
  const [flash, setFlash] = useState(false)
  const [dismissWarning, setDismissWarning] = useState(false)

  // CV permission and enabled states
  const [cvPermission, setCvPermission] = useState<'granted' | 'denied' | 'pending'>('pending')
  const [cvEnabled, setCvEnabled] = useState(false)

  // Full comprehensive summary fetched after session completes
  const [fullSummary, setFullSummary] = useState<any | null>(null)

  useEffect(() => {
    if (summary && summary.session_id) {
      window.focusEngineAPI.getSessionSummary(summary.session_id).then((res) => {
        if (res.success && res.data) setFullSummary(res.data)
      }).catch(err => console.error(err))
    } else {
      setFullSummary(null)
    }
  }, [summary])

  useEffect(() => {
    const fetchCVSettings = async () => {
      try {
        const permRes = await window.focusEngineAPI.getCVPermission()
        if (permRes.success && permRes.data) {
          setCvPermission(permRes.data)
        }
        const enabledRes = await window.focusEngineAPI.getCVEnabled()
        if (enabledRes.success && enabledRes.data !== undefined) {
          setCvEnabled(enabledRes.data)
        }
      } catch (err) {
        console.error('[Dashboard] Error fetching CV settings:', err)
      }
    }
    fetchCVSettings()
  }, [timerState])

  useEffect(() => {
    if (timerState === 'completed') {
      setFlash(true)
      const timer = setTimeout(() => setFlash(false), 2000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [timerState])

  // Automatically reset dismiss state when a new session starts
  useEffect(() => {
    if (timerState === 'running') {
      setDismissWarning(false)
    }
  }, [timerState])

  const handleStart = (): void => {
    if (mode === 'pomodoro') {
      startPomodoroSession(selectedType, durations[selectedType])
    } else {
      startStandardSession()
    }
  }

  const formatSummaryDuration = (sec: number): string => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    if (h > 0) {
      return `${h}h ${m}m ${s}s`
    }
    return `${m}m ${s}s`
  }

  const getPlainReason = (reason: string): string => {
    switch (reason) {
      case 'auto_complete': return 'Session completed automatically'
      case 'manual_stop': return 'You stopped this session manually'
      case 'abandoned': return 'Session was abandoned'
      case 'force_ended': return 'This session ended automatically due to sustained inactivity'
      default: return reason
    }
  }

  return (
    <div
      style={{
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '1040px',
        margin: '0 auto',
        animation: flash ? 'flashEffect 0.5s ease-out 4' : 'none'
      }}
    >
      <DistractionAlert />

      {/* Telemetry Health Warning Banner */}
      {healthStatus && sessionType === 'focus' && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1.5px solid #ef4444',
            borderRadius: '12px',
            padding: '16px 20px',
            color: '#fca5a5',
            fontSize: '13px',
            lineHeight: '1.6',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}
        >
          <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#ef4444' }} />
          <div>
            <strong style={{ color: '#ef4444', fontSize: '14px' }}>⚠️ Critical Telemetry Failure:</strong>
            <div style={{ marginTop: '4px' }}>
              One or more system activity listeners have stopped responding:
              <ul style={{ margin: '4px 0 0 16px', padding: 0, listStyleType: 'disc' }}>
                {!healthStatus.window && <li>Active Window Poller appears dead</li>}
                {!healthStatus.kpm && <li>Keystroke Rate Tracker appears dead</li>}
                {!healthStatus.mouse && <li>Mouse Event Tracker appears dead</li>}
              </ul>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
              This usually happens if background permissions are revoked, or the OS terminates secondary subprocesses.
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#f8fafc', margin: '0 0 4px 0' }}>Dashboard</h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>Manage and monitor your active session.</p>
      </div>

      {/* Dismissible Warning Banner on Blocking Error */}
      {blockingError && !dismissWarning && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1.5px dashed #ef4444',
            borderRadius: '12px',
            padding: '16px',
            color: '#fca5a5',
            fontSize: '13px',
            lineHeight: '1.6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>⚠️ Web Blocking Error:</strong>
              <div style={{ marginTop: '2px', opacity: 0.9 }}>{blockingError}</div>
            </div>
          </div>
          <button
            onClick={() => setDismissWarning(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fca5a5',
              cursor: 'pointer',
              padding: '2px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', width: '100%', maxWidth: '1000px', margin: '0 auto', justifyItems: 'center', alignItems: 'start' }}>
        <Card title={mode === 'pomodoro' ? 'Pomodoro Session' : 'Standard Focus Session'} style={{ width: '100%', maxWidth: '460px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', padding: '12px 0' }}>
            
            {/* Mode Selector (Only visible when idle or completed) */}
            {(timerState === 'idle' || timerState === 'completed') && (
              <div
                style={{
                  display: 'flex',
                  backgroundColor: '#0f0f17',
                  borderRadius: '12px',
                  padding: '4px',
                  border: '1px solid #232336',
                  width: '100%'
                }}
              >
                <button
                  onClick={() => {
                    setMode('pomodoro')
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: '8px',
                    backgroundColor: mode === 'pomodoro' ? '#181824' : 'transparent',
                    color: mode === 'pomodoro' ? '#818cf8' : '#94a3b8',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: mode === 'pomodoro' ? '1px solid #2e2e48' : '1px solid transparent'
                  }}
                >
                  Pomodoro
                </button>
                <button
                  onClick={() => {
                    setMode('standard')
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: '8px',
                    backgroundColor: mode === 'standard' ? '#181824' : 'transparent',
                    color: mode === 'standard' ? '#818cf8' : '#94a3b8',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: mode === 'standard' ? '1px solid #2e2e48' : '1px solid transparent'
                  }}
                >
                  Standard (Open-Ended)
                </button>
              </div>
            )}

            {/* Pomodoro Session Type Selector (Only visible in pomodoro mode when idle/completed) */}
            {mode === 'pomodoro' && (timerState === 'idle' || timerState === 'completed') && (
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                {(['focus', 'shortBreak', 'longBreak'] as SessionType[]).map((type) => {
                  const isLocked = type !== 'focus'
                  return (
                    <button
                      key={type}
                      disabled={isLocked}
                      onClick={() => {
                        setSelectedType(type)
                      }}
                      style={{
                        flex: 1,
                        padding: '8px 4px',
                        borderRadius: '8px',
                        backgroundColor: selectedType === type ? '#232336' : 'transparent',
                        color: selectedType === type ? '#ffffff' : '#64748b',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: isLocked ? 'not-allowed' : 'pointer',
                        opacity: isLocked ? 0.4 : 1,
                        transition: 'all 0.2s ease',
                        border: selectedType === type ? '1px solid #2e2e48' : '1px solid #1c1c2b'
                      }}
                    >
                      {type === 'focus' ? 'Focus' : type === 'shortBreak' ? 'Short' : 'Long'}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Timer Display */}
            <TimerDisplay
              hours={timerState === 'idle' ? 0 : hoursElapsedOrRemaining}
              minutes={
                timerState === 'idle' && mode === 'pomodoro'
                  ? durations[selectedType]
                  : minutesElapsedOrRemaining
              }
              seconds={timerState === 'idle' ? 0 : secondsElapsedOrRemaining}
              state={timerState}
              mode={mode}
              progress={progress}
            />

            <LivePredictionBadge isActive={(timerState === 'running' || timerState === 'paused') && sessionType === 'focus'} />

            {/* Controls */}
            <div style={{ display: 'flex', gap: '12px', width: '100%', justifyContent: 'center' }}>
              {timerState === 'idle' || timerState === 'completed' ? (
                <Button variant="primary" size="md" onClick={handleStart} style={{ width: '160px' }}>
                  <Play size={16} fill="currentColor" />
                  <span>Start Session</span>
                </Button>
              ) : (
                <>
                  {timerState === 'running' ? (
                    <Button variant="secondary" size="md" onClick={pauseSession}>
                      <Pause size={16} fill="currentColor" />
                      <span>Pause</span>
                    </Button>
                  ) : (
                    <Button variant="primary" size="md" onClick={resumeSession}>
                      <Play size={16} fill="currentColor" />
                      <span>Resume</span>
                    </Button>
                  )}

                  {/* Stop/End controls */}
                  {mode === 'pomodoro' ? (
                    <Button variant="ghost" size="md" onClick={resetSession}>
                      <RotateCcw size={16} />
                      <span>Reset</span>
                    </Button>
                  ) : (
                    <Button variant="danger" size="md" onClick={stopSession}>
                      <Square size={16} fill="currentColor" />
                      <span>Stop</span>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Live diagnostics panel shown during active focus sessions */}
        <LiveTelemetryPanel
          sessionId={sessionId}
          isActive={(timerState === 'running' || timerState === 'paused') && sessionType === 'focus'}
        />

        {/* Live attention tracking panel */}
        {cvEnabled && (
          <CVAttentionPanel
            isActive={(timerState === 'running' || timerState === 'paused') && sessionType === 'focus'}
          />
        )}

        {/* Focus Buffer Gauge Card */}
        <FocusBufferGauge
          isActive={(timerState === 'running' || timerState === 'paused') && sessionType === 'focus'}
        />

        {/* Focus Signal Breakdown Card */}
        <BufferSignalBreakdown
          isActive={(timerState === 'running' || timerState === 'paused') && sessionType === 'focus'}
        />
      </div>

      {/* First-run permission modal */}
      {cvPermission === 'pending' && (
        <CVPermissionPrompt
          onPermissionResolved={(status) => {
            setCvPermission(status)
            setCvEnabled(status === 'granted')
          }}
        />
      )}

      {/* Session Summary Modal */}
      {summary && (
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
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#181824',
              border: '1.5px solid #272738',
              borderRadius: '20px',
              padding: '28px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
              color: '#f8fafc',
              animation: 'modalSlideIn 0.3s ease-out'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {summary.completed ? (
                  <CheckCircle size={22} style={{ color: '#10b981' }} />
                ) : (
                  <AlertCircle size={22} style={{ color: '#f59e0b' }} />
                )}
                <span>Session Summary</span>
              </h2>
              <button
                onClick={clearSummary}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
              {/* Message */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  backgroundColor: summary.completed ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                  borderLeft: `4px solid ${summary.completed ? '#10b981' : '#f59e0b'}`,
                  fontSize: '14px',
                  color: summary.completed ? '#a7f3d0' : '#fef3c7',
                  fontWeight: 550
                }}
              >
                {getPlainReason(summary.end_reason)}
              </div>

              {/* Focus Score */}
              {fullSummary?.focusScoreComponents && (
                <div style={{ padding: '16px', backgroundColor: '#0f0f17', borderRadius: '10px', border: '1px solid #1e1e2f' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h4 style={{ color: '#f8fafc', margin: 0, fontSize: '15px' }}>Automatic Focus Score</h4>
                      <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '12px' }}>
                        Calculated automatically — no self-reporting needed
                      </p>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: fullSummary.focusScore >= 80 ? '#10b981' : fullSummary.focusScore >= 50 ? '#f59e0b' : '#ef4444' }}>
                      {fullSummary.focusScore}<span style={{ fontSize: '16px', color: '#64748b' }}>/100</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    <div style={{ backgroundColor: '#1e1e2f', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>Buffer Retention</div>
                      <div style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600 }}>{fullSummary.focusScoreComponents.averageBuffer}%</div>
                    </div>
                    <div style={{ backgroundColor: '#1e1e2f', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>Time Focused</div>
                      <div style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600 }}>{fullSummary.focusScoreComponents.focusPercentage}%</div>
                    </div>
                    <div style={{ backgroundColor: '#1e1e2f', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>Visual Attention</div>
                      <div style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600 }}>
                        {fullSummary.focusScoreComponents.reweighted ? 'N/A (CV Off)' : `${fullSummary.focusScoreComponents.attentionPercentage}%`}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Grid details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div style={{ padding: '10px', backgroundColor: '#0f0f17', borderRadius: '8px', border: '1px solid #1e1e2f' }}>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '4px' }}>Mode</span>
                  <strong style={{ textTransform: 'capitalize', color: '#f8fafc' }}>{summary.session_mode}</strong>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#0f0f17', borderRadius: '8px', border: '1px solid #1e1e2f' }}>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '4px' }}>Duration</span>
                  <strong style={{ color: '#f8fafc' }}>{formatSummaryDuration(summary.duration_actual_sec)}</strong>
                </div>
              </div>

              {/* Auto pauses count */}
              {summary.auto_paused_count !== undefined && summary.auto_paused_count > 0 && (
                <div style={{ padding: '10px 14px', backgroundColor: '#0f0f17', borderRadius: '8px', border: '1px solid #1e1e2f', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>Auto-Pauses</span>
                  <strong style={{ color: '#f59e0b' }}>Auto-paused {summary.auto_paused_count} time{summary.auto_paused_count > 1 ? 's' : ''}</strong>
                </div>
              )}

              {/* Apps Killed */}
              {summary.apps_killed.length > 0 && (
                <div style={{ padding: '12px', backgroundColor: '#0f0f17', borderRadius: '8px', border: '1px solid #1e1e2f', fontSize: '13px' }}>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '6px' }}>
                    Terminated Applications ({summary.apps_killed.length})
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {summary.apps_killed.map((app) => (
                      <span
                        key={app}
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(129, 140, 248, 0.12)',
                          color: '#818cf8',
                          border: '1px solid rgba(129, 140, 248, 0.2)'
                        }}
                      >
                        {app}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Summary Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" size="md" onClick={clearSummary}>
                Close
              </Button>

              {/* Start Break is only visible if the completed session was a Pomodoro focus session */}
              {summary.session_mode === 'pomodoro' && summary.session_type === 'focus' && summary.completed && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    clearSummary()
                    // Auto select Short Break and start
                    setSelectedType('shortBreak')
                    startPomodoroSession('shortBreak', durations.shortBreak)
                  }}
                >
                  Start Break (5m)
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes flashEffect {
          0% { background-color: #0f0f17; }
          50% { background-color: rgba(129, 140, 248, 0.15); }
          100% { background-color: #0f0f17; }
        }
        @keyframes modalSlideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      {/* Auto-Pause Overlay Modal */}
      {showAutoPauseModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 15, 23, 0.9)',
            backdropFilter: 'blur(10px)',
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
              border: '1.5px solid #ef4444',
              borderRadius: '24px',
              padding: '32px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              color: '#f8fafc',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', color: '#ef4444' }}>
                <Pause size={36} fill="currentColor" />
              </div>
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0' }}>Session Auto-Paused</h2>
              <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.5', margin: 0 }}>
                Your focus buffer dropped below 10%. Please take a moment to re-engage before resuming.
              </p>
              {mode === 'standard' && (
                <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '10px', fontWeight: 550 }}>
                  ⚠️ Standard-mode sessions must be resumed within 2 minutes or they will automatically end.
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '10px' }}>
              <Button variant="danger" size="md" onClick={handleEndFromAutoPause}>
                End Session
              </Button>
              <Button variant="primary" size="md" onClick={handleResumeFromAutoPause}>
                Resume Focus
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Force-Ended Informational Modal */}
      {showForceEndModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 15, 23, 0.9)',
            backdropFilter: 'blur(10px)',
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
              borderRadius: '24px',
              padding: '32px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              color: '#f8fafc',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ padding: '16px', backgroundColor: 'rgba(96, 165, 250, 0.1)', borderRadius: '50%', color: '#60a5fa' }}>
                <AlertCircle size={36} />
              </div>
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0' }}>Session Ended</h2>
              <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.6', margin: 0 }}>
                This session was ended automatically due to sustained inactivity or distraction. Standard-mode sessions require you to stay engaged. No action is needed; just start a new session when you're ready.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
              <Button variant="primary" size="md" onClick={() => setShowForceEndModal(false)} style={{ width: '120px' }}>
                OK
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const Dashboard: React.FC = () => {
  return (
    <ErrorBoundary>
      <DashboardContent />
    </ErrorBoundary>
  )
}

export default Dashboard
