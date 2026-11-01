import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Dashboard:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            background: '#0f0f17',
            borderRadius: '20px',
            border: '1.5px solid #ef4444',
            maxWidth: '600px',
            margin: '40px auto',
            textAlign: 'center',
            color: '#f8fafc',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          <span style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</span>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 12px 0', color: '#fca5a5' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
            An unexpected error occurred in the active session layout. Don't worry, hosts configuration is handled safely in the background.
          </p>
          <div
            style={{
              background: '#181824',
              border: '1px solid #232336',
              borderRadius: '8px',
              padding: '12px 16px',
              fontFamily: 'monospace',
              fontSize: '12px',
              color: '#fca5a5',
              width: '100%',
              maxWidth: '480px',
              textAlign: 'left',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              marginBottom: '24px'
            }}
          >
            {this.state.error?.toString()}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              backgroundColor: '#818cf8',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '14px',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#6366f1')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#818cf8')}
          >
            Reload Application
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
