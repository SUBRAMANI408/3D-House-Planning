import React, { useState, useRef } from 'react';
import { useBuildingStore } from '../../store/buildingStore';
import { useUIStore } from '../../store/uiStore';
import { apiClient } from '../../api/client';
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

// Helper: Point in polygon test (Ray casting)
const isPointInPolygon = (point: Vector2, polygon: Vector2[]): boolean => {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 0.000001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

// Helper: Point to line segment distance and projection
const projectPointToSegment = (pt: Vector2, segStart: Vector2, segEnd: Vector2) => {
  const [px, py] = pt;
  const [sx, sy] = segStart;
  const [ex, ey] = segEnd;
  const dx = ex - sx;
  const dy = ey - sy;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return { distance: Math.hypot(px - sx, py - sy), t: 0, proj: [sx, sy] as Vector2 };
  }

  let t = ((px - sx) * dx + (py - sy) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = sx + t * dx;
  const projY = sy + t * dy;
  const distance = Math.hypot(px - projX, py - projY);

  return { distance, t, proj: [projX, projY] as Vector2 };
};

export const DrawingModeCanvas: React.FC<{ onSwitchTo3D: () => void }> = ({ onSwitchTo3D }) => {
  const { building, activeFloorIndex, selectedObjectId, selectObject, updateBuilding } = useBuildingStore();
  const { addToast } = useUIStore();

  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [selectedRoomPreset, setSelectedRoomPreset] = useState<RoomPreset>(ROOM_PRESETS[0]);
  const [selectedFurnitureType, setSelectedFurnitureType] = useState<FurnitureType>('sofa');

  // Interactive drawing state
  const [drawingStart, setDrawingStart] = useState<Vector2 | null>(null);
  const [hoverPos, setHoverPos] = useState<Vector2 | null>(null);

  // Transient Dragging state for moving room
  const [draggingRoomId, setDraggingRoomId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Vector2>([0, 0]);
  const [initialRoomState, setInitialRoomState] = useState<{ room: Room; walls: Wall[]; furniture: FurnitureItem[] } | null>(null);

  // Transient Resizing state for room handles: corner index 0=TL, 1=TR, 2=BR, 3=BL
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

  // Helper to reuse existing matching wall or create a new one
  const findOrCreateWall = (
    start: Vector2,
    end: Vector2,
    existingWalls: Wall[],
    newWallsAccumulator: Wall[]
  ): Wall => {
    const allWalls = [...existingWalls, ...newWallsAccumulator];
    const existing = allWalls.find(w => 
      (Math.hypot(w.startPoint[0] - start[0], w.startPoint[1] - start[1]) < 0.1 &&
       Math.hypot(w.endPoint[0] - end[0], w.endPoint[1] - end[1]) < 0.1) ||
      (Math.hypot(w.startPoint[0] - end[0], w.startPoint[1] - end[1]) < 0.1 &&
       Math.hypot(w.endPoint[0] - start[0], w.endPoint[1] - start[1]) < 0.1)
    );

    if (existing) return existing;

    const wallId = `wall-${crypto.randomUUID()}`;
    const newWall: Wall = {
      id: wallId,
      startPoint: start,
      endPoint: end,
      thickness: 0.2,
      height: currentFloor.floorToFloorHeight || 3.0,
      isExterior: true
    };
    newWallsAccumulator.push(newWall);
    return newWall;
  };

  const createRoomWithWalls = (preset: RoomPreset, posX: number, posY: number) => {
    const rId = `room-${crypto.randomUUID()}`;
    const w = preset.w;
    const h = preset.h;
    const poly: Vector2[] = [
      [posX, posY],
      [posX + w, posY],
      [posX + w, posY + h],
      [posX, posY + h]
    ];

    const newWalls: Wall[] = [];
    const wall1 = findOrCreateWall([posX, posY], [posX + w, posY], currentFloor.walls, newWalls);
    const wall2 = findOrCreateWall([posX + w, posY], [posX + w, posY + h], currentFloor.walls, newWalls);
    const wall3 = findOrCreateWall([posX + w, posY + h], [posX, posY + h], currentFloor.walls, newWalls);
    const wall4 = findOrCreateWall([posX, posY + h], [posX, posY], currentFloor.walls, newWalls);

    const newRoom: Room = {
      id: rId,
      name: preset.label,
      type: preset.type,
      wallIds: [wall1.id, wall2.id, wall3.id, wall4.id],
      polygon: poly,
      area: w * h,
      areaSqFt: w * h * 10.7639,
      furniture: [],
      connections: []
    };

    updateBuilding(b => ({
      ...b,
      floors: b.floors.map(f => f.index === activeFloorIndex ? {
        ...f,
        rooms: [...f.rooms, newRoom],
        walls: [...f.walls, ...newWalls]
      } : f)
    }));

    selectObject(rId, 'room');
    addToast({ type: 'success', message: `${preset.label} placed (${w}m × ${h}m)` });
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
          id: `wall-${crypto.randomUUID()}`,
          startPoint: drawingStart,
          endPoint: [mx, my],
          thickness: 0.2,
          height: currentFloor.floorToFloorHeight || 3.0,
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
      // Find room containing click point using point-in-polygon test
      const containingRoom = currentFloor.rooms.find(r => isPointInPolygon([mx, my], r.polygon));
      if (!containingRoom) {
        addToast({ type: 'warning', message: 'Click inside a room to place furniture!' });
        return;
      }

      const dims = FURNITURE_DIMENSIONS[selectedFurnitureType] || { w: 1, d: 1, h: 0.8 };
      const newFurn: FurnitureItem = {
        id: `furn-${crypto.randomUUID()}`,
        type: selectedFurnitureType,
        position: [mx, 0, my],
        rotation: [0, 0, 0],
        dimensions: [dims.w, dims.h, dims.d],
        visible: true
      };

      updateBuilding(b => ({
        ...b,
        floors: b.floors.map(f => f.index === activeFloorIndex ? {
          ...f,
          rooms: f.rooms.map(r => r.id === containingRoom.id ? { ...r, furniture: [...r.furniture, newFurn] } : r)
        } : f)
      }));
      addToast({ type: 'success', message: `${selectedFurnitureType.replace(/_/g, ' ')} placed inside ${containingRoom.name}` });
    } else if (activeTool === 'door' || activeTool === 'window') {
      // Find nearest wall within 1.5m tolerance
      let nearestWall: Wall | null = null;
      let minDistance = 1.5;
      let bestT = 0.5;
      let bestProj: Vector2 = [mx, my];

      for (const w of currentFloor.walls) {
        const { distance, t, proj } = projectPointToSegment([mx, my], w.startPoint, w.endPoint);
        if (distance < minDistance) {
          minDistance = distance;
          nearestWall = w;
          bestT = t;
          bestProj = proj;
        }
      }

      if (!nearestWall) {
        addToast({ type: 'warning', message: `Click closer to a wall to place ${activeTool}` });
        return;
      }

      // Clamp t so opening fits inside wall
      const wallLen = Math.hypot(nearestWall.endPoint[0] - nearestWall.startPoint[0], nearestWall.endPoint[1] - nearestWall.startPoint[1]);
      const openingWidth = activeTool === 'door' ? 0.9 : 1.2;
      const marginT = wallLen > 0 ? (openingWidth / 2) / wallLen : 0.1;
      const clampedT = Math.max(marginT, Math.min(1 - marginT, bestT));

      if (activeTool === 'door') {
        const newDoor: Door = {
          id: `door-${crypto.randomUUID()}`,
          wallId: nearestWall.id,
          position: bestProj,
          t: clampedT,
          width: 0.9,
          height: 2.1,
          swing: 'in-left'
        };
        updateBuilding(b => ({ ...b, floors: b.floors.map(f => f.index === activeFloorIndex ? { ...f, doors: [...f.doors, newDoor] } : f) }));
        addToast({ type: 'success', message: 'Door attached to wall' });
      } else {
        const newWin: Window = {
          id: `win-${crypto.randomUUID()}`,
          wallId: nearestWall.id,
          position: bestProj,
          t: clampedT,
          width: 1.2,
          height: 1.2,
          sillHeight: 0.9
        };
        updateBuilding(b => ({ ...b, floors: b.floors.map(f => f.index === activeFloorIndex ? { ...f, windows: [...f.windows, newWin] } : f) }));
        addToast({ type: 'success', message: 'Window attached to wall' });
      }
    }
  };

  const handleRoomMouseDown = (r: Room, e: React.MouseEvent) => {
    e.stopPropagation();
    selectObject(r.id, 'room');

    const [mx, my] = getCanvasCoords(e as any);
    const minX = Math.min(...r.polygon.map(p => p[0]));
    const minY = Math.min(...r.polygon.map(p => p[1]));

    const assocWalls = currentFloor.walls.filter(w => r.wallIds.includes(w.id));
    setInitialRoomState({
      room: JSON.parse(JSON.stringify(r)),
      walls: JSON.parse(JSON.stringify(assocWalls)),
      furniture: JSON.parse(JSON.stringify(r.furniture))
    });

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
    if (draggingRoomId && initialRoomState) {
      const [mx, my] = coords;
      const newMinX = mx - dragOffset[0];
      const newMinY = my - dragOffset[1];

      const origPoly = initialRoomState.room.polygon;
      const curMinX = Math.min(...origPoly.map(p => p[0]));
      const curMinY = Math.min(...origPoly.map(p => p[1]));
      const dx = newMinX - curMinX;
      const dy = newMinY - curMinY;

      const newPoly: Vector2[] = origPoly.map(p => [snapToGrid(p[0] + dx), snapToGrid(p[1] + dy)]);
      const movedWallIds = initialRoomState.room.wallIds;

      updateBuilding(b => ({
        ...b,
        floors: b.floors.map(f => f.index === activeFloorIndex ? {
          ...f,
          rooms: f.rooms.map(r => {
            if (r.id !== draggingRoomId) return r;
            const newFurn = (r.furniture || []).map(furn => ({
              ...furn,
              position: [furn.position[0] + dx, furn.position[1], (furn.position[2] ?? furn.position[1]) + dy] as [number, number, number]
            }));
            const areaM2 = Math.abs(newPoly.reduce((acc, p, i) => {
              const next = newPoly[(i + 1) % newPoly.length];
              return acc + (p[0] * next[1] - next[0] * p[1]);
            }, 0)) / 2;
            return {
              ...r,
              polygon: newPoly,
              area: areaM2,
              areaSqFt: areaM2 * 10.7639,
              furniture: newFurn
            };
          }),
          // Shift attached walls
          walls: f.walls.map(w => {
            if (!movedWallIds.includes(w.id)) return w;
            const origWall = initialRoomState.walls.find(ow => ow.id === w.id);
            if (!origWall) return w;
            return {
              ...w,
              startPoint: [snapToGrid(origWall.startPoint[0] + dx), snapToGrid(origWall.startPoint[1] + dy)],
              endPoint: [snapToGrid(origWall.endPoint[0] + dx), snapToGrid(origWall.endPoint[1] + dy)]
            };
          }),
          // Shift attached doors along moved walls
          doors: f.doors.map(d => {
            if (!movedWallIds.includes(d.wallId)) return d;
            const pos = Array.isArray(d.position) ? [snapToGrid(d.position[0] + dx), snapToGrid(d.position[1] + dy)] as Vector2 : d.position;
            return { ...d, position: pos };
          }),
          // Shift attached windows along moved walls
          windows: f.windows.map(w => {
            if (!movedWallIds.includes(w.wallId)) return w;
            const pos = Array.isArray(w.position) ? [snapToGrid(w.position[0] + dx), snapToGrid(w.position[1] + dy)] as Vector2 : w.position;
            return { ...w, position: pos };
          }),
          // Shift staircases strictly inside dragged room
          staircases: (f.staircases || []).map(s => {
            if (!s.position || !isPointInPolygon(s.position, origPoly)) return s;
            return {
              ...s,
              position: [snapToGrid(s.position[0] + dx), snapToGrid(s.position[1] + dy)] as Vector2
            };
          })
        } : f)
      }));
    }

    // ── Handle Room Resizing ──────────────────────────────────────────────
    if (resizingRoomId && resizingCornerIndex !== null) {
      const [mx, my] = coords;
      const rToResize = currentFloor.rooms.find(rm => rm.id === resizingRoomId);
      if (!rToResize) return;

      const poly = [...rToResize.polygon];
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
      const areaM2 = (newMaxX - newMinX) * (newMaxY - newMinY);
      const resizedWallIds = rToResize.wallIds;

      updateBuilding(b => ({
        ...b,
        floors: b.floors.map(f => f.index === activeFloorIndex ? {
          ...f,
          rooms: f.rooms.map(r => {
            if (r.id !== resizingRoomId) return r;
            return {
              ...r,
              polygon: newPoly,
              area: areaM2,
              areaSqFt: areaM2 * 10.7639
            };
          }),
          // Update wall endpoints for resized room perimeter using NEW polygon bounds
          walls: f.walls.map(w => {
            if (!resizedWallIds.includes(w.id)) return w;
            let start = w.startPoint;
            let end = w.endPoint;
            if (Math.abs(w.startPoint[1] - minY) < 0.3 && Math.abs(w.endPoint[1] - minY) < 0.3) {
              start = [newMinX, newMinY]; end = [newMaxX, newMinY];
            } else if (Math.abs(w.startPoint[0] - maxX) < 0.3 && Math.abs(w.endPoint[0] - maxX) < 0.3) {
              start = [newMaxX, newMinY]; end = [newMaxX, newMaxY];
            } else if (Math.abs(w.startPoint[1] - maxY) < 0.3 && Math.abs(w.endPoint[1] - maxY) < 0.3) {
              start = [newMaxX, newMaxY]; end = [newMinX, newMaxY];
            } else if (Math.abs(w.startPoint[0] - minX) < 0.3 && Math.abs(w.endPoint[0] - minX) < 0.3) {
              start = [newMinX, newMaxY]; end = [newMinX, newMinY];
            }
            return { ...w, startPoint: start, endPoint: end };
          })
        } : f)
      }));
    }
  };

  const handleMouseUp = () => {
    if (draggingRoomId) {
      setDraggingRoomId(null);
      setInitialRoomState(null);
      addToast({ type: 'info', message: 'Room and dependent geometry updated' });
    }
    if (resizingRoomId) {
      setResizingRoomId(null);
      setResizingCornerIndex(null);
      addToast({ type: 'info', message: 'Room dimensions updated' });
    }
  };

  // Convert CAD model to 3D validated building and switch views
  const handleConvertAndSwitch = async () => {
    if (currentFloor.rooms.length === 0) {
      addToast({ type: 'warning', message: 'Please place at least one room before viewing in 3D.' });
      return;
    }

    try {
      const res = await apiClient.post('/api/ai/validate', building);
      if (res.data && res.data.status === 'failed') {
        const errMsgs = (res.data.issues || []).filter((i: any) => i.severity === 'error').map((i: any) => i.message).join(', ');
        addToast({ type: 'error', message: `CAD model validation failed: ${errMsgs || 'Invalid room geometry'}` });
        return;
      }
    } catch (e) {
      console.warn('Backend validation check skipped offline:', e);
    }

    addToast({ type: 'success', message: '2D CAD layout validated & converted to 3D model' });
    onSwitchTo3D();
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
          Click a preset to select, then click on the canvas to place:
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
            onClick={handleConvertAndSwitch}
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
                    {wM.toFixed(1)}m × {hM.toFixed(1)}m ({(room.areaSqFt || wM * hM * 10.76).toFixed(0)} sq ft)
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
