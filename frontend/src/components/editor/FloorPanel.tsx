import React from 'react';
import { useBuildingStore } from '../../store/buildingStore';
import { useUIStore } from '../../store/uiStore';

export const FloorPanel: React.FC = () => {
  const { building, activeFloorIndex, setActiveFloor, updateBuilding } = useBuildingStore();
  const { addToast } = useUIStore();

  if (!building) return null;

  const handleAddFloor = () => {
    const currentMax = building.floors.reduce((m, f) => Math.max(m, f.index), -1);
    const newIndex = currentMax + 1;
    updateBuilding((b) => ({
      ...b,
      floors: [
        ...b.floors,
        {
          index: newIndex,
          name: `Floor ${newIndex}`,
          height: newIndex * 3,
          rooms: [],
          walls: [],
          doors: [],
          windows: [],
          staircases: [],
        },
      ],
    }));
    addToast({ type: 'success', message: `Floor ${newIndex} added` });
  };

  const handleDeleteFloor = (floorIndex: number) => {
    if (building.floors.length <= 1) return;
    updateBuilding((b) => ({
      ...b,
      floors: b.floors.filter((f) => f.index !== floorIndex),
    }));
    if (activeFloorIndex >= floorIndex && activeFloorIndex > 0) {
      setActiveFloor(activeFloorIndex - 1);
    }
  };

  const panelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '50%',
    borderBottom: '1px solid var(--border-subtle)',
    padding: '16px',
    overflowY: 'auto',
  };

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
          Floors
        </h3>
        <button
          onClick={handleAddFloor}
          style={{
            background: 'var(--accent-primary)',
            border: 'none',
            color: 'white',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 10px',
            cursor: 'pointer',
            fontSize: '12px',
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
          }}
        >
          + Add
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[...building.floors].sort((a, b) => b.index - a.index).map((floor) => {
          const isActive = activeFloorIndex === floor.index;
          return (
            <div
              key={`floor-${floor.index}`}
              onClick={() => setActiveFloor(floor.index)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                backgroundColor: isActive ? 'rgba(99,102,241,0.2)' : 'var(--bg-elevated)',
                border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {floor.name}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {floor.rooms.length} rooms · {floor.walls.length} walls
                </span>
              </div>
              {building.floors.length > 1 && (
                <button
                  title="Delete floor"
                  style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', fontSize: '14px', padding: '2px 4px' }}
                  onClick={(e) => { e.stopPropagation(); handleDeleteFloor(floor.index); }}
                >
                  🗑
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
