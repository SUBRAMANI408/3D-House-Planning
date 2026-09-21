import React, { useEffect } from 'react';
import { useUIStore } from '../../store/uiStore';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export const ToastItem: React.FC<{ toast: Toast; onClose: (id: string) => void }> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  const icons = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ',
  };

  const colors = {
    success: 'var(--color-success)',
    error: 'var(--color-error)',
    warning: 'var(--color-warning)',
    info: 'var(--color-info)',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-3) var(--space-4)',
      marginBottom: 'var(--space-2)',
      background: 'var(--bg-card)',
      borderLeft: `4px solid ${colors[toast.type]}`,
      borderRadius: 'var(--radius-sm)',
      boxShadow: 'var(--shadow-md)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      animation: 'slideUp 0.3s ease forwards',
      pointerEvents: 'auto',
      minWidth: '300px'
    }}>
      <span style={{ color: colors[toast.type], fontWeight: 'bold' }}>{icons[toast.type]}</span>
      <span style={{ flex: 1, fontSize: '0.875rem' }}>{toast.message}</span>
      <button 
        onClick={() => onClose(toast.id)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '1rem',
          padding: '0 var(--space-1)',
        }}
      >
        ×
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  // Mock store hook usage, assuming uiStore has toasts and removeToast
  // In real app, import and use actual store hook
  const toasts = useUIStore((state) => state.toasts);
  const removeToast = useUIStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 'var(--space-4)',
      right: 'var(--space-4)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      pointerEvents: 'none',
    }}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>
  );
};
