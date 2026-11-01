import React from 'react'
import {
  Lock,
  Clock,
  Globe,
  AppWindow,
  CheckCircle,
  Lightbulb
} from 'lucide-react'

export interface RecommendationResult {
  hasEnoughData: boolean
  totalSessionsCount: number
  bestFocusWindow: {
    startHour: number
    endHour: number
    avgScore: number
    sessionCount: number
  } | null
  mostDistractingApp: {
    appName: string
    killCount: number
  } | null
  mostDistractingDomain: {
    domain: string
    visitCount: number
  } | null
  recommendations: string[]
}

interface RecommendationsPanelProps {
  data: RecommendationResult
  overallScore: number | null
}

// Simple parser to turn markdown-like **text** into bold JSX elements
function parseBoldText(text: string) {
  const parts = text.split('**')
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return (
        <strong key={index} style={{ color: '#f8fafc', fontWeight: 600 }}>
          {part}
        </strong>
      )
    }
    return part
  })
}

export const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({ data, overallScore }) => {
  // Determine overall score color config dynamically
  const getOverallConfig = () => {
    if (overallScore === null) {
      return {
        color: '#818cf8',
        bgColor: 'rgba(129, 140, 248, 0.08)'
      }
    }
    if (overallScore >= 75) {
      return {
        color: '#10b981', // green for good score
        bgColor: 'rgba(16, 185, 129, 0.08)'
      }
    }
    if (overallScore >= 50) {
      return {
        color: '#f59e0b', // amber for caution
        bgColor: 'rgba(245, 158, 11, 0.08)'
      }
    }
    return {
      color: '#ef4444', // red for low score
      bgColor: 'rgba(239, 68, 68, 0.08)'
    }
  }

  const overallConfig = getOverallConfig()

  // Define colors and icons for each card index
  const cardConfig = [
    {
      title: 'Peak Focus Window',
      icon: Clock,
      color: '#10b981', // green
      bgColor: 'rgba(16, 185, 129, 0.08)'
    },
    {
      title: 'Application Distractions',
      icon: AppWindow,
      color: '#ef4444', // red for distraction
      bgColor: 'rgba(239, 68, 68, 0.08)'
    },
    {
      title: 'Website Distractions',
      icon: Globe,
      color: '#ef4444', // red for distraction (consistent red semantics)
      bgColor: 'rgba(239, 68, 68, 0.08)'
    },
    {
      title: 'Overall Focus Performance',
      icon: CheckCircle,
      color: overallConfig.color,
      bgColor: overallConfig.bgColor
    }
  ]

  // If there are less than 10 sessions completed, show a friendly lock/placeholder card
  if (!data.hasEnoughData) {
    return (
      <div
        style={{
          background: '#0f0f17',
          borderRadius: '16px',
          border: '1px solid #1e1e2f',
          padding: '40px 32px',
          textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          fontFamily: 'Inter, sans-serif'
        }}
      >
        <div
          style={{
            background: 'rgba(129, 140, 248, 0.1)',
            borderRadius: '50%',
            width: '64px',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818cf8',
            marginBottom: '8px'
          }}
        >
          <Lock size={32} />
        </div>

        <h3
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#f8fafc',
            margin: 0
          }}
        >
          Unlock Personalized Recommendations
        </h3>

        <p
          style={{
            fontSize: '14px',
            color: '#64748b',
            lineHeight: '1.6',
            maxWidth: '480px',
            margin: 0
          }}
        >
          To make suggestions accurate and tailored to your work habits, Focus Engine requires data from at least **10 completed focus sessions**.
        </p>

        <div style={{ width: '100%', maxWidth: '300px', marginTop: '8px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#818cf8',
              marginBottom: '6px',
              fontWeight: 600
            }}
          >
            <span>PROGRESS</span>
            <span>{data.totalSessionsCount} / 10 sessions</span>
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#1e1e2f',
              borderRadius: '4px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${Math.min(100, (data.totalSessionsCount / 10) * 100)}%`,
                height: '100%',
                backgroundColor: '#818cf8',
                borderRadius: '4px',
                transition: 'width 0.4s ease'
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: 'Inter, sans-serif' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#f8fafc',
          marginBottom: '8px'
        }}
      >
        <Lightbulb size={20} style={{ color: '#818cf8' }} />
        <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
          Personalized Focus Insights
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {data.recommendations.map((rec, index) => {
          const config = cardConfig[index] || {
            title: 'Insight',
            icon: Lightbulb,
            color: '#818cf8',
            bgColor: 'rgba(129, 140, 248, 0.08)'
          }
          const IconComponent = config.icon

          return (
            <div
              key={index}
              style={{
                backgroundColor: '#181824',
                border: '1px solid #272738',
                borderLeft: `4px solid ${config.color}`,
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                gap: '16px',
                alignItems: 'center',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                transition: 'transform 0.2s ease, border-color 0.2s ease',
                cursor: 'default'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.borderColor = '#383852'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.borderColor = '#272738'
              }}
            >
              <div
                style={{
                  minWidth: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: config.bgColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: config.color
                }}
              >
                <IconComponent size={20} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {config.title}
                </span>
                <span
                  style={{
                    fontSize: '14px',
                    color: '#94a3b8',
                    lineHeight: '1.5'
                  }}
                >
                  {parseBoldText(rec)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
