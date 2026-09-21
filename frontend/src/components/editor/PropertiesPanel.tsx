import React from 'react';
import { useBuildingStore } from '../../store/buildingStore';
import type { Wall, Room, FurnitureItem, Door, Window, Staircase, RoomType, FurnitureType, DoorSwing } from '../../schema/building.types';
import { ROOM_LABELS, FURNITURE_DIMENSIONS } from '../../schema/building.types';

export const PropertiesPanel: React.FC = () => {
  const { building, selectedObjectId, selectedObjectType, updateBuilding, deleteSelectedObject } = useBuildingStore();

  const panelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--bg-elevated)',
    overflowY: 'auto',
  };

  if (!selectedObjectId || !selectedObjectType || !building) {
    return (
      <div style={{ ...panelStyle, alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.4 }}>🔍</div>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.5 }}>
          Select an object in 2D CAD or 3D view to inspect and edit its properties
        </p>
      </div>
    );
  }

  let wall: Wall | null = null;
  let room: Room | null = null;
  let furniture: FurnitureItem | null = null;
  let door: Door | null = null;
  let windowObj: Window | null = null;
  let staircase: Staircase | null = null;

  for (const floor of building.floors) {
    if (selectedObjectType === 'wall') {
      wall = floor.walls.find(w => w.id === selectedObjectId) ?? null;
      if (wall) break;
    } else if (selectedObjectType === 'room') {
      room = floor.rooms.find(r => r.id === selectedObjectId) ?? null;
      if (room) break;
    } else if (selectedObjectType === 'furniture') {
      for (const r of floor.rooms) {
        furniture = r.furniture.find(f => f.id === selectedObjectId) ?? null;
        if (furniture) break;
      }
      if (furniture) break;
    } else if (selectedObjectType === 'door') {
      door = floor.doors.find(d => d.id === selectedObjectId) ?? null;
      if (door) break;
    } else if (selectedObjectType === 'window') {
      windowObj = floor.windows.find(w => w.id === selectedObjectId) ?? null;
      if (windowObj) break;
    } else if (selectedObjectType === 'staircase') {
      staircase = floor.staircases.find(s => s.id === selectedObjectId) ?? null;
      if (staircase) break;
    }
  }

  if (!wall && !room && !furniture && !door && !windowObj && !staircase) {
    return (
      <div style={{ ...panelStyle, padding: '16px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Object not found</p>
      </div>
    );
  }

  // --- Handlers ---
  const updateRoomField = (fields: Partial<Room>) => {
    updateBuilding(b => ({
      ...b,
      floors: b.floors.map(f => ({
        ...f,
        rooms: f.rooms.map(r => r.id === selectedObjectId ? { ...r, ...fields } : r)
      }))
    }));
  };

  const updateRoomDimensions = (newW: number, newH: number) => {
    if (!room || !room.polygon || room.polygon.length < 4) return;
    const minX = Math.min(...room.polygon.map(p => p[0]));
    const minY = Math.min(...room.polygon.map(p => p[1]));

    const newPoly: [number, number][] = [
      [minX, minY],
      [minX + newW, minY],
      [minX + newW, minY + newH],
      [minX, minY + newH]
    ];

    updateRoomField({
      polygon: newPoly,
      area: newW * newH * 10.7639
    });
  };

  const updateRoomPosition = (newX: number, newY: number) => {
    if (!room || !room.polygon || room.polygon.length < 4) return;
    const minX = Math.min(...room.polygon.map(p => p[0]));
    const maxX = Math.max(...room.polygon.map(p => p[0]));
    const minY = Math.min(...room.polygon.map(p => p[1]));
    const maxY = Math.max(...room.polygon.map(p => p[1]));

    const w = maxX - minX;
    const h = maxY - minY;

    const newPoly: [number, number][] = [
      [newX, newY],
      [newX + w, newY],
      [newX + w, newY + h],
      [newX, newY + h]
    ];

    updateRoomField({ polygon: newPoly });
  };

  const updateWallField = (fields: Partial<Wall>) => {
    updateBuilding(b => ({
      ...b,
      floors: b.floors.map(f => ({
        ...f,
        walls: f.walls.map(w => w.id === selectedObjectId ? { ...w, ...fields } : w)
      }))
    }));
  };

  const updateFurnitureField = (fields: Partial<FurnitureItem>) => {
    updateBuilding(b => ({
      ...b,
      floors: b.floors.map(f => ({
        ...f,
        rooms: f.rooms.map(r => ({
          ...r,
          furniture: r.furniture.map(item => item.id === selectedObjectId ? { ...item, ...fields } : item)
        }))
      }))
    }));
  };

  const updateDoorField = (fields: Partial<Door>) => {
    updateBuilding(b => ({
      ...b,
      floors: b.floors.map(f => ({
        ...f,
        doors: f.doors.map(d => d.id === selectedObjectId ? { ...d, ...fields } : d)
      }))
    }));
  };

  const updateWindowField = (fields: Partial<Window>) => {
    updateBuilding(b => ({
      ...b,
      floors: b.floors.map(f => ({
        ...f,
        windows: f.windows.map(w => w.id === selectedObjectId ? { ...w, ...fields } : w)
      }))
    }));
  };

  const updateStaircaseField = (fields: Partial<Staircase>) => {
    updateBuilding(b => ({
      ...b,
      floors: b.floors.map(f => ({
        ...f,
        staircases: f.staircases.map(s => s.id === selectedObjectId ? { ...s, ...fields } : s)
      }))
    }));
  };

  // Helper variables for Room dimensions
  const roomMinX = room ? Math.min(...room.polygon.map(p => p[0])) : 0;
  const roomMaxX = room ? Math.max(...room.polygon.map(p => p[0])) : 0;
  const roomMinY = room ? Math.min(...room.polygon.map(p => p[1])) : 0;
  const roomMaxY = room ? Math.max(...room.polygon.map(p => p[1])) : 0;
  const roomWidth = roomMaxX - roomMinX;
  const roomDepth = roomMaxY - roomMinY;

  return (
    <div style={panelStyle}>
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
            Edit {selectedObjectType}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {selectedObjectId}
          </p>
        </div>
        <button
          onClick={deleteSelectedObject}
          title="Delete component"
          style={{
            background: 'rgba(239,68,68,0.15)',
            color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.3)',
            padding: '5px 10px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600
          }}
        >
          🗑 Delete
        </button>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* ── Room Properties ────────────────────────────────────────── */}
        {room && (
          <>
            <Field label="Name">
              <input
                type="text"
                style={inputStyle}
                value={room.name}
                onChange={e => updateRoomField({ name: e.target.value })}
              />
            </Field>
            <Field label="Room Type">
              <select
                style={inputStyle}
                value={room.type}
                onChange={e => updateRoomField({ type: e.target.value as RoomType, name: ROOM_LABELS[e.target.value as RoomType] || room!.name })}
              >
                {Object.entries(ROOM_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="Width (m)">
              <input
                type="number"
                step="0.5"
                min="1.0"
                style={inputStyle}
                value={roomWidth}
                onChange={e => updateRoomDimensions(parseFloat(e.target.value) || 1.0, roomDepth)}
              />
            </Field>
            <Field label="Depth (m)">
              <input
                type="number"
                step="0.5"
                min="1.0"
                style={inputStyle}
                value={roomDepth}
                onChange={e => updateRoomDimensions(roomWidth, parseFloat(e.target.value) || 1.0)}
              />
            </Field>
            <Field label="Position X (m)">
              <input
                type="number"
                step="0.5"
                style={inputStyle}
                value={roomMinX}
                onChange={e => updateRoomPosition(parseFloat(e.target.value) || 0, roomMinY)}
              />
            </Field>
            <Field label="Position Y (m)">
              <input
                type="number"
                step="0.5"
                style={inputStyle}
                value={roomMinY}
                onChange={e => updateRoomPosition(roomMinX, parseFloat(e.target.value) || 0)}
              />
            </Field>
            <Field label="Area (sq ft)">
              <input type="text" style={{ ...inputStyle, color: 'var(--accent-secondary)', fontWeight: 600 }} value={room.area?.toFixed(1) ?? (roomWidth * roomDepth * 10.76).toFixed(1)} readOnly />
            </Field>
          </>
        )}

        {/* ── Wall Properties ────────────────────────────────────────── */}
        {wall && (
          <>
            <Field label="Thickness (m)">
              <input
                type="number"
                step="0.05"
                min="0.1"
                max="1.0"
                style={inputStyle}
                value={wall.thickness}
                onChange={e => updateWallField({ thickness: parseFloat(e.target.value) || 0.2 })}
              />
            </Field>
            <Field label="Height (m)">
              <input
                type="number"
                step="0.1"
                min="1.0"
                max="10.0"
                style={inputStyle}
                value={wall.height}
                onChange={e => updateWallField({ height: parseFloat(e.target.value) || 3.0 })}
              />
            </Field>
            <Field label="Structure Role">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={wall.isExterior}
                  onChange={e => updateWallField({ isExterior: e.target.checked })}
                />
                Exterior / Load-Bearing Wall
              </label>
            </Field>
          </>
        )}

        {/* ── Furniture Properties ───────────────────────────────────── */}
        {furniture && (
          <>
            <Field label="Furniture Type">
              <select
                style={inputStyle}
                value={furniture.type}
                onChange={e => {
                  const newType = e.target.value as FurnitureType;
                  updateFurnitureField({ type: newType });
                }}
              >
                {Object.keys(FURNITURE_DIMENSIONS).map(typeKey => (
                  <option key={typeKey} value={typeKey}>
                    {typeKey.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Position X (m)">
              <input
                type="number"
                step="0.2"
                style={inputStyle}
                value={furniture.position[0]}
                onChange={e => updateFurnitureField({
                  position: [parseFloat(e.target.value) || 0, furniture!.position[1], furniture!.position[2]]
                })}
              />
            </Field>
            <Field label="Position Y (m)">
              <input
                type="number"
                step="0.2"
                style={inputStyle}
                value={furniture.position[1]}
                onChange={e => updateFurnitureField({
                  position: [furniture!.position[0], parseFloat(e.target.value) || 0, furniture!.position[2]]
                })}
              />
            </Field>
            <Field label="Position Z (m)">
              <input
                type="number"
                step="0.2"
                style={inputStyle}
                value={furniture.position[2]}
                onChange={e => updateFurnitureField({
                  position: [furniture!.position[0], furniture!.position[1], parseFloat(e.target.value) || 0]
                })}
              />
            </Field>
            <Field label="Rotation Y (deg)">
              <input
                type="number"
                step="15"
                style={inputStyle}
                value={furniture.rotation[1]}
                onChange={e => updateFurnitureField({
                  rotation: [furniture!.rotation[0], parseFloat(e.target.value) || 0, furniture!.rotation[2]]
                })}
              />
            </Field>
          </>
        )}

        {/* ── Door Properties ────────────────────────────────────────── */}
        {door && (
          <>
            <Field label="Width (m)">
              <input
                type="number"
                step="0.05"
                min="0.6"
                max="3.0"
                style={inputStyle}
                value={door.width}
                onChange={e => updateDoorField({ width: parseFloat(e.target.value) || 0.9 })}
              />
            </Field>
            <Field label="Height (m)">
              <input
                type="number"
                step="0.05"
                min="1.8"
                max="3.5"
                style={inputStyle}
                value={door.height}
                onChange={e => updateDoorField({ height: parseFloat(e.target.value) || 2.1 })}
              />
            </Field>
            <Field label="Door Swing">
              <select
                style={inputStyle}
                value={door.swing}
                onChange={e => updateDoorField({ swing: e.target.value as DoorSwing })}
              >
                <option value="in-left">Inward Left</option>
                <option value="in-right">Inward Right</option>
                <option value="out-left">Outward Left</option>
                <option value="out-right">Outward Right</option>
                <option value="sliding">Sliding</option>
                <option value="double">Double Door</option>
              </select>
            </Field>
          </>
        )}

        {/* ── Window Properties ──────────────────────────────────────── */}
        {windowObj && (
          <>
            <Field label="Width (m)">
              <input
                type="number"
                step="0.1"
                min="0.4"
                max="4.0"
                style={inputStyle}
                value={windowObj.width}
                onChange={e => updateWindowField({ width: parseFloat(e.target.value) || 1.2 })}
              />
            </Field>
            <Field label="Height (m)">
              <input
                type="number"
                step="0.1"
                min="0.4"
                max="3.0"
                style={inputStyle}
                value={windowObj.height}
                onChange={e => updateWindowField({ height: parseFloat(e.target.value) || 1.2 })}
              />
            </Field>
            <Field label="Sill Height (m)">
              <input
                type="number"
                step="0.05"
                min="0.0"
                max="2.5"
                style={inputStyle}
                value={windowObj.sillHeight}
                onChange={e => updateWindowField({ sillHeight: parseFloat(e.target.value) || 0.9 })}
              />
            </Field>
          </>
        )}

        {/* ── Staircase Properties ───────────────────────────────────── */}
        {staircase && (
          <>
            <Field label="Width (m)">
              <input
                type="number"
                step="0.1"
                min="0.8"
                max="3.0"
                style={inputStyle}
                value={staircase.width}
                onChange={e => updateStaircaseField({ width: parseFloat(e.target.value) || 1.2 })}
              />
            </Field>
            <Field label="Length (m)">
              <input
                type="number"
                step="0.1"
                min="1.5"
                max="6.0"
                style={inputStyle}
                value={staircase.length}
                onChange={e => updateStaircaseField({ length: parseFloat(e.target.value) || 2.6 })}
              />
            </Field>
            <Field label="Stair Style">
              <select
                style={inputStyle}
                value={staircase.type}
                onChange={e => updateStaircaseField({ type: e.target.value as Staircase['type'] })}
              >
                <option value="straight">Straight Run</option>
                <option value="l-shaped">L-Shaped</option>
                <option value="u-shaped">U-Shaped</option>
                <option value="spiral">Spiral</option>
              </select>
            </Field>
          </>
        )}

      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
    <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {label}
    </label>
    {children}
  </div>
);

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  color: 'var(--text-primary)',
  padding: '7px 10px',
  borderRadius: 'var(--radius-sm)',
  outline: 'none',
  fontSize: '13px',
  width: '100%',
  fontFamily: 'var(--font-sans)',
};
