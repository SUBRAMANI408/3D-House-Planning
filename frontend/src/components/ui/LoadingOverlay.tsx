import React from 'react';

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible, message }) => {
  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(10, 11, 15, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    }}>
      <div style={{ position: 'relative', width: '64px', height: '64px' }}>
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          border: '4px solid transparent',
          borderTopColor: 'var(--accent-primary)',
          borderBottomColor: 'var(--accent-secondary)',
          borderRadius: '50%',
          animation: 'spin 1.5s linear infinite',
        }} />
        <div style={{
          position: 'absolute',
          top: '8px', left: '8px', right: '8px', bottom: '8px',
          border: '4px solid transparent',
          borderLeftColor: 'var(--accent-primary)',
          borderRightColor: 'var(--accent-secondary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite reverse',
        }} />
      </div>
      {message && (
        <p style={{
          marginTop: 'var(--space-4)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          animation: 'pulse-glow 2s infinite ease-in-out',
        }}>
          {message}
        </p>
      )}
    </div>
  );
};
