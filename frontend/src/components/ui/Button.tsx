import React, { type ButtonHTMLAttributes, forwardRef } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  icon,
  isLoading = false,
  disabled,
  ...props
}, ref) => {
  
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-2)',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    border: 'none',
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    transition: 'all var(--transition-normal)',
    opacity: disabled ? 0.6 : 1,
    outline: 'none',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--accent-primary)',
      color: 'white',
      borderRadius: 'var(--radius-md)',
    },
    secondary: {
      backgroundColor: 'rgba(255,255,255,0.06)',
      backdropFilter: 'blur(16px)',
      border: '1px solid var(--border-subtle)',
      color: 'var(--text-primary)',
      borderRadius: 'var(--radius-md)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--text-primary)',
      border: '1px solid transparent',
      borderRadius: 'var(--radius-md)',
    },
    danger: {
      backgroundColor: 'var(--color-error)',
      color: 'white',
      borderRadius: 'var(--radius-md)',
    },
    success: {
      backgroundColor: 'var(--color-success)',
      color: 'white',
      borderRadius: 'var(--radius-md)',
    }
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: 'var(--space-2) var(--space-3)', fontSize: '0.875rem' },
    md: { padding: 'var(--space-2) var(--space-4)', fontSize: '1rem' },
    lg: { padding: 'var(--space-3) var(--space-6)', fontSize: '1.125rem' },
  };

  const combinedStyle = { ...baseStyle, ...variantStyles[variant], ...sizeStyles[size], ...(props.style || {}) };

  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      style={combinedStyle}
      className={`btn-${variant} ${className}`}
      {...props}
      onMouseOver={(e) => {
        if (!disabled && !isLoading) {
          if (variant === 'primary') {
            e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
            e.currentTarget.style.backgroundColor = 'var(--accent-secondary)';
          } else if (variant === 'ghost') {
            e.currentTarget.style.borderColor = 'var(--border-default)';
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
          } else if (variant === 'secondary') {
             e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
          }
        }
      }}
      onMouseOut={(e) => {
        if (!disabled && !isLoading) {
           if (variant === 'primary') {
             e.currentTarget.style.boxShadow = 'none';
             e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
           } else if (variant === 'ghost') {
             e.currentTarget.style.borderColor = 'transparent';
             e.currentTarget.style.backgroundColor = 'transparent';
           } else if (variant === 'secondary') {
             e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
           }
        }
      }}
    >
      {isLoading && (
        <span style={{ 
          width: '1em', height: '1em', 
          border: '2px solid currentColor', borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      )}
      {!isLoading && icon && <span>{icon}</span>}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
