import React from 'react';
import { useUIStore } from '../../store/uiStore';

export const LayerTree: React.FC = () => {
  const { layerVisibility, toggleLayer } = useUIStore();

  const layers: Array<{ id: keyof typeof layerVisibility; label: string }> = [
    { id: 'walls', label: 'Walls' },
    { id: 'furniture', label: 'Furniture' },
    { id: 'roof', label: 'Roof' },
    { id: 'windows', label: 'Windows & Doors' },
    { id: 'doors', label: 'Doors' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '50%', padding: '16px', overflowY: 'auto' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', color: '#9ca3af' }}>Layers</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {layers.map(layer => (
          <div key={layer.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: '#1f2937', borderRadius: '4px' }}>
            <span style={{ fontSize: '14px' }}>{layer.label}</span>
            <button 
              onClick={() => toggleLayer(layer.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
            >
              {(layerVisibility as any)[layer.id] !== false ? '👁' : '🕶'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
