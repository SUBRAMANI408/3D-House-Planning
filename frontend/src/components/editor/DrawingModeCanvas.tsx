import React, { useState, useRef } from 'react';
import { useBuildingStore } from '../../store/buildingStore';
import { useUIStore } from '../../store/uiStore';
import type { RoomType, FurnitureType, Wall, Room, Door, Window, FurnitureItem, Vector2 } from '../../schema/building.types';
import { ROOM_COLORS, FURNITURE_DIMENSIONS } from '../../schema/building.types';

type Tool = 'select' | 'wall' | 'room' | 'door' | 'window' | 'furniture';

interface RoomPreset {
  type: RoomType;
  label: string;
  w: number; // in meters
  h: number; // in meters
  emoji: string;
}

const ROOM_PRESETS: RoomPreset[] = [
  { type: 'living', label: 'Living Room', w: 6, h: 5, emoji: '🛋️' },
  { type: 'bedroom', label: 'Master Bedroom', w: 5, h: 4, emoji: '🛏️' },
  { type: 'bedroom', label: 'Bedroom', w: 4, h: 4, emoji: '🛏️' },
  { type: 'kitchen', label: 'Kitchen', w: 4, h: 3.5, emoji: '🍳' },
  { type: 'dining', label: 'Dining Room', w: 4, h: 4, emoji: '🍽️' },
  { type: 'bathroom', label: 'Bathroom', w: 3, h: 2.5, emoji: '🚿' },
  { type: 'garage', label: 'Garage', w: 6, h: 4, emoji: '🚗' },
  { type: 'balcony', label: 'Balcony', w: 4, h: 2, emoji: '🪴' },
  { type: 'office', label: 'Study / Office', w: 4, h: 3, emoji: '💻' },
  { type: 'storeroom', label: 'Storeroom', w: 2.5, h: 2, emoji: '📦' },
];

export const DrawingModeCanvas: React.FC<{ onSwitchTo3D: () => void }> = ({ onSwitchTo3D }) => {
  const { building, activeFloorIndex, selectedObjectId, selectObject, updateBuilding } = useBuildingStore();
  const { addToast } = useUIStore();

  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [selectedRoomPreset, setSelectedRoomPreset] = useState<RoomPreset>(ROOM_PRESETS[0]);
  const [selectedFurnitureType, setSelectedFurnitureType] = useState<FurnitureType>('sofa');

  // Interactive drawing, dragging & resizing state
  const [drawingStart, setDrawingStart] = useState<Vector2 | null>(null);
  const [hoverPos, setHoverPos] = useState<Vector2 | null>(null);
  
  // Dragging state for moving room
  const [draggingRoomId, setDraggingRoomId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Vector2>([0, 0]);

  // Resizing state for room handles: corner index 0=TL, 1=TR, 2=BR, 3=BL
  const [resizingRoomId, setResizingRoomId] = useState<string | null>(null);
  const [resizingCornerIndex, setResizingCornerIndex] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  if (!building) return null;

  const currentFloor = building.floors.find(f => f.index === activeFloorIndex) || building.floors[0];

  const GRID_SIZE = 24; // 24px per meter
  const CENTER_OFFSET = 300;

  const snapToGrid = (val: number): number => Math.round(val / 0.5) * 0.5;

  const getCanvasCoords = (e: React.MouseEvent<SVGSVGElement>): Vector2 => {
    if (!containerRef.current) return [0, 0];
    const rect = containerRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left - CENTER_OFFSET;
    const rawY = e.clientY - rect.top - CENTER_OFFSET;
    return [snapToGrid(rawX / GRID_SIZE), snapToGrid(rawY / GRID_SIZE)];
  };

  const createRoomWithWalls = (preset: RoomPreset, posX: number, posY: number) => {
    const rId = `room-${Date.now().toString(36)}`;
    const w = preset.w;
    const h = preset.h;
    const poly: Vector2[] = [
      [posX, posY],
      [posX + w, posY],
      [posX + w, posY + h],
      [posX, posY + h]
    ];

    const wall1: Wall = { id: `wall-${rId}-1`, startPoint: [posX, posY], endPoint: [posX + w, posY], thickness: 0.2, height: 3.0, isExterior: true };
    const wall2: Wall = { id: `wall-${rId}-2`, startPoint: [posX + w, posY], endPoint: [posX + w, posY + h], thickness: 0.2, height: 3.0, isExterior: true };
    const wall3: Wall = { id: `wall-${rId}-3`, startPoint: [posX + w, posY + h], endPoint: [posX, posY + h], thickness: 0.2, height: 3.0, isExterior: true };
    const wall4: Wall = { id: `wall-${rId}-4`, startPoint: [posX, posY + h], endPoint: [posX, posY], thickness: 0.2, height: 3.0, isExterior: true };

    const newRoom: Room = {
      id: rId,
      name: preset.label,
      type: preset.type,
      wallIds: [wall1.id, wall2.id, wall3.id, wall4.id],
      polygon: poly,
      area: w * h * 10.7639,
      furniture: [],
      connections: []
    };

    updateBuilding(b => ({
      ...b,
      floors: b.floors.map(f => f.index === activeFloorIndex ? {
        ...f,
        rooms: [...f.rooms, newRoom],
        walls: [...f.walls, wall1, wall2, wall3, wall4]
      } : f)
    }));

    selectObject(rId, 'room');
    addToast({ type: 'success', message: `${preset.label} placed with perimeter walls!` });
  };

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingRoomId || resizingRoomId) return;

    const [mx, my] = getCanvasCoords(e);

    if (activeTool === 'room') {
      createRoomWithWalls(selectedRoomPreset, mx, my);
    } else if (activeTool === 'wall') {
      if (!drawingStart) {
        setDrawingStart([mx, my]);
        addToast({ type: 'info', message: 'Click end point to complete wall' });
      } else {
        if (drawingStart[0] === mx && drawingStart[1] === my) {
          setDrawingStart(null);
          return;
        }
        const newWall: Wall = {
          id: `wall-${Date.now().toString(36)}`,
          startPoint: drawingStart,
          endPoint: [mx, my],
          thickness: 0.2,
          height: 3.0,
          isExterior: false
        };
        updateBuilding(b => ({
          ...b,
          floors: b.floors.map(f => f.index === activeFloorIndex ? { ...f, walls: [...f.walls, newWall] } : f)
        }));
        setDrawingStart([mx, my]);
        addToast({ type: 'success', message: 'Wall created' });
      }
    } else if (activeTool === 'furniture') {
      const newFurn: FurnitureItem = {
        id: `furn-${Date.now().toString(36)}`,
        type: selectedFurnitureType,
        position: [mx, 0, my],
        rotation: [0, 0, 0]
      };
      const targetRoom = currentFloor.rooms[0];
      if (!targetRoom) {
        addToast({ type: 'warning', message: 'Place a room first to contain furniture' });
        return;
      }
      updateBuilding(b => ({
        ...b,
        floors: b.floors.map(f => f.index === activeFloorIndex ? {
          ...f,
          rooms: f.rooms.map(r => r.id === targetRoom.id ? { ...r, furniture: [...r.furniture, newFurn] } : r)
        } : f)
      }));
      addToast({ type: 'success', message: `${selectedFurnitureType.replace(/_/g, ' ')} placed` });
    } else if (activeTool === 'door') {
      const wall = currentFloor.walls[0];
      if (!wall) return;
      const newDoor: Door = { id: `door-${Date.now().toString(36)}`, wallId: wall.id, position: [mx, my], width: 0.9, height: 2.1, swing: 'in-left' };
      updateBuilding(b => ({ ...b, floors: b.floors.map(f => f.index === activeFloorIndex ? { ...f, doors: [...f.doors, newDoor] } : f) }));
      addToast({ type: 'success', message: 'Door added' });
    } else if (activeTool === 'window') {
      const wall = currentFloor.walls[0];
      if (!wall) return;
      const newWin: Window = { id: `win-${Date.now().toString(36)}`, wallId: wall.id, position: [mx, my], width: 1.2, height: 1.2, sillHeight: 0.9 };
      updateBuilding(b => ({ ...b, floors: b.floors.map(f => f.index === activeFloorIndex ? { ...f, windows: [...f.windows, newWin] } : f) }));
      addToast({ type: 'success', message: 'Window added' });
    }
  };

  const handleRoomMouseDown = (r: Room, e: React.MouseEvent) => {
    e.stopPropagation();
    selectObject(r.id, 'room');

    const [mx, my] = getCanvasCoords(e as any);
    const minX = Math.min(...r.polygon.map(p => p[0]));
    const minY = Math.min(...r.polygon.map(p => p[1]));

    setDraggingRoomId(r.id);
    setDragOffset([mx - minX, my - minY]);
  };

  const handleHandleMouseDown = (r: Room, cornerIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    selectObject(r.id, 'room');
    setResizingRoomId(r.id);
    setResizingCornerIndex(cornerIdx);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const coords = getCanvasCoords(e);
    setHoverPos(coords);

    // ── Handle Room Moving ────────────────────────────────────────────────
    if (draggingRoomId) {
      const [mx, my] = coords;
      const newMinX = mx - dragOffset[0];
      const newMinY = my - dragOffset[1];

      updateBuilding(b => ({
        ...b,
        floors: b.floors.map(f => f.index === activeFloorIndex ? {
          ...f,
          rooms: f.rooms.map(r => {
            if (r.id !== draggingRoomId) return r;
            const curMinX = Math.min(...r.polygon.map(p => p[0]));
            const curMinY = Math.min(...r.polygon.map(p => p[1]));
            const dx = newMinX - curMinX;
            const dy = newMinY - curMinY;

            const newPoly: Vector2[] = r.polygon.map(p => [p[0] + dx, p[1] + dy] as Vector2);
            const w = Math.abs(newPoly[1][0] - newPoly[0][0]);
            const h = Math.abs(newPoly[2][1] - newPoly[1][1]);

            return {
              ...r,
              polygon: newPoly,
              area: w * h * 10.7639
            };
          })
        } : f)
      }));
    }

    // ── Handle Room Resizing ──────────────────────────────────────────────
    if (resizingRoomId && resizingCornerIndex !== null) {
      const [mx, my] = coords;

      updateBuilding(b => ({
        ...b,
        floors: b.floors.map(f => f.index === activeFloorIndex ? {
          ...f,
          rooms: f.rooms.map(r => {
            if (r.id !== resizingRoomId) return r;
            const poly = [...r.polygon];
            const minX = Math.min(...poly.map(p => p[0]));
            const maxX = Math.max(...poly.map(p => p[0]));
            const minY = Math.min(...poly.map(p => p[1]));
            const maxY = Math.max(...poly.map(p => p[1]));

            let newMinX = minX;
            let newMaxX = maxX;
            let newMinY = minY;
            let newMaxY = maxY;

            if (resizingCornerIndex === 0) { // TL
              newMinX = Math.min(mx, maxX - 1.0);
              newMinY = Math.min(my, maxY - 1.0);
            } else if (resizingCornerIndex === 1) { // TR
              newMaxX = Math.max(mx, minX + 1.0);
              newMinY = Math.min(my, maxY - 1.0);
            } else if (resizingCornerIndex === 2) { // BR
              newMaxX = Math.max(mx, minX + 1.0);
              newMaxY = Math.max(my, minY + 1.0);
            } else if (resizingCornerIndex === 3) { // BL
              newMinX = Math.min(mx, maxX - 1.0);
              newMaxY = Math.max(my, minY + 1.0);
            }

            const newPoly: Vector2[] = [
              [newMinX, newMinY],
              [newMaxX, newMinY],
              [newMaxX, newMaxY],
              [newMinX, newMaxY]
            ];
            const w = newMaxX - newMinX;
            const h = newMaxY - newMinY;

            return {
              ...r,
              polygon: newPoly,
              area: w * h * 10.7639
            };
          })
        } : f)
      }));
    }
  };

  const handleMouseUp = () => {
    if (draggingRoomId) {
      setDraggingRoomId(null);
      addToast({ type: 'info', message: 'Room repositioned' });
    }
    if (resizingRoomId) {
      setResizingRoomId(null);
      setResizingCornerIndex(null);
      addToast({ type: 'info', message: 'Room dimensions updated' });
    }
  };

  const toSvgX = (mX: number) => CENTER_OFFSET + mX * GRID_SIZE;
  const toSvgY = (mY: number) => CENTER_OFFSET + mY * GRID_SIZE;

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', backgroundColor: '#0f172a', position: 'relative' }}>

      {/* ── Left Sidebar: Room Presets Palette ────────────────────── */}
      <div style={{
        width: '220px',
        backgroundColor: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        gap: '16px',
        overflowY: 'auto'
      }}>
        <h3 style={{ margin: 0, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
          Room Preset Palette
        </h3>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          Click or drag a room preset to place it on the 2D CAD canvas:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {ROOM_PRESETS.map((preset, i) => {
            const isSelected = activeTool === 'room' && selectedRoomPreset.label === preset.label;
            return (
              <div
                key={i}
                onClick={() => {
                  setSelectedRoomPreset(preset);
                  setActiveTool('room');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isSelected ? 'rgba(99,102,241,0.2)' : 'var(--bg-card)',
                  border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <span style={{ fontSize: '20px' }}>{preset.emoji}</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{preset.label}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{preset.w}m × {preset.h}m ({preset.w * preset.h}m²)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main CAD Surface Container ────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

        {/* Top Tool Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          backgroundColor: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border-subtle)',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button style={toolBtnStyle(activeTool === 'select')} onClick={() => { setActiveTool('select'); setDrawingStart(null); }}>
              🖐 Select / Drag / Resize
            </button>
            <button style={toolBtnStyle(activeTool === 'wall')} onClick={() => setActiveTool('wall')}>
              🧱 Draw Wall
            </button>
            <button style={toolBtnStyle(activeTool === 'door')} onClick={() => setActiveTool('door')}>
              🚪 Add Door
            </button>
            <button style={toolBtnStyle(activeTool === 'window')} onClick={() => setActiveTool('window')}>
              🪟 Add Window
            </button>
            <button style={toolBtnStyle(activeTool === 'furniture')} onClick={() => setActiveTool('furniture')}>
              🪑 Furniture
            </button>
          </div>

          {activeTool === 'furniture' && (
            <select
              value={selectedFurnitureType}
              onChange={e => setSelectedFurnitureType(e.target.value as FurnitureType)}
              style={subSelectStyle}
            >
              {Object.keys(FURNITURE_DIMENSIONS).map(k => (
                <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>
              ))}
            </select>
          )}

          <button
            onClick={onSwitchTo3D}
            style={{
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px', cursor: 'pointer'
            }}
          >
            🌐 Convert & View 3D House →
          </button>
        </div>

        {/* SVG Interactive CAD Surface */}
        <div ref={containerRef} style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
          <svg
            width="100%"
            height="100%"
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{ background: '#090d16', cursor: draggingRoomId ? 'grabbing' : activeTool === 'wall' ? 'crosshair' : 'default' }}
          >
            <defs>
              <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="#1e293b" strokeWidth="1" />
              </pattern>
              <pattern id="grid-major" width={GRID_SIZE * 5} height={GRID_SIZE * 5} patternUnits="userSpaceOnUse">
                <rect width={GRID_SIZE * 5} height={GRID_SIZE * 5} fill="url(#grid)" />
                <path d={`M ${GRID_SIZE * 5} 0 L 0 0 0 ${GRID_SIZE * 5}`} fill="none" stroke="#334155" strokeWidth="1.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-major)" />

            {/* Render Rooms */}
            {currentFloor.rooms.map(room => {
              const isSel = selectedObjectId === room.id;
              const pointsStr = room.polygon.map(p => `${toSvgX(p[0])},${toSvgY(p[1])}`).join(' ');
              const minX = Math.min(...room.polygon.map(p => p[0]));
              const maxX = Math.max(...room.polygon.map(p => p[0]));
              const minY = Math.min(...room.polygon.map(p => p[1]));
              const maxY = Math.max(...room.polygon.map(p => p[1]));

              const wM = Math.abs(maxX - minX);
              const hM = Math.abs(maxY - minY);

              return (
                <g key={room.id}>
                  {/* Room Polygon Body */}
                  <polygon
                    points={pointsStr}
                    fill={ROOM_COLORS[room.type] || 'rgba(99,102,241,0.2)'}
                    fillOpacity="0.55"
                    stroke={isSel ? '#6366f1' : '#475569'}
                    strokeWidth={isSel ? 3 : 1.5}
                    onMouseDown={e => handleRoomMouseDown(room, e)}
                    style={{ cursor: 'grab' }}
                  />

                  {/* Room Labels & Dimensions */}
                  <text
                    x={toSvgX(minX) + 10}
                    y={toSvgY(minY) + 22}
                    fill="#f8fafc"
                    fontSize="13"
                    fontWeight="700"
                    fontFamily="sans-serif"
                    pointerEvents="none"
                  >
                    {room.name}
                  </text>
                  <text
                    x={toSvgX(minX) + 10}
                    y={toSvgY(minY) + 38}
                    fill="#94a3b8"
                    fontSize="11"
                    fontFamily="monospace"
                    pointerEvents="none"
                  >
                    {wM.toFixed(1)}m × {hM.toFixed(1)}m ({room.area ? room.area.toFixed(0) : (wM * hM * 10.76).toFixed(0)} sq ft)
                  </text>

                  {/* Interactive Corner Resize Handles (Shown when room is selected) */}
                  {isSel && room.polygon.map((p, cornerIdx) => (
                    <circle
                      key={`handle-${cornerIdx}`}
                      cx={toSvgX(p[0])}
                      cy={toSvgY(p[1])}
                      r="7"
                      fill="#6366f1"
                      stroke="#ffffff"
                      strokeWidth="2"
                      style={{ cursor: cornerIdx % 2 === 0 ? 'nwse-resize' : 'nesw-resize' }}
                      onMouseDown={e => handleHandleMouseDown(room, cornerIdx, e)}
                    />
                  ))}
                </g>
              );
            })}

            {/* Render Walls */}
            {currentFloor.walls.map(wall => {
              const isSel = selectedObjectId === wall.id;
              return (
                <line
                  key={wall.id}
                  x1={toSvgX(wall.startPoint[0])}
                  y1={toSvgY(wall.startPoint[1])}
                  x2={toSvgX(wall.endPoint[0])}
                  y2={toSvgY(wall.endPoint[1])}
                  stroke={isSel ? '#38bdf8' : wall.isExterior ? '#cbd5e1' : '#94a3b8'}
                  strokeWidth={Math.max(4, wall.thickness * 20)}
                  strokeLinecap="round"
                  onClick={e => { e.stopPropagation(); selectObject(wall.id, 'wall'); }}
                />
              );
            })}

            {/* Render Doors */}
            {currentFloor.doors.map(d => {
              const pos = Array.isArray(d.position) ? d.position : [0, 0];
              return (
                <circle key={d.id} cx={toSvgX(pos[0])} cy={toSvgY(pos[1])} r="7" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" onClick={e => { e.stopPropagation(); selectObject(d.id, 'door'); }} />
              );
            })}

            {/* Render Windows */}
            {currentFloor.windows.map(w => {
              const pos = Array.isArray(w.position) ? w.position : [0, 0];
              return (
                <rect key={w.id} x={toSvgX(pos[0]) - 6} y={toSvgY(pos[1]) - 6} width="12" height="12" fill="#38bdf8" stroke="#fff" strokeWidth="1.5" onClick={e => { e.stopPropagation(); selectObject(w.id, 'window'); }} />
              );
            })}

            {/* Render Staircases */}
            {currentFloor.staircases.map(s => {
              const cx = toSvgX(s.position[0]);
              const cy = toSvgY(s.position[1]);
              const wPx = s.width * GRID_SIZE;
              const lPx = s.length * GRID_SIZE;
              return (
                <g key={s.id} onClick={e => { e.stopPropagation(); selectObject(s.id, 'staircase'); }}>
                  <rect x={cx} y={cy} width={wPx} height={lPx} fill="rgba(100,116,139,0.4)" stroke="#64748b" strokeWidth="1.5" />
                  <text x={cx + 6} y={cy + 18} fill="#cbd5e1" fontSize="11" fontWeight="600"> Stairs (↑ Level {s.endFloorIndex})</text>
                </g>
              );
            })}

            {/* Render Furniture */}
            {currentFloor.rooms.flatMap(r => r.furniture).map(f => {
              const cx = toSvgX(f.position[0]);
              const cy = toSvgY(f.position[2] ?? f.position[1]);
              const isSel = selectedObjectId === f.id;
              return (
                <rect key={f.id} x={cx - 10} y={cy - 10} width="20" height="20" rx="4" fill="#8b5cf6" stroke={isSel ? '#fff' : '#a78bfa'} strokeWidth={isSel ? 2 : 1} onClick={e => { e.stopPropagation(); selectObject(f.id, 'furniture'); }} />
              );
            })}

            {/* Active Drawing Line Preview */}
            {drawingStart && hoverPos && (
              <line x1={toSvgX(drawingStart[0])} y1={toSvgY(drawingStart[1])} x2={toSvgX(hoverPos[0])} y2={toSvgY(hoverPos[1])} stroke="#6366f1" strokeWidth="3" strokeDasharray="6 4" />
            )}

            {/* Mouse Coordinates Overlay */}
            {hoverPos && (
              <text x="20" y="30" fill="#94a3b8" fontSize="12" fontFamily="monospace">
                X: {hoverPos[0].toFixed(1)}m | Y: {hoverPos[1].toFixed(1)}m
              </text>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
};

const toolBtnStyle = (isActive: boolean): React.CSSProperties => ({
  background: isActive ? 'var(--accent-primary)' : 'var(--bg-card)',
  color: isActive ? '#fff' : 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  padding: '6px 12px',
  borderRadius: 'var(--radius-sm)',
  fontSize: '12px',
  cursor: 'pointer',
  fontWeight: 500
});

const subSelectStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  padding: '5px 10px',
  borderRadius: 'var(--radius-sm)',
  fontSize: '12px',
  outline: 'none'
};
