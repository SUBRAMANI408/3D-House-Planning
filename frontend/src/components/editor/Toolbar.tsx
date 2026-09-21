import React, { useEffect } from 'react';
import { useBuildingStore } from '../../store/buildingStore';
import { useUIStore } from '../../store/uiStore';

export const Toolbar: React.FC<{
  onBack?: () => void;
  viewMode: '3d' | '2d';
  onViewModeChange: (mode: '3d' | '2d') => void;
  onOpenAiBuilder: () => void;
}> = ({ onBack, viewMode, onViewModeChange, onOpenAiBuilder }) => {
  const { building, undo, redo, isDirty, isSaving, undoStack, redoStack, markClean } = useBuildingStore();
  const { cameraMode, setCameraMode, showStats, showGrid, toggleStats, toggleGrid, toggleValidationPanel, addToast } = useUIStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const handleSave = () => {
    markClean();
    addToast({ type: 'success', message: 'Project changes saved successfully!' });
  };

  const handleValidate = () => {
    toggleValidationPanel();
  };

  const barStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    height: '56px',
    backgroundColor: 'var(--bg-elevated)',
    borderBottom: '1px solid var(--border-subtle)',
    gap: '8px',
  };

  return (
    <div style={barStyle}>
      {/* ── Left: Back + building name + mode badge ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1', minWidth: 0 }}>
        <button
          onClick={onBack}
          title="Back to Home"
          style={{ ...btn, padding: '6px 10px', flexShrink: 0 }}
        >
          ← Back
        </button>

        <input
          type="text"
          value={building?.metadata?.name ?? 'Untitled Building'}
          readOnly
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: '15px',
            fontWeight: 600,
            fontFamily: 'var(--font-display)',
            outline: 'none',
            minWidth: 0,
            flex: 1,
          }}
        />

        <span style={{
          fontSize: '11px',
          color: isSaving ? 'var(--color-info)' : isDirty ? 'var(--color-warning)' : 'var(--color-success)',
          flexShrink: 0,
        }}>
          {isSaving ? '⏳ Saving…' : isDirty ? '● Unsaved' : '✓ Saved'}
        </span>
      </div>

      {/* ── Centre: View Mode Switcher + Camera Tools ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        {/* 2D / 3D Mode Toggle */}
        <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
          <button
            style={{ ...modeToggleBtn, backgroundColor: viewMode === '2d' ? 'var(--accent-primary)' : 'transparent', color: viewMode === '2d' ? '#fff' : 'var(--text-secondary)' }}
            onClick={() => onViewModeChange('2d')}
          >
            ✏️ 2D CAD
          </button>
          <button
            style={{ ...modeToggleBtn, backgroundColor: viewMode === '3d' ? 'var(--accent-primary)' : 'transparent', color: viewMode === '3d' ? '#fff' : 'var(--text-secondary)' }}
            onClick={() => onViewModeChange('3d')}
          >
            🌐 3D Model
          </button>
        </div>

        <div style={divider} />

        <button style={{ ...btn, opacity: undoStack.length === 0 ? 0.35 : 1 }} title="Undo (Ctrl+Z)" onClick={undo}>↺</button>
        <button style={{ ...btn, opacity: redoStack.length === 0 ? 0.35 : 1 }} title="Redo (Ctrl+Y)" onClick={redo}>↻</button>

        {viewMode === '3d' && (
          <>
            <div style={divider} />
            <button style={{ ...btn, backgroundColor: cameraMode === 'orbit'       ? activeColor : 'transparent' }} onClick={() => setCameraMode('orbit')}       title="Orbit camera">🌐 Orbit</button>
            <button style={{ ...btn, backgroundColor: cameraMode === 'walkthrough' ? activeColor : 'transparent' }} onClick={() => setCameraMode('walkthrough')} title="Walkthrough">🚶 Walk</button>
            <button style={{ ...btn, backgroundColor: cameraMode === 'topdown'     ? activeColor : 'transparent' }} onClick={() => setCameraMode('topdown')}     title="Top-down view">🗺 Top</button>
          </>
        )}

        <div style={divider} />
        <button style={{ ...btn, backgroundColor: showGrid  ? activeColor : 'transparent' }} onClick={toggleGrid}  title="Toggle grid">⊞ Grid</button>
        <button style={{ ...btn, backgroundColor: showStats ? activeColor : 'transparent' }} onClick={toggleStats} title="Toggle FPS stats">📊</button>
      </div>

      {/* ── Right: Actions ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <button style={{ ...btn, borderColor: 'rgba(139,92,246,0.4)', color: 'var(--accent-secondary)' }} onClick={onOpenAiBuilder} title="Open AI House Builder">
          🤖 AI Builder
        </button>
        <button style={{ ...btn }} onClick={handleValidate} title="Run structural validation">🧪 Validate</button>
        <button
          style={{ ...btn, backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none', fontWeight: 600 }}
          onClick={handleSave}
        >
          💾 Save
        </button>
      </div>
    </div>
  );
};

const btn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  padding: '5px 11px',
  cursor: 'pointer',
  fontSize: '13px',
  fontFamily: 'var(--font-sans)',
  whiteSpace: 'nowrap',
  transition: 'background 0.15s',
};

const modeToggleBtn: React.CSSProperties = {
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  padding: '4px 10px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s',
};

const activeColor = 'rgba(99,102,241,0.25)';

const divider: React.CSSProperties = {
  width: '1px',
  height: '22px',
  backgroundColor: 'var(--border-subtle)',
  margin: '0 4px',
};
