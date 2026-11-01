import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui'
import { RefreshCw, BarChart2, ShieldAlert } from 'lucide-react'

interface SessionRow {
  session_id: string
  session_mode: 'pomodoro' | 'standard'
  session_type: 'focus' | 'shortBreak' | 'longBreak' | null
  start_time: number
  end_time: number | null
  duration_planned_sec: number | null
  duration_actual_sec: number | null
  completed: number
  end_reason: string | null
  focus_score: number | null
  created_at: number
  apps_killed?: number
}

interface CategoryBreakdownItem {
  category: string
  focus_count: number
}

const History: React.FC = () => {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  
  // Row expansion and details states
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const [breakdown, setBreakdown] = useState<{ [category: string]: number }>({})
  const [summary, setSummary] = useState<any | null>(null)
  const [distractionEvents, setDistractionEvents] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchSessions = async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await window.focusEngineAPI.getAllSessions()
      if (result.success && result.data) {
        setSessions(result.data)
      }
    } catch (err) {
      console.error('[History] Failed to fetch sessions:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  const handleRowClick = async (sessionId: string) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null)
      setSummary(null)
      setBreakdown({})
      setDistractionEvents([])
      return
    }

    setExpandedSessionId(sessionId)
    setDetailLoading(true)
    setBreakdown({})
    setSummary(null)
    setDistractionEvents([])

    try {
      // 1. Fetch distraction warnings timeline
      const distRes = await window.focusEngineAPI.getDistractionEvents(sessionId)
      if (distRes.success && distRes.data) {
        setDistractionEvents(distRes.data)
      }

      // 2. Fetch session summary details
      const res = await window.focusEngineAPI.getSessionSummary(sessionId)
      if (res.success && res.data) {
        setSummary(res.data)
        setBreakdown(res.data.categoryBreakdown || {})
      } else {
        // Fallback to basic breakdown if aggregator fails
        const legacyRes = await window.focusEngineAPI.getCategoryBreakdown(sessionId)
        if (legacyRes.success && legacyRes.data) {
          const itemMap: { [category: string]: number } = {}
          legacyRes.data.forEach((item: CategoryBreakdownItem) => {
            itemMap[item.category] = item.focus_count
          })
          setBreakdown(itemMap)
        }
      }
    } catch (err) {
      console.error('[History] Failed to fetch session summary details:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  const formatDuration = (seconds: number | null): string => {
    if (seconds === null) return '—'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) {
      return `${h}h ${m}m ${s}s`
    }
    return `${m}m ${s}s`
  }

  const formatEventText = (type: string, dataStr: string): string => {
    try {
      const data = JSON.parse(dataStr)
      switch (type) {
        case 'sustained_distraction':
          return `Spent 60+ seconds continuously on distraction category (${data.appName || 'unknown'} - ${data.domain || 'unknown'})`
        case 'excessive_switching':
          return `Excessive multitasking: switched applications ${data.switchCount} times within 30 seconds`
        case 'blacklist_visit':
          return `Visited blacklisted domain "${data.domain}" in ${data.appName}`
        case 'extended_idle':
          return `Extended inactivity: remained idle for ${Math.round(data.idleSeconds / 60)} minutes`
        default:
          return `Distraction detected: ${type}`
      }
    } catch {
      return `Distraction warning: ${type}`
    }
  }

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatSessionType = (type: string | null): string => {
    if (type === null) return '—'
    switch (type) {
      case 'focus': return 'Focus'
      case 'shortBreak': return 'Short Break'
      case 'longBreak': return 'Long Break'
      default: return type
    }
  }

  const formatEndReason = (reason: string | null): string => {
    if (reason === null) return '—'
    switch (reason) {
      case 'auto_complete': return 'Completed Automatically'
      case 'manual_stop': return 'Stopped Manually'
      case 'abandoned': return 'Abandoned early'
      case 'force_ended': return 'Force Ended'
      default: return reason
    }
  }

  const getEndReasonColor = (reason: string | null): string => {
    switch (reason) {
      case 'auto_complete': return '#10b981'
      case 'manual_stop': return '#10b981'
      case 'abandoned': return '#f59e0b'
      case 'force_ended': return '#ef4444'
      default: return '#64748b'
    }
  }

  const thStyle: React.CSSProperties = {
    padding: '10px 14px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid #272738'
  }

  const tdStyle: React.CSSProperties = {
    padding: '12px 14px',
    fontSize: '13px',
    color: '#94a3b8',
    borderBottom: '1px solid #1e1e2f'
  }

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#f8fafc', margin: '0 0 4px 0' }}>Session History</h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <button
          onClick={fetchSessions}
          style={{
            background: 'transparent',
            border: '1px solid #272738',
            borderRadius: '8px',
            padding: '8px',
            cursor: 'pointer',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </button>
      </div>

      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '14px' }}>
            Loading sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '14px' }}>
            No sessions yet. Start a focus session from the Dashboard!
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Mode</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Duration</th>
                  <th style={thStyle}>Score</th>
                  <th style={thStyle}>Apps Killed</th>
                  <th style={thStyle}>Completed</th>
                  <th style={thStyle}>End Reason</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const isExpanded = expandedSessionId === session.session_id
                  return (
                    <React.Fragment key={session.session_id}>
                      <tr 
                        onClick={() => handleRowClick(session.session_id)}
                        style={{ 
                          cursor: 'pointer', 
                          backgroundColor: isExpanded ? 'rgba(129, 140, 248, 0.04)' : 'transparent',
                          transition: 'background-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => { if(!isExpanded) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)' }}
                        onMouseLeave={(e) => { if(!isExpanded) e.currentTarget.style.backgroundColor = 'transparent' }}
                      >
                        <td style={tdStyle}>
                          {formatDate(session.start_time)}
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: session.session_mode === 'pomodoro' ? 'rgba(129, 140, 248, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                              color: session.session_mode === 'pomodoro' ? '#818cf8' : '#10b981',
                              textTransform: 'capitalize'
                            }}
                          >
                            {session.session_mode}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {formatSessionType(session.session_type)}
                        </td>
                        <td style={tdStyle}>
                          {formatDuration(session.duration_actual_sec)}
                        </td>
                        <td style={tdStyle}>
                          {session.focus_score !== undefined && session.focus_score !== null ? (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: session.focus_score >= 80 ? 'rgba(16, 185, 129, 0.15)' : session.focus_score >= 50 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: session.focus_score >= 80 ? '#10b981' : session.focus_score >= 50 ? '#f59e0b' : '#ef4444'
                              }}
                            >
                              {session.focus_score}
                            </span>
                          ) : (
                            <span style={{ color: '#475569', fontSize: '12px' }}>—</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 600, color: (session.apps_killed ?? 0) > 0 ? '#818cf8' : '#64748b' }}>
                            {session.apps_killed ?? 0}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: session.completed ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                            {session.completed ? '✓ Yes' : '✗ No'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: getEndReasonColor(session.end_reason), fontWeight: 550 }}>
                            {formatEndReason(session.end_reason)}
                          </span>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr style={{ backgroundColor: '#09090f' }}>
                          <td colSpan={8} style={{ padding: '20px 24px', borderBottom: '1px solid #1e1e2f' }}>
                            {detailLoading ? (
                              <div style={{ color: '#64748b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <RefreshCw size={14} className="spin" />
                                <span>Loading focus telemetry analytics...</span>
                              </div>
                            ) : Object.keys(breakdown).length === 0 ? (
                              <div style={{ color: '#64748b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ShieldAlert size={14} />
                                <span>No active window telemetry recorded for this session.</span>
                              </div>
                            ) : (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                  <BarChart2 size={16} style={{ color: '#818cf8' }} />
                                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                                    Productivity Category Breakdown
                                  </span>
                                </div>

                                {/* Stacked Progress Bar */}
                                {(() => {
                                  const totalTicks = Object.values(breakdown).reduce((a, b) => a + b, 0)
                                  const prod = breakdown['productive'] || 0
                                  const dist = breakdown['distraction'] || 0
                                  const neut = breakdown['neutral'] || 0
                                  const unkn = breakdown['unknown'] || 0

                                  const prodPct = (prod / totalTicks) * 100
                                  const distPct = (dist / totalTicks) * 100
                                  const neutPct = (neut / totalTicks) * 100
                                  const unknPct = (unkn / totalTicks) * 100

                                  const formatTime = (ticks: number) => {
                                    const sec = ticks * 5 // each tick is 5 seconds
                                    const m = Math.floor(sec / 60)
                                    const s = sec % 60
                                    return m > 0 ? `${m}m ${s}s` : `${s}s`
                                  }

                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                      {/* Bar chart */}
                                      <div
                                        style={{
                                          display: 'flex',
                                          height: '14px',
                                          borderRadius: '7px',
                                          overflow: 'hidden',
                                          backgroundColor: '#1e1e2f',
                                          width: '100%'
                                        }}
                                      >
                                        {prod > 0 && (
                                          <div
                                            style={{
                                              width: `${prodPct}%`,
                                              backgroundColor: '#10b981',
                                              transition: 'width 0.3s ease'
                                            }}
                                            title={`Productive: ${prodPct.toFixed(0)}%`}
                                          />
                                        )}
                                        {dist > 0 && (
                                          <div
                                            style={{
                                              width: `${distPct}%`,
                                              backgroundColor: '#ef4444',
                                              transition: 'width 0.3s ease'
                                            }}
                                            title={`Distraction: ${distPct.toFixed(0)}%`}
                                          />
                                        )}
                                        {neut > 0 && (
                                          <div
                                            style={{
                                              width: `${neutPct}%`,
                                              backgroundColor: '#475569',
                                              transition: 'width 0.3s ease'
                                            }}
                                            title={`Neutral: ${neutPct.toFixed(0)}%`}
                                          />
                                        )}
                                        {unkn > 0 && (
                                          <div
                                            style={{
                                              width: `${unknPct}%`,
                                              backgroundColor: '#1e293b',
                                              transition: 'width 0.3s ease'
                                            }}
                                            title={`Unknown: ${unknPct.toFixed(0)}%`}
                                          />
                                        )}
                                      </div>

                                      {/* Legends with computed times */}
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', fontSize: '12px', marginBottom: '24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                                          <span style={{ color: '#94a3b8' }}>Productive:</span>
                                          <strong style={{ color: '#f8fafc' }}>{formatTime(prod)}</strong>
                                          <span style={{ color: '#64748b' }}>({prodPct.toFixed(0)}%)</span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                                          <span style={{ color: '#94a3b8' }}>Distraction:</span>
                                          <strong style={{ color: '#f8fafc' }}>{formatTime(dist)}</strong>
                                          <span style={{ color: '#64748b' }}>({distPct.toFixed(0)}%)</span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#475569' }} />
                                          <span style={{ color: '#94a3b8' }}>Neutral:</span>
                                          <strong style={{ color: '#f8fafc' }}>{formatTime(neut)}</strong>
                                          <span style={{ color: '#64748b' }}>({neutPct.toFixed(0)}%)</span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#1e293b' }} />
                                          <span style={{ color: '#94a3b8' }}>Unknown:</span>
                                          <strong style={{ color: '#f8fafc' }}>{formatTime(unkn)}</strong>
                                          <span style={{ color: '#64748b' }}>({unknPct.toFixed(0)}%)</span>
                                        </div>
                                      </div>

                                      {/* Consolidated Metrics Panel */}
                                      {summary && (
                                        <div style={{ borderTop: '1px dashed #1e1e2f', paddingTop: '20px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                              Session Diagnostics Summary
                                            </span>
                                          </div>
                                          <div
                                            style={{
                                              display: 'grid',
                                              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                              gap: '12px'
                                            }}
                                          >
                                            <div style={{ backgroundColor: '#0c0c14', border: '1px solid #161624', borderRadius: '8px', padding: '10px 12px' }}>
                                              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Keystroke Rate</div>
                                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                                                {summary.avgKpm} <span style={{ fontSize: '11px', fontWeight: 400, color: '#94a3b8' }}>avg KPM</span>
                                              </div>
                                              <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>Max: {summary.maxKpm} KPM</div>
                                            </div>

                                            <div style={{ backgroundColor: '#0c0c14', border: '1px solid #161624', borderRadius: '8px', padding: '10px 12px' }}>
                                              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Mouse Clicks</div>
                                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                                                {summary.totalClicks} <span style={{ fontSize: '11px', fontWeight: 400, color: '#94a3b8' }}>clicks</span>
                                              </div>
                                              <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>Movements: {summary.movementEvents}</div>
                                            </div>

                                            <div style={{ backgroundColor: '#0c0c14', border: '1px solid #161624', borderRadius: '8px', padding: '10px 12px' }}>
                                              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Continuous Idle</div>
                                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                                                {formatDuration(summary.maxIdleDuration)}
                                              </div>
                                              <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>Peak session gap</div>
                                            </div>

                                            <div style={{ backgroundColor: '#0c0c14', border: '1px solid #161624', borderRadius: '8px', padding: '10px 12px' }}>
                                              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Most Used App</div>
                                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={summary.mostUsedApp || 'None'}>
                                                {summary.mostUsedApp || '—'}
                                              </div>
                                            </div>

                                            <div style={{ backgroundColor: '#0c0c14', border: '1px solid #161624', borderRadius: '8px', padding: '10px 12px' }}>
                                              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Top Distractor</div>
                                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#ef4444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={summary.mostDistractingDomain || 'None'}>
                                                {summary.mostDistractingDomain || 'None'}
                                              </div>
                                            </div>

                                            <div style={{ backgroundColor: '#0c0c14', border: '1px solid #161624', borderRadius: '8px', padding: '10px 12px' }}>
                                              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Distractions Opened</div>
                                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                                                {summary.distractionsAttempted}
                                              </div>
                                            </div>

                                            <div style={{ backgroundColor: '#0c0c14', border: '1px solid #161624', borderRadius: '8px', padding: '10px 12px' }}>
                                              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Session Pauses</div>
                                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                                                {summary.totalPauses}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Distraction Events List */}
                                          <div style={{ marginTop: '20px' }}>
                                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
                                              Focus Warning Logs ({distractionEvents.length})
                                            </div>
                                            {distractionEvents.length === 0 ? (
                                              <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', padding: '6px 8px', backgroundColor: '#0c0c14', borderRadius: '6px', border: '1px solid #161624' }}>
                                                No distraction events occurred during this session.
                                              </div>
                                            ) : (
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                                                {distractionEvents.map((evt) => (
                                                  <div
                                                    key={evt.id}
                                                    style={{
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'space-between',
                                                      gap: '12px',
                                                      padding: '8px 12px',
                                                      backgroundColor: '#0c0c14',
                                                      border: '1px solid #161624',
                                                      borderRadius: '6px',
                                                      fontSize: '11px'
                                                    }}
                                                  >
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0' }}>
                                                      <span
                                                        style={{
                                                          padding: '2px 6px',
                                                          borderRadius: '4px',
                                                          backgroundColor: evt.event_type === 'extended_idle' ? 'rgba(100, 116, 139, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                          color: evt.event_type === 'extended_idle' ? '#94a3b8' : '#ef4444',
                                                          fontWeight: 600,
                                                          fontSize: '9px',
                                                          textTransform: 'uppercase'
                                                        }}
                                                      >
                                                        {evt.event_type.replace('_', ' ')}
                                                      </span>
                                                      <span>{formatEventText(evt.event_type, evt.event_data)}</span>
                                                    </span>
                                                    <span style={{ color: '#475569', whiteSpace: 'nowrap' }}>
                                                      {new Date(evt.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  )
}

export default History
