import React, { useState, useEffect } from 'react'
import { Card, Button } from '@/components/ui'
import { ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'

interface SessionRow {
  session_id: string
  session_mode: string
  session_type: string | null
  start_time: number
  duration_actual_sec: number | null
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

const BufferTrajectoryChart: React.FC<{
  snapshots: { timestamp: number; value: number }[]
  events: any[]
}> = ({ snapshots, events }) => {
  if (snapshots.length === 0) {
    return (
      <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '30px', border: '1px dashed #232336', borderRadius: '8px', backgroundColor: '#0c0c14' }}>
        No buffer snapshots captured yet for this session. (Ensure the session lasted at least 1 minute).
      </div>
    )
  }

  const width = 740
  const height = 240
  const paddingLeft = 40
  const paddingRight = 20
  const paddingTop = 20
  const paddingBottom = 30

  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  // Find min/max timestamps
  const timestamps = snapshots.map((s) => s.timestamp)
  const minTime = Math.min(...timestamps)
  const maxTime = Math.max(...timestamps)
  const timeSpan = maxTime - minTime || 1

  // Map snapshot data point to chart coordinates
  const points = snapshots.map((s) => {
    const x = paddingLeft + ((s.timestamp - minTime) / timeSpan) * chartWidth
    const y = paddingTop + (1 - s.value / 100) * chartHeight
    return { x, y, value: s.value, timestamp: s.timestamp }
  })

  // Create SVG path string
  let pathD = ''
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')
  }

  // Parse event dot parameters
  const eventMarkers = events.map((evt) => {
    let domain = ''
    try {
      const parsed = JSON.parse(evt.event_data)
      domain = parsed.domain || ''
    } catch {
      // ignore
    }

    const t = evt.timestamp
    // Map event timestamp to chart X coordinate
    const clampedT = Math.max(minTime, Math.min(maxTime, t))
    const x = paddingLeft + ((clampedT - minTime) / timeSpan) * chartWidth
    
    // Find closest snapshot value for Y coordinate mapping
    let closestVal = 50
    let minDiff = Infinity
    for (const s of snapshots) {
      const diff = Math.abs(s.timestamp - t)
      if (diff < minDiff) {
        minDiff = diff
        closestVal = s.value
      }
    }
    const y = paddingTop + (1 - closestVal / 100) * chartHeight

    let color = '#3b82f6' // Default Blue (extended_idle)
    if (evt.event_type === 'blacklist_visit') color = '#ef4444' // Red
    else if (evt.event_type === 'sustained_distraction') color = '#f59e0b' // Amber
    else if (evt.event_type === 'excessive_switching') color = '#ec4899' // Pink

    return {
      x,
      y,
      type: evt.event_type,
      domain,
      color,
      timestamp: evt.timestamp
    }
  })

  return (
    <div style={{ backgroundColor: '#09090f', border: '1px solid #1c1c2b', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 650, color: '#f8fafc' }}>Focus Energy Trajectory</h3>
        
        {/* Chart Legend */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#94a3b8' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span> Blacklist
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#94a3b8' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></span> Sustained
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#94a3b8' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ec4899' }}></span> Switching
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#94a3b8' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></span> Idle
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto', width: '100%' }}>
        <svg width={width} height={height} style={{ display: 'block', margin: '0 auto' }}>
          {/* Grid lines */}
          <line x1={paddingLeft} y1={paddingTop} x2={width - paddingRight} y2={paddingTop} stroke="#1b1b2a" strokeWidth={1} strokeDasharray="3,3" />
          <text x={paddingLeft - 8} y={paddingTop + 4} fill="#64748b" fontSize="10px" textAnchor="end">100</text>

          <line x1={paddingLeft} y1={paddingTop + chartHeight / 2} x2={width - paddingRight} y2={paddingTop + chartHeight / 2} stroke="#1b1b2a" strokeWidth={1} strokeDasharray="3,3" />
          <text x={paddingLeft - 8} y={paddingTop + chartHeight / 2 + 4} fill="#64748b" fontSize="10px" textAnchor="end">50</text>

          <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} stroke="#1b1b2a" strokeWidth={1} />
          <text x={paddingLeft - 8} y={height - paddingBottom + 4} fill="#64748b" fontSize="10px" textAnchor="end">0</text>

          {/* Trajectory Line */}
          {points.length > 0 && (
            <path
              d={pathD}
              fill="none"
              stroke="#818cf8"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Plot Event Markers */}
          {eventMarkers.map((em, idx) => (
            <g key={idx}>
              <line
                x1={em.x}
                y1={paddingTop}
                x2={em.x}
                y2={height - paddingBottom}
                stroke={em.color}
                strokeWidth={1}
                strokeDasharray="4,4"
                opacity={0.6}
              />
              <circle
                cx={em.x}
                cy={em.y}
                r={6}
                fill={em.color}
                stroke="#09090f"
                strokeWidth={2}
              />
            </g>
          ))}

          {/* Time axis label */}
          <text x={paddingLeft + chartWidth / 2} y={height - 6} fill="#64748b" fontSize="10px" textAnchor="middle">
            Timeline duration (Dotted lines display distraction markers)
          </text>
        </svg>
      </div>
    </div>
  )
}

const Debug: React.FC = () => {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [validating, setValidating] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [bulkResult, setBulkResult] = useState<any | null>(null)
  const [validationErr, setValidationErr] = useState<string | null>(null)

  const [auditResult, setAuditResult] = useState<any | null>(null)
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [distractionEvents, setDistractionEvents] = useState<any[]>([])
  const [stateTransitions, setStateTransitions] = useState<any[]>([])
  const [stateTimeSummary, setStateTimeSummary] = useState<any | null>(null)
  const [auditing, setAuditing] = useState(false)
  const [snapshotResult, setSnapshotResult] = useState<any | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)

  // Fetch recent sessions on mount for easy selection dropdown
  const loadSessions = async () => {
    setLoadingSessions(true)
    try {
      const res = await window.focusEngineAPI.getAllSessions()
      if (res.success && res.data) {
        setSessions(res.data)
        if (res.data.length > 0) {
          setSelectedSessionId(res.data[0].session_id)
        }
      }
    } catch (err) {
      console.error('[Debug] Failed to fetch sessions:', err)
    } finally {
      setLoadingSessions(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  const handleValidateAll = async () => {
    setBulkLoading(true)
    setBulkResult(null)
    setSnapshotResult(null)
    setValidationResult(null)
    setAuditResult(null)
    setSnapshots([])
    setDistractionEvents([])
    setStateTransitions([])
    setStateTimeSummary(null)
    setValidationErr(null)
    try {
      const res = await window.focusEngineAPI.validateAllSessions()
      if (res.success && res.data) {
        setBulkResult(res.data)
      } else {
        setValidationErr(res.error || 'Failed to validate all sessions.')
      }
    } catch (err: any) {
      setValidationErr(err.message || String(err))
    } finally {
      setBulkLoading(false)
    }
  }

  const handleValidateSnapshotGaps = async () => {
    setSnapshotLoading(true)
    setBulkResult(null)
    setSnapshotResult(null)
    setValidationResult(null)
    setAuditResult(null)
    setSnapshots([])
    setDistractionEvents([])
    setStateTransitions([])
    setStateTimeSummary(null)
    setValidationErr(null)
    try {
      const res = await window.focusEngineAPI.validateAllBufferData()
      if (res.success && res.data) {
        setSnapshotResult(res.data)
      } else {
        setValidationErr(res.error || 'Failed to validate snapshot gaps.')
      }
    } catch (err: any) {
      setValidationErr(err.message || String(err))
    } finally {
      setSnapshotLoading(false)
    }
  }

  const handleValidate = async () => {
    if (!selectedSessionId.trim()) return

    setValidating(true)
    setValidationResult(null)
    setBulkResult(null)
    setAuditResult(null)
    setSnapshots([])
    setDistractionEvents([])
    setStateTransitions([])
    setStateTimeSummary(null)
    setValidationErr(null)

    try {
      const res = await window.focusEngineAPI.validateSession(selectedSessionId)
      if (res.success && res.data) {
        setValidationResult(res.data)
      } else {
        setValidationErr(res.error || 'Failed to validate session telemetry.')
      }
    } catch (err: any) {
      setValidationErr(err.message || String(err))
    } finally {
      setValidating(false)
    }
  }

  const handleAuditAndReplay = async () => {
    if (!selectedSessionId.trim()) return

    setAuditing(true)
    setValidationResult(null)
    setBulkResult(null)
    setAuditResult(null)
    setSnapshots([])
    setDistractionEvents([])
    setStateTransitions([])
    setStateTimeSummary(null)
    setValidationErr(null)

    try {
      const auditRes = await window.focusEngineAPI.auditSessionBuffer(selectedSessionId)
      if (auditRes.success) {
        setAuditResult(auditRes.data)
      } else {
        setValidationErr(auditRes.error || 'Failed to audit buffer sync.')
      }

      const snapshotsRes = await window.focusEngineAPI.getBufferSnapshots(selectedSessionId)
      if (snapshotsRes.success && snapshotsRes.data) {
        setSnapshots(snapshotsRes.data)
      }

      const eventsRes = await window.focusEngineAPI.getDistractionEvents(selectedSessionId)
      if (eventsRes.success && eventsRes.data) {
        setDistractionEvents(eventsRes.data)
      }

      const transRes = await window.focusEngineAPI.getBufferStateTransitions(selectedSessionId)
      if (transRes.success && transRes.data) {
        setStateTransitions(transRes.data)
      }

      const summaryRes = await window.focusEngineAPI.getBufferStateTimeSummary(selectedSessionId)
      if (summaryRes.success && summaryRes.data) {
        setStateTimeSummary(summaryRes.data)
      }
    } catch (err: any) {
      setValidationErr(err.message || String(err))
    } finally {
      setAuditing(false)
    }
  }

  return (
    <div style={{ padding: '30px', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
          Telemetry Diagnostics & Integrity Validator
        </h1>
        <p style={{ fontSize: '14px', color: '#94a3b8' }}>
          Review and audit the completeness of window focus, keyboard, and mouse logs captured across focus sessions.
        </p>
      </div>

      <Card title="Select Session to Audit">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>Session ID</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                style={{
                  flex: 1,
                  backgroundColor: '#0f0f17',
                  border: '1px solid #232336',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  padding: '8px 12px',
                  fontSize: '14px'
                }}
              >
                {sessions.map((s) => (
                  <option key={s.session_id} value={s.session_id}>
                    {new Date(s.start_time).toLocaleString()} ({s.session_mode} - {s.duration_actual_sec || 0}s) [{s.session_id.substring(0, 8)}]
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Enter Session UUID"
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                style={{
                  width: '260px',
                  backgroundColor: '#0f0f17',
                  border: '1px solid #232336',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  padding: '8px 12px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={handleValidate} disabled={validating || auditing || bulkLoading || !selectedSessionId}>
              {validating ? (
                <>
                  <RefreshCw size={16} className="spin" style={{ marginRight: '8px' }} />
                  Validating DB...
                </>
              ) : (
                'Validate DB Tables'
              )}
            </Button>
            <Button variant="primary" onClick={handleAuditAndReplay} disabled={validating || auditing || bulkLoading || !selectedSessionId} style={{ backgroundColor: '#4f46e5' }}>
              {auditing ? (
                <>
                  <RefreshCw size={16} className="spin" style={{ marginRight: '8px' }} />
                  Running Audit...
                </>
              ) : (
                'Audit Buffer Sync & Replay'
              )}
            </Button>
            <Button variant="secondary" onClick={handleValidateAll} disabled={validating || auditing || bulkLoading || snapshotLoading}>
              {bulkLoading ? (
                <>
                  <RefreshCw size={16} className="spin" style={{ marginRight: '8px' }} />
                  Bulk Auditing...
                </>
              ) : (
                'Validate All Sessions'
              )}
            </Button>
            <Button variant="secondary" onClick={handleValidateSnapshotGaps} disabled={validating || auditing || bulkLoading || snapshotLoading} style={{ backgroundColor: '#0d9488', color: '#ffffff' }}>
              {snapshotLoading ? (
                <>
                  <RefreshCw size={16} className="spin" style={{ marginRight: '8px' }} />
                  Validating Gaps...
                </>
              ) : (
                'Validate Snapshot Gaps'
              )}
            </Button>
            <Button variant="ghost" onClick={loadSessions} disabled={loadingSessions}>
              Refresh Sessions
            </Button>
          </div>
        </div>
      </Card>

      {validationErr && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', borderRadius: '8px', padding: '12px 16px', color: '#ef4444', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <ShieldAlert size={18} />
          <span style={{ fontSize: '14px' }}>{validationErr}</span>
        </div>
      )}

      {validationResult && (
        <Card title="Audit Findings">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Status Summary Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: validationResult.isValid && validationResult.warnings.length === 0
                  ? 'rgba(16, 185, 129, 0.08)'
                  : validationResult.isValid
                  ? 'rgba(245, 158, 11, 0.08)'
                  : 'rgba(239, 68, 68, 0.08)',
                border: `1.5px solid ${
                  validationResult.isValid && validationResult.warnings.length === 0
                    ? '#10b981'
                    : validationResult.isValid
                    ? '#f59e0b'
                    : '#ef4444'
                }`
              }}
            >
              {validationResult.isValid && validationResult.warnings.length === 0 ? (
                <CheckCircle2 size={24} style={{ color: '#10b981' }} />
              ) : validationResult.isValid ? (
                <AlertTriangle size={24} style={{ color: '#f59e0b' }} />
              ) : (
                <ShieldAlert size={24} style={{ color: '#ef4444' }} />
              )}
              
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                  {validationResult.isValid && validationResult.warnings.length === 0
                    ? 'All Telemetry Validated!'
                    : validationResult.isValid
                    ? 'Validated with Warnings'
                    : 'Telemetry Integrity Failed'}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  {validationResult.errors.length} errors and {validationResult.warnings.length} warnings detected.
                </div>
              </div>
            </div>

            {/* Error List */}
            {validationResult.errors.length > 0 && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Critical Integrity Errors ({validationResult.errors.length})
                </div>
                <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {validationResult.errors.map((err, i) => (
                    <li key={i} style={{ fontSize: '13px', color: '#ef4444', lineHeight: '1.4' }}>
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warning List */}
            {validationResult.warnings.length > 0 && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Warnings ({validationResult.warnings.length})
                </div>
                <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {validationResult.warnings.map((warn, i) => (
                    <li key={i} style={{ fontSize: '13px', color: '#f59e0b', lineHeight: '1.4' }}>
                      {warn}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {validationResult.isValid && validationResult.errors.length === 0 && validationResult.warnings.length === 0 && (
              <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '10px 0' }}>
                No database inconsistencies or collection gaps detected. This telemetry log is perfect!
              </div>
            )}
          </div>
        </Card>
      )}

      {snapshotResult && (
        <Card title="Focus Buffer Snapshot Validation Findings">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
              <div style={{ backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Audited Sessions</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>{snapshotResult.totalSessions}</div>
              </div>
              <div style={{ backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Sessions with Gaps</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: snapshotResult.sessionsWithGaps > 0 ? '#ef4444' : '#10b981' }}>{snapshotResult.sessionsWithGaps}</div>
              </div>
              <div style={{ backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Expected Snapshots</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>{snapshotResult.totalExpectedSnapshots}</div>
              </div>
              <div style={{ backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Actual Snapshots</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>{snapshotResult.totalActualSnapshots}</div>
              </div>
              <div style={{ backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Missing Minutes</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: snapshotResult.totalMissingMinutes > 0 ? '#f59e0b' : '#10b981' }}>{snapshotResult.totalMissingMinutes}</div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Audited Snapshots Logs
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                {snapshotResult.details.map((res: any, idx: number) => {
                  const hasAnomaly = res.missingMinutes > 0 || res.gaps.length > 0
                  return (
                    <div
                      key={idx}
                      style={{
                        border: `1px solid ${hasAnomaly ? 'rgba(245, 158, 11, 0.4)' : '#1e1e2f'}`,
                        borderRadius: '8px',
                        padding: '12px',
                        backgroundColor: hasAnomaly ? 'rgba(245, 158, 11, 0.03)' : '#0c0c14',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1' }}>
                          Session: {res.sessionId.substring(0, 8)}... ({res.sessionMode})
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: hasAnomaly ? '#f59e0b' : '#10b981',
                            color: '#1e293b'
                          }}
                        >
                          {hasAnomaly ? 'Gaps/Missing Snapshots' : 'Healthy (Gap-Free)'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Active Duration: {res.durationActualSec}s | Expected Snapshots: {res.expectedCount} | Actual: {res.actualCount}
                        {res.missingMinutes > 0 && <span style={{ color: '#f59e0b', marginLeft: '12px', fontWeight: 600 }}>⚠️ {res.missingMinutes} missing minute{res.missingMinutes > 1 ? 's' : ''}</span>}
                      </div>
                      {res.gaps.length > 0 && (
                        <div style={{ marginTop: '4px', padding: '8px', backgroundColor: '#0f0f17', borderRadius: '6px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: '#fca5a5', marginBottom: '4px' }}>Specific Gaps Identified:</div>
                          {res.gaps.map((g: any, gIdx: number) => (
                            <div key={gIdx} style={{ fontSize: '11px', color: '#94a3b8' }}>
                              • Gap between {new Date(g.startTime).toLocaleTimeString()} and {new Date(g.endTime).toLocaleTimeString()} ({g.gapDurationSec}s elapsed)
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {bulkResult && (
        <Card title="Bulk Telemetry Audit Findings">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Bulk summary figures */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
              <div style={{ backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Audited Sessions</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>{bulkResult.totalSessionsAudited}</div>
              </div>
              <div style={{ backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Invalid Sessions</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: bulkResult.invalidSessions > 0 ? '#ef4444' : '#10b981' }}>{bulkResult.invalidSessions}</div>
              </div>
              <div style={{ backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Total Errors</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: bulkResult.totalErrors > 0 ? '#ef4444' : '#f8fafc' }}>{bulkResult.totalErrors}</div>
              </div>
              <div style={{ backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Total Warnings</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: bulkResult.totalWarnings > 0 ? '#f59e0b' : '#f8fafc' }}>{bulkResult.totalWarnings}</div>
              </div>
              <div style={{ backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Orphaned Sessions</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: bulkResult.orphanedSessionsCount > 0 ? '#ef4444' : '#f8fafc' }}>{bulkResult.orphanedSessionsCount}</div>
              </div>
            </div>

            {/* List of sessions with anomalies */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Audited Sessions Logs
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                {bulkResult.results.map((res: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      border: `1px solid ${res.isValid ? '#1e1e2f' : 'rgba(239, 68, 68, 0.4)'}`,
                      borderRadius: '8px',
                      padding: '12px',
                      backgroundColor: res.isValid ? '#0c0c14' : 'rgba(239, 68, 68, 0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13px', color: '#f8fafc' }}>{res.dateLabel}</strong>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: res.isValid && res.warnings.length === 0 ? 'rgba(16, 185, 129, 0.15)' : res.isValid ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: res.isValid && res.warnings.length === 0 ? '#10b981' : res.isValid ? '#f59e0b' : '#ef4444'
                        }}
                      >
                        {res.isValid && res.warnings.length === 0 ? 'CLEAN' : res.isValid ? 'WARNINGS' : 'FAILED'}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', wordBreak: 'break-all' }}>
                      UUID: {res.sessionId}
                    </div>
                    {(res.errors.length > 0 || res.warnings.length > 0) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px dashed #1e1e2f', paddingTop: '6px', marginTop: '4px' }}>
                        {res.errors.map((err: string, i: number) => (
                          <div key={i} style={{ fontSize: '11px', color: '#ef4444', display: 'flex', gap: '6px' }}>
                            <span>❌</span> <span>{err}</span>
                          </div>
                        ))}
                        {res.warnings.map((warn: string, i: number) => (
                          <div key={i} style={{ fontSize: '11px', color: '#f59e0b', display: 'flex', gap: '6px' }}>
                            <span>⚠️</span> <span>{warn}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {auditResult && (
        <Card title="Focus Buffer Synchronization Audit">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Status Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                borderRadius: '8px',
                backgroundColor:
                  auditResult.windowStaleAlerts.length === 0 &&
                  auditResult.cvStaleAlerts.length === 0 &&
                  auditResult.doublePenaltyAlerts.length === 0
                    ? 'rgba(16, 185, 129, 0.08)'
                    : 'rgba(245, 158, 11, 0.08)',
                border: `1.5px solid ${
                  auditResult.windowStaleAlerts.length === 0 &&
                  auditResult.cvStaleAlerts.length === 0 &&
                  auditResult.doublePenaltyAlerts.length === 0
                    ? '#10b981'
                    : '#f59e0b'
                }`
              }}
            >
              {auditResult.windowStaleAlerts.length === 0 &&
              auditResult.cvStaleAlerts.length === 0 &&
              auditResult.doublePenaltyAlerts.length === 0 ? (
                <CheckCircle2 size={24} style={{ color: '#10b981' }} />
              ) : (
                <AlertTriangle size={24} style={{ color: '#f59e0b' }} />
              )}

              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                  {auditResult.windowStaleAlerts.length === 0 &&
                  auditResult.cvStaleAlerts.length === 0 &&
                  auditResult.doublePenaltyAlerts.length === 0
                    ? 'All Signal Timing Synchronized!'
                    : 'Synchronization Anomalies Detected'}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  Found {auditResult.windowStaleAlerts.length} stale window focus checks,{' '}
                  {auditResult.cvStaleAlerts.length} stale CV ticks, and{' '}
                  {auditResult.doublePenaltyAlerts.length} overlapping double penalties.
                </div>
              </div>
            </div>

            {/* Overlapping Double Penalties Warning */}
            {auditResult.doublePenaltyAlerts.length > 0 && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldAlert size={16} /> Double-Penalty Overlaps Detected
                </div>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px', lineHeight: '1.4' }}>
                  Both <strong>blacklist_visit</strong> (-10) and <strong>sustained_distraction</strong> (-8) triggered for the same domain within 60s. Double-penalizing is resolved inside the penalty calculator to apply only the larger penalty.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {auditResult.doublePenaltyAlerts.map((dp: any, i: number) => (
                    <div key={i} style={{ fontSize: '12px', color: '#f8fafc', padding: '8px 12px', backgroundColor: '#0f0f17', border: '1px solid #1c1c2b', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Domain: <strong style={{ color: '#ef4444' }}>{dp.domain}</strong></span>
                      <span style={{ color: '#64748b' }}>Trigger Difference: {dp.timeDiffSec}s</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Window Stale Gaps */}
            {auditResult.windowStaleAlerts.length > 0 && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Window Focus Collection Gaps (&gt;10s)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {auditResult.windowStaleAlerts.map((alert: any, i: number) => (
                    <div key={i} style={{ fontSize: '12px', color: '#94a3b8', padding: '6px 10px', backgroundColor: '#0f0f17', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Collection Loop Lagged</span>
                      <span style={{ color: '#f59e0b' }}>Gap: {alert.timeGapSec} seconds</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CV Stale Gaps */}
            {auditResult.cvStaleAlerts.length > 0 && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Computer Vision Frame Gaps (&gt;2s)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {auditResult.cvStaleAlerts.map((alert: any, i: number) => (
                    <div key={i} style={{ fontSize: '12px', color: '#94a3b8', padding: '6px 10px', backgroundColor: '#0f0f17', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>OpenCV Processing delay</span>
                      <span style={{ color: '#f59e0b' }}>Gap: {alert.timeGapSec} seconds</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {auditResult.cvArchived && (
              <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', fontStyle: 'italic' }}>
                Note: Raw CV frame metrics were summarized and deleted on session completion to conserve database space. Tick gaps check bypassed.
              </div>
            )}
          </div>
        </Card>
      )}

      {snapshots.length > 0 && (
        <Card title="Focus Buffer Trajectory Replay">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <BufferTrajectoryChart snapshots={snapshots} events={distractionEvents} />

            {/* List of logged events */}
            {distractionEvents.length > 0 && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                  Logged Distraction Events Timeline
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {distractionEvents.map((evt: any, idx: number) => {
                    let desc = ''
                    try {
                      const data = JSON.parse(evt.event_data)
                      if (evt.event_type === 'blacklist_visit') desc = `Visited blocklisted domain: ${data.domain}`
                      else if (evt.event_type === 'sustained_distraction') desc = `Sustained distraction on: ${data.domain}`
                      else if (evt.event_type === 'excessive_switching') desc = `Excessive app switching: ${data.switchCount} times`
                      else if (evt.event_type === 'extended_idle') desc = `Extended user idle duration: ${data.idleSeconds}s`
                    } catch {
                      desc = evt.event_data
                    }

                    return (
                      <div key={idx} style={{ fontSize: '12px', padding: '10px 12px', backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ color: '#f8fafc', textTransform: 'capitalize' }}>{evt.event_type.replace('_', ' ')}</strong>
                          <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>{desc}</div>
                        </div>
                        <span style={{ color: '#64748b' }}>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {stateTransitions.length > 0 && (
        <Card title="Focus Buffer State Transitions History">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Durations Grid */}
            {stateTimeSummary && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                  Total Duration In Each State
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                  {Object.entries(stateTimeSummary).map(([sName, durMs]: any) => {
                    let color = '#818cf8'
                    if (sName === 'focused') color = '#10b981'
                    else if (sName === 'warning') color = '#f59e0b'
                    else if (sName === 'critical') color = '#ef4444'
                    else if (sName === 'paused') color = '#64748b'

                    return (
                      <div key={sName} style={{ backgroundColor: '#0f0f17', border: '1px solid #1e1e2f', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>{sName}</span>
                        <strong style={{ fontSize: '16px', color }}>{Math.round(durMs / 1000)}s</strong>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Transition Chronology Log */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Chronological Transition Timeline
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {stateTransitions.map((t: any, idx: number) => {
                  let badgeColor = '#818cf8'
                  let badgeText = '#f8fafc'
                  if (t.state === 'focused') {
                    badgeColor = '#10b981'
                    badgeText = '#064e3b'
                  } else if (t.state === 'warning') {
                    badgeColor = '#f59e0b'
                    badgeText = '#78350f'
                  } else if (t.state === 'critical') {
                    badgeColor = '#ef4444'
                    badgeText = '#7f1d1d'
                  } else if (t.state === 'paused') {
                    badgeColor = '#64748b'
                    badgeText = '#0f172a'
                  }

                  const startStr = new Date(t.start_time).toLocaleTimeString()
                  const endStr = t.end_time ? new Date(t.end_time).toLocaleTimeString() : 'Active'
                  const durStr = t.duration ? `${Math.round(t.duration / 1000)}s` : 'Ongoing'

                  return (
                    <div key={idx} style={{ padding: '10px 12px', backgroundColor: '#0c0c14', border: '1px solid #1e1e2f', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: badgeText, backgroundColor: badgeColor, padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                          {t.state}
                        </span>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {startStr} → {endStr}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>
                        {durStr}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default Debug
