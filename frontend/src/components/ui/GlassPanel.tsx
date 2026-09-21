import React from 'react';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ children, className = '', elevated = false, style, onClick }) => {
  return (
    <div
      className={`${elevated ? 'glass-elevated' : 'glass'} ${className}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
