import React, { useEffect, useRef } from 'react';
import { GlassPanel } from './GlassPanel';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, maxWidth = '500px' }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 'var(--space-4)'
      }}
      onClick={onClose}
    >
      <div 
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-in"
        style={{ width: '100%', maxWidth, pointerEvents: 'auto' }}
      >
        <GlassPanel elevated style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--space-4)',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>{title}</h3>
            <button 
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '1.5rem',
                lineHeight: 1
              }}
            >
              ×
            </button>
          </div>
          
          <div style={{ padding: 'var(--space-4)', flex: 1, overflowY: 'auto', maxHeight: '70vh' }}>
            {children}
          </div>

          {footer && (
            <div style={{
              padding: 'var(--space-4)',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'var(--space-2)'
            }}>
              {footer}
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
};
