import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { SceneCanvas } from './SceneCanvas';
import { DrawingModeCanvas } from './DrawingModeCanvas';
import { AIHouseBuilderModal } from './AIHouseBuilderModal';
import { Toolbar } from './Toolbar';
import { FloorPanel } from './FloorPanel';
import { LayerTree } from './LayerTree';
import { PropertiesPanel } from './PropertiesPanel';
import { ValidationPanel } from './ValidationPanel';
import { useBuildingStore } from '../../store/buildingStore';
import { useUIStore } from '../../store/uiStore';
import { normalizeBuilding } from '../../schema/normalizeBuilding';

// Bundled templates for fallback (if user navigates directly to /editor/:id)
const TEMPLATE_MAP: Record<string, () => Promise<{ default: unknown }>> = {
  house_2bhk:        () => import('../../data/templates/house_2bhk.json'),
  house_3bhk_2floor: () => import('../../data/templates/house_3bhk_2floor.json'),
  apartment_studio:  () => import('../../data/templates/apartment_studio.json'),
  villa_4bhk:        () => import('../../data/templates/villa_4bhk.json'),
  shop_unit:         () => import('../../data/templates/shop_unit.json'),
};

export const EditorShell: React.FC = () => {
  const { projectId } = useParams<{ projectId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { building, setBuilding } = useBuildingStore();
  const { isValidationPanelOpen } = useUIStore();

  const initialMode = searchParams.get('mode');
  const [viewMode, setViewMode] = useState<'3d' | '2d'>(initialMode === 'drawing' ? '2d' : '3d');
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(initialMode === 'ai');

  // Load building if not already set (e.g. user refreshed the page or navigated directly)
  useEffect(() => {
    if (building) return;

    if (projectId && TEMPLATE_MAP[projectId]) {
      TEMPLATE_MAP[projectId]().then(mod => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setBuilding(normalizeBuilding(mod.default as any));
      });
    } else if (!projectId || projectId === 'new') {
      // Scaffold a clean default building
      setBuilding({
        id: 'new-' + Date.now(),
        metadata: {
          name: 'Untitled Building',
          type: 'house',
          units: 'metric',
          createdVia: initialMode === 'ai' ? 'ai' : initialMode === 'drawing' ? 'drawing' : 'template',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        floors: [
          {
            index: 0,
            name: 'Ground Floor',
            height: 0,
            rooms: [],
            walls: [],
            doors: [],
            windows: [],
            staircases: [],
          },
        ],
        entrances: [],
      });
    }
  }, [building, projectId, initialMode, setBuilding]);

  // Loading indicator
  if (!building) {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-base)',
        color: 'var(--text-primary)',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          border: '3px solid var(--border-default)',
          borderTopColor: 'var(--accent-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading 3D Editor…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateRows: '56px 1fr',
      gridTemplateColumns: '240px 1fr 300px',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      backgroundColor: 'var(--bg-base)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Toolbar — full width top row */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Toolbar
          onBack={() => navigate('/')}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onOpenAiBuilder={() => setIsAiModalOpen(true)}
        />
      </div>

      {/* Left sidebar: Floor list + Layer tree */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border-subtle)',
        overflowY: 'auto',
        background: 'var(--bg-elevated)',
      }}>
        <FloorPanel />
        <LayerTree />
      </div>

      {/* Centre: 2D CAD Canvas OR 3D Canvas (+ validation panel overlay) */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {viewMode === '2d' ? (
          <DrawingModeCanvas onSwitchTo3D={() => setViewMode('3d')} />
        ) : (
          <SceneCanvas />
        )}

        {isValidationPanelOpen && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10 }}>
            <ValidationPanel />
          </div>
        )}
      </div>

      {/* Right sidebar: Component Properties Editor */}
      <div style={{
        borderLeft: '1px solid var(--border-subtle)',
        overflowY: 'auto',
        background: 'var(--bg-elevated)',
      }}>
        <PropertiesPanel />
      </div>

      {/* AI House Builder Modal */}
      <AIHouseBuilderModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />
    </div>
  );
};
