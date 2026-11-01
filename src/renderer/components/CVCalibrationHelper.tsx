import React, { useState, useEffect, useRef } from 'react'
import { Button } from './ui'
import { Camera, Check, AlertCircle, Play, RotateCcw, Keyboard, Monitor } from 'lucide-react'

interface CVCalibrationHelperProps {
  onClose: () => void
}

interface CalibTarget {
  key: string
  label: string
  group: 'screen' | 'keyboard'
  subKey: string
  instruction: string
  diagramX: string // percentage for visual indicator
  diagramY: string // percentage for visual indicator
}

const CALIB_TARGETS: CalibTarget[] = [
  { key: 'screen_center', label: 'Screen Center', group: 'screen', subKey: 'center', instruction: 'Look directly at the center of your monitor.', diagramX: '50%', diagramY: '50%' },
  { key: 'screen_top_left', label: 'Screen Top-Left', group: 'screen', subKey: 'top_left', instruction: 'Look at the very top-left corner of your monitor.', diagramX: '10%', diagramY: '10%' },
  { key: 'screen_top_right', label: 'Screen Top-Right', group: 'screen', subKey: 'top_right', instruction: 'Look at the very top-right corner of your monitor.', diagramX: '90%', diagramY: '10%' },
  { key: 'screen_bottom_left', label: 'Screen Bottom-Left', group: 'screen', subKey: 'bottom_left', instruction: 'Look at the very bottom-left corner of your monitor.', diagramX: '10%', diagramY: '90%' },
  { key: 'screen_bottom_right', label: 'Screen Bottom-Right', group: 'screen', subKey: 'bottom_right', instruction: 'Look at the very bottom-right corner of your monitor.', diagramX: '90%', diagramY: '90%' },
  { key: 'keyboard_center', label: 'Keyboard Center', group: 'keyboard', subKey: 'center', instruction: 'Look down at the center of your keyboard (e.g. G/H keys).', diagramX: '50%', diagramY: '50%' },
  { key: 'keyboard_top_left', label: 'Keyboard Top-Left', group: 'keyboard', subKey: 'top_left', instruction: 'Look down at the top-left area of your keyboard (e.g. Esc/1/Tab).', diagramX: '10%', diagramY: '20%' },
  { key: 'keyboard_top_right', label: 'Keyboard Top-Right', group: 'keyboard', subKey: 'top_right', instruction: 'Look down at the top-right area of your keyboard (e.g. Backspace/Delete).', diagramX: '90%', diagramY: '20%' },
  { key: 'keyboard_bottom_left', label: 'Keyboard Bottom-Left', group: 'keyboard', subKey: 'bottom_left', instruction: 'Look down at the bottom-left area of your keyboard (e.g. Left Ctrl/Shift).', diagramX: '10%', diagramY: '80%' },
  { key: 'keyboard_bottom_right', label: 'Keyboard Bottom-Right', group: 'keyboard', subKey: 'bottom_right', instruction: 'Look down at the bottom-right area of your keyboard (e.g. Arrow keys).', diagramX: '90%', diagramY: '80%' }
]

const CVCalibrationHelper: React.FC<CVCalibrationHelperProps> = ({ onClose }) => {
  const [step, setStep] = useState<'intro' | 'warmup' | 'prep' | 'recording' | 'processing' | 'done' | 'error'>('intro')
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const [facePresent, setFacePresent] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)
  const [previewFrame, setPreviewFrame] = useState<string | null>(null)

  // Temporary storage of all collected points
  const collectedData = useRef<Record<string, Record<string, { yaw: number; pitch: number; gaze_ratio: number }>>>({
    screen: {},
    keyboard: {}
  })

  // Buffer to store active samples during the current 3-second recording phase
  const currentSamples = useRef<{ yaw: number; pitch: number; gaze_ratio: number }[]>([])
  const activeStep = useRef(step)
  const countdownIntervalRef = useRef<any>(null)

  useEffect(() => {
    activeStep.current = step
  }, [step])

  // Handle live CV update subscription
  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    if (step === 'warmup' || step === 'recording') {
      unsubscribe = window.focusEngineAPI.onCVUpdate((data) => {
        setFacePresent(data.face_present)
        if (data.preview_frame) {
          setPreviewFrame(data.preview_frame)
        }
        
        if (activeStep.current === 'warmup') {
          // Once a face is detected during warmup, transition to first target prep
          if (data.face_present && data.yaw !== null && data.pitch !== null) {
            setStep('prep')
          }
        } else if (activeStep.current === 'recording') {
          if (data.face_present && data.yaw !== null && data.pitch !== null) {
            currentSamples.current.push({
              yaw: data.yaw,
              pitch: data.pitch,
              gaze_ratio: data.gaze_ratio !== null ? data.gaze_ratio : 0.50
            })
          }
        }
      })
    }

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [step])

  // Manage countdowns and state transitions
  useEffect(() => {
    if (step === 'prep') {
      currentSamples.current = [] // clear samples before recording starts
      runCountdown(3, () => {
        setStep('recording')
      })
    } else if (step === 'recording') {
      runCountdown(3, () => {
        saveCurrentTargetData()
      })
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
    }
  }, [step, currentTargetIndex])

  const runCountdown = (seconds: number, onComplete: () => void) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
    }
    setCountdown(seconds)
    let currentCount = seconds
    countdownIntervalRef.current = setInterval(() => {
      currentCount -= 1
      setCountdown(currentCount)
      if (currentCount <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current)
          countdownIntervalRef.current = null
        }
        onComplete()
      }
    }, 1000)
  }

  const startCalibration = async () => {
    try {
      // Reset targets index and results
      setCurrentTargetIndex(0)
      collectedData.current = { screen: {}, keyboard: {} }
      setResetSuccess(false)
      
      // Start CV process at 5fps to capture denser calibration data
      await window.focusEngineAPI.startCV('calibration_session', 5)
      setStep('warmup')
    } catch (err: any) {
      console.error('[CVCalibrationHelper] Failed to start:', err)
      setErrorMsg(err.message || String(err))
      setStep('error')
    }
  }

  const saveCurrentTargetData = () => {
    const target = CALIB_TARGETS[currentTargetIndex]
    const samples = currentSamples.current

    if (samples.length === 0) {
      // Fail calibration if no samples could be gathered (e.g. face lost or poor lighting)
      window.focusEngineAPI.stopCV()
      setErrorMsg(`No facial data detected during the calibration of "${target.label}". Please align your camera, ensure adequate lighting, and retry.`)
      setStep('error')
      return
    }

    // Compute median of samples to filter out transient blinks or noise
    const median = (arr: number[]) => {
      const sorted = [...arr].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    }

    const avgYaw = median(samples.map(s => s.yaw))
    const avgPitch = median(samples.map(s => s.pitch))
    const avgGaze = median(samples.map(s => s.gaze_ratio))

    // Store under the appropriate group (screen/keyboard) and subKey (center/top_left etc.)
    collectedData.current[target.group][target.subKey] = {
      yaw: round(avgYaw),
      pitch: round(avgPitch),
      gaze_ratio: round(avgGaze)
    }

    // Move to next target or process final results
    if (currentTargetIndex < CALIB_TARGETS.length - 1) {
      setCurrentTargetIndex(prev => prev + 1)
      setStep('prep')
    } else {
      processCalibration()
    }
  }

  const processCalibration = async () => {
    setStep('processing')
    try {
      await window.focusEngineAPI.stopCV()

      const finalCalibrationPayload = {
        version: 2,
        screen: collectedData.current.screen,
        keyboard: collectedData.current.keyboard
      }

      await window.focusEngineAPI.setCalibration(finalCalibrationPayload)
      setStep('done')
    } catch (err: any) {
      console.error('[CVCalibrationHelper] Processing failed:', err)
      setErrorMsg(err.message || String(err))
      setStep('error')
      await window.focusEngineAPI.stopCV()
    }
  }

  const handleResetToDefault = async () => {
    try {
      await window.focusEngineAPI.resetCalibrationToDefault()
      setResetSuccess(true)
      setTimeout(() => setResetSuccess(false), 3000)
    } catch (err: any) {
      console.error('[CVCalibrationHelper] Reset failed:', err)
      setErrorMsg(err.message || String(err))
      setStep('error')
    }
  }

  const round = (val: number) => Math.round(val * 100) / 100

  const handleAbort = async () => {
    await window.focusEngineAPI.stopCV()
    onClose()
  }

  const activeTarget = CALIB_TARGETS[currentTargetIndex] || CALIB_TARGETS[0]

  return (
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
          maxWidth: '520px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', backgroundColor: 'rgba(96, 165, 250, 0.12)', borderRadius: '12px', color: '#60a5fa' }}>
              <Camera size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>10-Point Eye & Pose Calibration</h2>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Step-by-step attention baseline setup</p>
            </div>
          </div>
          {(step === 'prep' || step === 'recording') && (
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#60a5fa', backgroundColor: 'rgba(96, 165, 250, 0.08)', padding: '4px 10px', borderRadius: '20px' }}>
              Point {currentTargetIndex + 1} / 10
            </div>
          )}
        </div>

        {/* Intro Step */}
        {step === 'intro' && (
          <>
            <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#cbd5e1', margin: 0 }}>
              To ensure optimal accuracy, the Focus Engine calibrates **5 screen positions** and **5 keyboard positions**. 
              This measures both your **head orientation (Yaw/Pitch)** and **iris gaze ratio**, letting it accurately identify when you are working vs looking away.
            </p>
            <div style={{ padding: '16px', backgroundColor: '#1e1e2f', borderRadius: '16px', border: '1px dashed #334155' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>Calibration Targets:</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li>**Monitor View**: Center, Top-Left, Top-Right, Bottom-Left, Bottom-Right</li>
                <li>**Keyboard View**: Center, Top-Left, Top-Right, Bottom-Left, Bottom-Right</li>
              </ul>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <Button
                variant="ghost"
                onClick={handleResetToDefault}
                style={{ border: '1px solid #272738', color: resetSuccess ? '#10b981' : '#cbd5e1' }}
              >
                <RotateCcw size={14} style={{ marginRight: '6px' }} />
                <span>{resetSuccess ? 'Reset Complete!' : 'Reset to Default'}</span>
              </Button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="ghost" onClick={onClose} style={{ border: '1px solid #272738' }}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={startCalibration}>
                  <Play size={14} fill="currentColor" style={{ marginRight: '6px' }} />
                  <span>Start Wizard</span>
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Warmup Step */}
        {step === 'warmup' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '12px 0' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', textAlign: 'center' }}>
              Warming up camera...
            </div>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid #232336', borderTopColor: '#60a5fa', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: '13px', color: '#cbd5e1', textAlign: 'center', margin: '6px 0 0', lineHeight: '1.5' }}>
              Please look directly at the center of your screen. Calibration will begin automatically when your face is detected.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: facePresent ? '#10b981' : '#ef4444', marginTop: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: facePresent ? '#10b981' : '#ef4444' }} />
              {facePresent ? 'Face Detected! Ready...' : 'Searching for face (Adjust lighting/camera index)...'}
            </div>
            {previewFrame && (
              <div style={{ width: '100%', height: '180px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #232336', marginTop: '8px' }}>
                <img src={previewFrame} alt="Warmup Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={handleAbort} style={{ border: '1px solid #272738', marginTop: '12px' }}>
              Abort
            </Button>
          </div>
        )}

        {/* Prep Step */}
        {step === 'prep' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', textTransform: 'uppercase', color: '#60a5fa', fontWeight: 700, letterSpacing: '0.05em' }}>
                Next Position
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 8px 0', color: '#f8fafc' }}>
                {activeTarget.label}
              </h3>
              <p style={{ fontSize: '14px', color: '#cbd5e1', margin: 0, lineHeight: '1.5' }}>
                {activeTarget.instruction}
              </p>
            </div>

            {/* Visual guide diagram */}
            <div style={{
              width: '100%',
              height: '140px',
              backgroundColor: '#11111b',
              borderRadius: '16px',
              border: '1px solid #272738',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              {previewFrame ? (
                <img src={previewFrame} alt="Webcam Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : activeTarget.group === 'screen' ? (
                <Monitor size={52} color="#475569" style={{ opacity: 0.8 }} />
              ) : (
                <Keyboard size={52} color="#475569" style={{ opacity: 0.8 }} />
              )}
              {/* Pulsing Target Dot */}
              <div style={{
                position: 'absolute',
                left: activeTarget.diagramX,
                top: activeTarget.diagramY,
                transform: 'translate(-50%, -50%)',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#60a5fa',
                boxShadow: '0 0 12px #60a5fa',
                animation: 'pulse 1.2s infinite ease-in-out'
              }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Get Ready...</span>
              <div style={{ fontSize: '36px', fontWeight: 800, color: '#f8fafc' }}>{countdown}s</div>
            </div>

            <Button variant="ghost" size="sm" onClick={handleAbort} style={{ border: '1px solid #272738' }}>
              Abort Calibration
            </Button>
          </div>
        )}

        {/* Recording Step */}
        {step === 'recording' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', textTransform: 'uppercase', color: '#10b981', fontWeight: 700, letterSpacing: '0.05em' }}>
                Recording...
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 8px 0', color: '#f8fafc' }}>
                Hold still at {activeTarget.label}
              </h3>
              <p style={{ fontSize: '13px', color: '#cbd5e1', margin: 0 }}>
                Keep looking at the indicator.
              </p>
            </div>

            {/* Visual Guide Box */}
            <div style={{
              width: '100%',
              height: '140px',
              backgroundColor: '#11111b',
              borderRadius: '16px',
              border: '1.5px solid #10b981',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              {previewFrame ? (
                <img src={previewFrame} alt="Webcam Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : activeTarget.group === 'screen' ? (
                <Monitor size={52} color="#1e293b" />
              ) : (
                <Keyboard size={52} color="#1e293b" />
              )}
              {/* Steady Red/Green Dot */}
              <div style={{
                position: 'absolute',
                left: activeTarget.diagramX,
                top: activeTarget.diagramY,
                transform: 'translate(-50%, -50%)',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 16px #10b981'
              }} />
              {/* Moving scanning line */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: 'linear-gradient(to right, transparent, #10b981, transparent)',
                animation: 'scan 1.5s infinite linear'
              }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '100%' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981' }}>{countdown}s remaining</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: facePresent ? '#10b981' : '#ef4444' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: facePresent ? '#10b981' : '#ef4444' }} />
                {facePresent ? 'Calibrating pose & gaze...' : 'Face Lost! Please adjust immediately'}
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={handleAbort} style={{ border: '1px solid #272738' }}>
              Abort
            </Button>
          </div>
        )}

        {/* Processing Step */}
        {step === 'processing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid #232336', borderTopColor: '#60a5fa', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: '14px', color: '#94a3b8' }}>Saving 10-point baseline calibration...</div>
          </div>
        )}

        {/* Done Step */}
        {step === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '12px 0' }}>
            <div style={{ padding: '14px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%', color: '#10b981' }}>
              <Check size={36} />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>Calibration Complete!</div>
            <p style={{ fontSize: '13px', color: '#cbd5e1', textAlign: 'center', margin: '0 0 12px 0', lineHeight: '1.5' }}>
              Your customized 10-point screen and keyboard boundaries have been successfully configured.
            </p>
            <Button variant="primary" onClick={onClose} style={{ width: '120px' }}>
              Finish
            </Button>
          </div>
        )}

        {/* Error Step */}
        {step === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '12px 0' }}>
            <div style={{ padding: '14px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', color: '#ef4444' }}>
              <AlertCircle size={36} />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>Calibration Interrupted</div>
            <p style={{ fontSize: '13px', color: '#fca5a5', textAlign: 'center', margin: '0 0 12px 0', lineHeight: '1.5' }}>
              {errorMsg}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button variant="ghost" onClick={onClose} style={{ border: '1px solid #272738' }}>
                Cancel
              </Button>
              <Button variant="primary" onClick={startCalibration}>
                Retry Wizard
              </Button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.6; }
          50% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
        }
        @keyframes scan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
      `}</style>
    </div>
  )
}

export default CVCalibrationHelper
