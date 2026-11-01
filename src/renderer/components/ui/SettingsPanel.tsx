import React from 'react'

export interface SettingsPanelProps {
  title: string
  children: React.ReactNode
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ title, children }) => {
  return (
    <div
      style={{
        marginBottom: '32px',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      <div style={{ marginBottom: '16px' }}>
        <h3
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#f8fafc',
            margin: '0 0 6px 0'
          }}
        >
          {title}
        </h3>
        <div style={{ height: '1px', backgroundColor: '#272738', width: '100%' }} />
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '4px 0'
        }}
      >
        {children}
      </div>
    </div>
  )
}
