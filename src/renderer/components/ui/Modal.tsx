import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scrolling
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === overlayRef.current) {
      onClose()
    }
  }

  const modalContent = (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 15, 23, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999, // Ensure modal floats above everything
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '500px',
          backgroundColor: '#181824',
          border: '1.5px solid #272738',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
          position: 'relative',
          animation: 'slideUp 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          fontFamily: 'Inter, sans-serif'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            borderBottom: '1px solid #272738',
            paddingBottom: '12px'
          }}
        >
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s, color 0.2s'
            }}
            className="modal-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6' }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(12px) scale(0.98); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .modal-close-btn:hover {
          background-color: rgba(148, 163, 184, 0.08);
          color: #ffffff;
        }
      `}</style>
    </div>
  )

  return createPortal(modalContent, document.body)
}
