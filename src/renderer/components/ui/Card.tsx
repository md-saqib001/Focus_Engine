import React from 'react'

export interface CardProps {
  title?: string
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export const Card: React.FC<CardProps> = ({ title, children, className = '', style }) => {
  return (
    <div
      style={{
        backgroundColor: '#181824',
        border: '1.5px solid #272738',
        borderRadius: '20px',
        padding: '20px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        fontFamily: 'Inter, sans-serif',
        ...style
      }}
      className={`ui-card ${className}`}
    >
      {title && (
        <h2
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#f8fafc',
            marginBottom: '16px',
            borderBottom: '1px solid #272738',
            paddingBottom: '12px'
          }}
        >
          {title}
        </h2>
      )}
      <div style={{ color: '#94a3b8' }}>{children}</div>
    </div>
  )
}
