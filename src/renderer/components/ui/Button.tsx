import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  children,
  style,
  className = '',
  type = 'button',
  ...props
}) => {
  // Styles based on variant
  const getVariantStyles = (): React.CSSProperties => {
    if (disabled) {
      return {
        backgroundColor: '#272738',
        color: '#64748b',
        border: '1px solid #334155',
        cursor: 'not-allowed'
      }
    }

    switch (variant) {
      case 'primary':
        return {
          backgroundColor: '#818cf8',
          color: '#ffffff',
          border: '1px solid transparent',
          cursor: 'pointer'
        }
      case 'secondary':
        return {
          backgroundColor: 'transparent',
          color: '#818cf8',
          border: '1px solid #818cf8',
          cursor: 'pointer'
        }
      case 'danger':
        return {
          backgroundColor: '#ef4444',
          color: '#ffffff',
          border: '1px solid transparent',
          cursor: 'pointer'
        }
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: '#94a3b8',
          border: '1px solid transparent',
          cursor: 'pointer'
        }
    }
  }

  // Styles based on size
  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return {
          padding: '8px 16px',
          fontSize: '13px'
        }
      case 'md':
        return {
          padding: '12px 24px',
          fontSize: '14px'
        }
      case 'lg':
        return {
          padding: '16px 32px',
          fontSize: '16px'
        }
    }
  }

  const baseStyles: React.CSSProperties = {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 600,
    borderRadius: '12px',
    outline: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
  }

  // Generate unique class for custom hover behaviors if needed, or inline hover styles
  const finalStyles = {
    ...baseStyles,
    ...getVariantStyles(),
    ...getSizeStyles(),
    ...style
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={finalStyles}
      className={`btn-ui btn-ui-${variant} ${disabled ? 'btn-ui-disabled' : ''} ${className}`}
      {...props}
    >
      {children}
      {!disabled && (
        <style>{`
          .btn-ui-primary:hover {
            background-color: #6366f1 !important;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(129, 140, 248, 0.3);
          }
          .btn-ui-secondary:hover {
            background-color: rgba(129, 140, 248, 0.08) !important;
            transform: translateY(-1px);
          }
          .btn-ui-danger:hover {
            background-color: #dc2626 !important;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
          }
          .btn-ui-ghost:hover {
            background-color: rgba(148, 163, 184, 0.08) !important;
            color: #ffffff !important;
          }
          .btn-ui:active {
            transform: translateY(0px) !important;
          }
        `}</style>
      )}
    </button>
  )
}
