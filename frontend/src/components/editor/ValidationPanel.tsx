import React from 'react';
import { useUIStore } from '../../store/uiStore';

export const ValidationPanel: React.FC = () => {
  const { toggleValidationPanel } = useUIStore();

  const mockErrors = [
    { type: 'error', code: 'WALL_01', message: 'Wall segments overlap', fix: 'Snap walls to grid' },
    { type: 'warning', code: 'ROOM_02', message: 'Room has no windows', fix: 'Add a window' },
    { type: 'info', code: 'GEN_01', message: 'Building exceeds recommended area', fix: 'Check zoning laws' }
  ];

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '250px',
      backgroundColor: '#1f2937',
      borderTop: '1px solid #374151',
      boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 10
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #374151' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>Validation Results</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Badge color="#ef4444" label="1 Errors" />
            <Badge color="#f59e0b" label="1 Warnings" />
            <Badge color="#3b82f6" label="1 Info" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={{ background: '#374151', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' }}>Re-run</button>
          <button onClick={() => toggleValidationPanel()} style={{ background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '18px' }}>×</button>
        </div>
      </div>

      <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {mockErrors.map((err, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '8px', backgroundColor: '#111827', borderRadius: '4px', cursor: 'pointer' }}>
            <div style={{ marginTop: '2px' }}>
              {err.type === 'error' && <span style={{ color: '#ef4444' }}>✗</span>}
              {err.type === 'warning' && <span style={{ color: '#f59e0b' }}>⚠</span>}
              {err.type === 'info' && <span style={{ color: '#3b82f6' }}>ℹ</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '12px', backgroundColor: '#374151', padding: '2px 4px', borderRadius: '2px' }}>{err.code}</span>
                <span style={{ fontSize: '14px' }}>{err.message}</span>
              </div>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>Suggested fix: {err.fix}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Badge = ({ color, label }: { color: string, label: string }) => (
  <span style={{ backgroundColor: color + '20', color: color, padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '500' }}>
    {label}
  </span>
);
