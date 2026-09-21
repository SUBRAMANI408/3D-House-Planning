import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuildingStore } from '../../store/buildingStore';
import { useUIStore } from '../../store/uiStore';
import type { Building } from '../../schema/building.types';

export interface TemplateModalEntry {
  id: string;
  name: string;
  description: string;
  type: 'house' | 'apartment' | 'shop';
  floors: number;
  tags: string[];
  data: Building;
}

export const TemplatePreviewModal: React.FC<{
  template: TemplateModalEntry | null;
  onClose: () => void;
}> = ({ template, onClose }) => {
  const navigate = useNavigate();
  const { setBuilding } = useBuildingStore();
  const { addToast } = useUIStore();

  if (!template) return null;

  const handleEditIn3DEditor = () => {
    setBuilding(template.data);
    onClose();
    addToast({ type: 'success', message: `Loaded ${template.name} into 3D Editor!` });
    navigate(`/editor/${template.id}`);
  };

  const getEmoji = (type: string) => type === 'house' ? '🏠' : type === 'apartment' ? '🏢' : '🏪';

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        maxWidth: '700px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header Hero */}
        <div style={{
          height: '180px',
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '64px'
        }}>
          {getEmoji(template.type)}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px', right: '16px',
              background: 'rgba(0,0,0,0.5)',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              width: '36px', height: '36px',
              cursor: 'pointer',
              fontSize: '18px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <span style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                {template.type.toUpperCase()}
              </span>
              <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: '4px', fontSize: '12px' }}>
                {template.floors} Floor{template.floors > 1 ? 's' : ''}
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
              {template.name}
            </h2>
            <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
              {template.description}
            </p>
          </div>

          {/* Room Breakdown Stats */}
          <div style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Structure Breakdown
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
              {template.data.floors.map(floor => (
                <div key={floor.index} style={{ background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{floor.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {floor.rooms.length} Rooms · {floor.walls.length} Walls
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {template.tags.map(tag => (
              <span key={tag} style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: '4px 10px', borderRadius: '4px' }}>
                #{tag}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                background: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleEditIn3DEditor}
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '14px'
              }}
            >
              🛠 Edit Template in 3D Editor →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
