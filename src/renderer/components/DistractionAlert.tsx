import React, { useEffect, useState } from 'react'
import { ShieldAlert, MousePointer, Monitor, X } from 'lucide-react'

interface DistractionEvent {
  eventType: 'sustained_distraction' | 'excessive_switching' | 'blacklist_visit' | 'extended_idle'
  eventData: any
  timestamp: number
}

const DistractionAlert: React.FC = () => {
  const [queue, setQueue] = useState<DistractionEvent[]>([])
  const [activeAlert, setActiveAlert] = useState<DistractionEvent | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  // Listen to global distraction events broadcast from main process
  useEffect(() => {
    const unsub = window.focusEngineAPI.onDistractionEvent((event: any) => {
      setQueue((prev) => [...prev, event])
    })
    return () => unsub()
  }, [])

  // Process the queue one by one
  useEffect(() => {
    if (activeAlert || queue.length === 0) return

    const next = queue[0]
    setQueue((prev) => prev.slice(1))
    setActiveAlert(next)
    setIsVisible(true)

    // Auto dismiss after 5 seconds
    const dismissTimer = setTimeout(() => {
      handleDismiss()
    }, 5000)

    return () => clearTimeout(dismissTimer)
  }, [queue, activeAlert])

  const handleDismiss = () => {
    setIsVisible(false)
    // Wait for slide-up transition to finish before fetching next from queue
    setTimeout(() => {
      setActiveAlert(null)
    }, 300)
  }

  if (!activeAlert) return null

  // Resolve icons and description copy
  const getAlertDetails = () => {
    switch (activeAlert.eventType) {
      case 'sustained_distraction':
        return {
          title: 'Sustained Distraction',
          desc: `You've been on ${activeAlert.eventData.appName} (${activeAlert.eventData.domain}) for over 60 seconds.`,
          icon: <ShieldAlert size={20} style={{ color: '#ef4444' }} />,
          border: '#ef4444'
        }
      case 'excessive_switching':
        return {
          title: 'Excessive App Switching',
          desc: `Switched applications ${activeAlert.eventData.switchCount} times in under 2 minutes. Slow down and single-task!`,
          icon: <Monitor size={20} style={{ color: '#f59e0b' }} />,
          border: '#f59e0b'
        }
      case 'blacklist_visit':
        return {
          title: 'Distracting Website Visited',
          desc: `Blacklisted domain "${activeAlert.eventData.domain}" was opened.`,
          icon: <ShieldAlert size={20} style={{ color: '#ef4444' }} />,
          border: '#ef4444'
        }
      case 'extended_idle':
        return {
          title: 'Extended Inactivity',
          desc: `No mouse or keyboard input detected for over 3 minutes.`,
          icon: <MousePointer size={20} style={{ color: '#64748b' }} />,
          border: '#64748b'
        }
      default:
        return {
          title: 'Focus Alert',
          desc: 'A distraction event was detected.',
          icon: <ShieldAlert size={20} style={{ color: '#818cf8' }} />,
          border: '#818cf8'
        }
    }
  }

  const details = getAlertDetails()

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: `translateX(-50%) translateY(${isVisible ? '0' : '-120px'})`,
        opacity: isVisible ? 1 : 0,
        zIndex: 99999,
        backgroundColor: '#181824',
        border: `1.5px solid ${details.border}`,
        borderRadius: '12px',
        padding: '16px 20px',
        width: '420px',
        maxWidth: 'calc(100% - 40px)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px',
        transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      <div style={{ marginTop: '2px' }}>{details.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
          {details.title}
        </h4>
        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
          {details.desc}
        </p>
      </div>
      <button
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#475569',
          cursor: 'pointer',
          padding: '2px',
          borderRadius: '4px',
          display: 'flex',
          alignSelf: 'center',
          transition: 'color 0.2s'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#f8fafc')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
      >
        <X size={16} />
      </button>
    </div>
  )
}

export default DistractionAlert
