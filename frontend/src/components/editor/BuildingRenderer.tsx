import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useBuildingStore } from '../../store/buildingStore';
import { useUIStore } from '../../store/uiStore';
import type { Wall, Room, FurnitureItem, Door, Window, Staircase, Roof } from '../../schema/building.types';
import { ROOM_COLORS, FURNITURE_DIMENSIONS } from '../../schema/building.types';

export const BuildingRenderer: React.FC = () => {
  const { building, selectedObjectId, selectObject } = useBuildingStore();
  const { layerVisibility } = useUIStore();

  if (!building) return null;

  const maxFloorIndex = building.floors.reduce((max, f) => Math.max(max, f.index), 0);

  return (
    <group name="building-root">
      {building.floors.map((floor) => {
        const floorIdx = floor.index ?? 0;
        const opacity = 1.0;
        const depthWrite = true;
        const yOffset = floor.height ?? (floorIdx * 3.0);

        // Derive full wall list: combine explicit floor.walls with room polygon perimeter walls
        const effectiveWalls = useMemo(() => {
          const derived: Wall[] = [];
          const wallSet = new Set<string>();

          // Add explicit walls from floor JSON
          if (floor.walls && floor.walls.length > 0) {
            floor.walls.forEach(w => {
              const key = `${w.startPoint[0].toFixed(1)},${w.startPoint[1].toFixed(1)}-${w.endPoint[0].toFixed(1)},${w.endPoint[1].toFixed(1)}`;
              if (!wallSet.has(key)) {
                wallSet.add(key);
                derived.push(w);
              }
            });
          }

          // Auto-derive missing perimeter and partition walls from room polygons
          floor.rooms.forEach((room, rIdx) => {
            if (!room.polygon || room.polygon.length < 3) return;
            const pts = room.polygon;
            for (let i = 0; i < pts.length; i++) {
              const p1 = pts[i];
              const p2 = pts[(i + 1) % pts.length];
              const key1 = `${p1[0].toFixed(1)},${p1[1].toFixed(1)}-${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
              const key2 = `${p2[0].toFixed(1)},${p2[1].toFixed(1)}-${p1[0].toFixed(1)},${p1[1].toFixed(1)}`;

              if (!wallSet.has(key1) && !wallSet.has(key2)) {
                wallSet.add(key1);
                derived.push({
                  id: `wall-auto-${floorIdx}-${rIdx}-${i}`,
                  startPoint: [p1[0], p1[1]],
                  endPoint: [p2[0], p2[1]],
                  thickness: 0.2,
                  height: 3.0,
                  isExterior: i === 0 || i === pts.length - 1
                });
              }
            }
          });

          return derived;
        }, [floor.walls, floor.rooms, floorIdx]);

        const isTopFloor = floorIdx === maxFloorIndex;

        return (
          <group key={`floor-${floorIdx}`} name={`floor-${floorIdx}`} position={[0, yOffset, 0]}>
            {/* ── Structural Base Slab & Ceiling Separators ─────────────────────── */}
            <FloorSlabMesh rooms={floor.rooms} opacity={opacity} />

            {/* ── Room Floor Surfaces & Materials ──────────────────────────── */}
            {floor.rooms.map((room) => (
              <RoomMesh
                key={`room-${room.id}`}
                room={room}
                opacity={opacity}
                depthWrite={depthWrite}
                isSelected={selectedObjectId === room.id}
                onClick={(e) => { e.stopPropagation(); selectObject(room.id, 'room'); }}
              />
            ))}

            {/* ── Solid Architectural Wall Meshes ──────────────────────────── */}
            {layerVisibility.walls && effectiveWalls.map((wall) => (
              <WallMesh
                key={`wall-${wall.id}`}
                wall={wall}
                opacity={opacity}
                depthWrite={depthWrite}
                isSelected={selectedObjectId === wall.id}
                onClick={(e) => { e.stopPropagation(); selectObject(wall.id, 'wall'); }}
              />
            ))}

            {/* ── Doors with Frame & Panel Detailing ───────────────────────── */}
            {layerVisibility.doors && floor.doors.map((door) => (
              <DoorMesh
                key={`door-${door.id}`}
                door={door}
                walls={effectiveWalls}
                opacity={opacity}
                isSelected={selectedObjectId === door.id}
                onClick={(e) => { e.stopPropagation(); selectObject(door.id, 'door'); }}
              />
            ))}

            {/* ── Windows with Glass & Aluminum Mullions ──────────────────── */}
            {layerVisibility.windows && floor.windows.map((win) => (
              <WindowMesh
                key={`win-${win.id}`}
                windowObj={win}
                walls={effectiveWalls}
                opacity={opacity}
                isSelected={selectedObjectId === win.id}
                onClick={(e) => { e.stopPropagation(); selectObject(win.id, 'window'); }}
              />
            ))}

            {/* ── Multi-Floor Staircases with Steps & Balustrade Handrails ───── */}
            {floor.staircases.map((stair) => (
              <StaircaseMesh
                key={`stair-${stair.id}`}
                stair={stair}
                isSelected={selectedObjectId === stair.id}
                onClick={(e) => { e.stopPropagation(); selectObject(stair.id, 'staircase'); }}
              />
            ))}

            {/* ── Realistic Procedural Furniture & Architectural Objects ─────── */}
            {layerVisibility.furniture && floor.rooms.flatMap((room) =>
              room.furniture.map((furn) => (
                <FurnitureProcedural
                  key={`furn-${furn.id}`}
                  furniture={furn}
                  isSelected={selectedObjectId === furn.id}
                  onClick={(e) => { e.stopPropagation(); selectObject(furn.id, 'furniture'); }}
                />
              ))
            )}

            {/* ── Top Floor Roof Structure (Gable / Hip / Flat with Parapet) ─── */}
            {layerVisibility.roof && isTopFloor && (
              <RoofMesh
                roof={floor.roof}
                rooms={floor.rooms}
                walls={effectiveWalls}
                wallHeight={3.0}
              />
            )}
          </group>
        );
      })}
    </group>
  );
};

// ── FloorSlabMesh ─────────────────────────────────────────────────────────────

const FloorSlabMesh: React.FC<{ rooms: Room[]; opacity: number }> = ({ rooms, opacity }) => {
  const slabData = useMemo(() => {
    if (rooms.length === 0) return null;
    const allPts = rooms.flatMap(r => r.polygon || []);
    if (allPts.length < 3) return null;

    const minX = Math.min(...allPts.map(p => p[0]));
    const maxX = Math.max(...allPts.map(p => p[0]));
    const minZ = Math.min(...allPts.map(p => p[1]));
    const maxZ = Math.max(...allPts.map(p => p[1]));

    const w = maxX - minX + 0.4;
    const d = maxZ - minZ + 0.4;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;

    return { w, d, cx, cz };
  }, [rooms]);

  if (!slabData) return null;

  return (
    <group position={[slabData.cx, -0.1, slabData.cz]}>
      <mesh receiveShadow castShadow position={[0, 0, 0]}>
        <boxGeometry args={[slabData.w, 0.2, slabData.d]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} transparent opacity={opacity} />
      </mesh>
    </group>
  );
};

// ── WallMesh ──────────────────────────────────────────────────────────────────

const WallMesh: React.FC<{
  wall: Wall;
  opacity: number;
  depthWrite: boolean;
  isSelected: boolean;
  onClick: (e: { stopPropagation: () => void }) => void;
}> = ({ wall, opacity, depthWrite, isSelected, onClick }) => {
  const sp = wall.startPoint;
  const ep = wall.endPoint;
  if (!sp || !ep || sp.length < 2 || ep.length < 2) return null;

  const thickness = wall.thickness ?? 0.2;
  const height    = wall.height    ?? 3.0;

  const dx = ep[0] - sp[0];
  const dz = ep[1] - sp[1];
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length < 0.01) return null;

  const angle = Math.atan2(dz, dx);
  const midX  = (sp[0] + ep[0]) / 2;
  const midZ  = (sp[1] + ep[1]) / 2;

  const wallColor = isSelected ? '#6366f1' : wall.isExterior ? '#334155' : '#475569';

  return (
    <group position={[midX, height / 2, midZ]} rotation={[0, -angle, 0]} onClick={onClick}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[length, height, thickness]} />
        <meshStandardMaterial
          color={wallColor}
          roughness={0.75}
          metalness={0.1}
          transparent={opacity < 1}
          opacity={opacity}
          depthWrite={depthWrite}
          emissive={isSelected ? new THREE.Color('#4f46e5') : new THREE.Color('#000000')}
          emissiveIntensity={isSelected ? 0.4 : 0}
        />
      </mesh>
      <mesh position={[0, -height / 2 + 0.05, 0]}>
        <boxGeometry args={[length, 0.1, thickness + 0.02]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} />
      </mesh>
    </group>
  );
};

// ── DoorMesh ──────────────────────────────────────────────────────────────────

const DoorMesh: React.FC<{
  door: Door;
  walls: Wall[];
  opacity: number;
  isSelected: boolean;
  onClick: (e: { stopPropagation: () => void }) => void;
}> = ({ door, walls, opacity, isSelected, onClick }) => {
  const wall = walls.find(w => w.id === door.wallId) || walls[0];
  if (!wall) return null;

  const sp = wall.startPoint;
  const ep = wall.endPoint;
  const dx = ep[0] - sp[0];
  const dz = ep[1] - sp[1];
  const angle = Math.atan2(dz, dx);

  const pos = Array.isArray(door.position) ? door.position : [sp[0] + 0.5 * dx, sp[1] + 0.5 * dz];
  const px = pos[0];
  const pz = pos[1];

  return (
    <group position={[px, door.height / 2, pz]} rotation={[0, -angle, 0]} onClick={onClick}>
      <mesh castShadow>
        <boxGeometry args={[door.width + 0.1, door.height + 0.08, 0.24]} />
        <meshStandardMaterial color={isSelected ? '#6366f1' : '#1e293b'} roughness={0.4} transparent opacity={opacity} />
      </mesh>
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[door.width - 0.04, door.height - 0.04, 0.06]} />
        <meshStandardMaterial color="#9a3412" roughness={0.5} transparent opacity={opacity} />
      </mesh>
      <mesh position={[door.width / 2 - 0.12, 0, 0.05]} castShadow>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
};

// ── WindowMesh ────────────────────────────────────────────────────────────────

const WindowMesh: React.FC<{
  windowObj: Window;
  walls: Wall[];
  opacity: number;
  isSelected: boolean;
  onClick: (e: { stopPropagation: () => void }) => void;
}> = ({ windowObj, walls, opacity, isSelected, onClick }) => {
  const wall = walls.find(w => w.id === windowObj.wallId) || walls[0];
  if (!wall) return null;

  const sp = wall.startPoint;
  const ep = wall.endPoint;
  const dx = ep[0] - sp[0];
  const dz = ep[1] - sp[1];
  const angle = Math.atan2(dz, dx);

  const pos = Array.isArray(windowObj.position) ? windowObj.position : [sp[0] + 0.5 * dx, sp[1] + 0.5 * dz];
  const px = pos[0];
  const pz = pos[1];
  const py = windowObj.sillHeight + windowObj.height / 2;

  return (
    <group position={[px, py, pz]} rotation={[0, -angle, 0]} onClick={onClick}>
      <mesh castShadow>
        <boxGeometry args={[windowObj.width + 0.08, windowObj.height + 0.08, 0.22]} />
        <meshStandardMaterial color={isSelected ? '#6366f1' : '#0f172a'} roughness={0.3} metalness={0.5} transparent opacity={opacity} />
      </mesh>
      <mesh>
        <boxGeometry args={[windowObj.width - 0.04, windowObj.height - 0.04, 0.03]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.45} roughness={0.1} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.03, windowObj.height - 0.04, 0.04]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} />
      </mesh>
    </group>
  );
};

// ── StaircaseMesh ─────────────────────────────────────────────────────────────

const StaircaseMesh: React.FC<{
  stair: Staircase;
  isSelected: boolean;
  onClick: (e: { stopPropagation: () => void }) => void;
}> = ({ stair, isSelected, onClick }) => {
  const px = stair.position[0];
  const pz = stair.position[1];
  const steps = 14;
  const totalH = 3.0;
  const stepH = totalH / steps;
  const stepL = stair.length / steps;
  const stepW = stair.width;

  return (
    <group position={[px, 0, pz]} onClick={onClick}>
      {Array.from({ length: steps }).map((_, i) => (
        <mesh key={i} position={[stepW / 2, i * stepH + stepH / 2, i * stepL + stepL / 2]} castShadow receiveShadow>
          <boxGeometry args={[stepW, stepH, stepL]} />
          <meshStandardMaterial
            color={isSelected ? '#6366f1' : '#475569'}
            roughness={0.6}
            metalness={0.2}
          />
        </mesh>
      ))}
      <mesh position={[0.05, totalH / 2 + 0.4, stair.length / 2]} rotation={[Math.atan2(totalH, stair.length), 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, Math.sqrt(totalH * totalH + stair.length * stair.length), 8]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
};

// ── RoofMesh ──────────────────────────────────────────────────────────────────

const RoofMesh: React.FC<{
  roof?: Roof;
  rooms: Room[];
  walls: Wall[];
  wallHeight: number;
}> = ({ roof, rooms, wallHeight }) => {
  const roofData = useMemo(() => {
    const allPts = rooms.flatMap(r => r.polygon || []);
    if (allPts.length < 3) return null;

    const minX = Math.min(...allPts.map(p => p[0]));
    const maxX = Math.max(...allPts.map(p => p[0]));
    const minZ = Math.min(...allPts.map(p => p[1]));
    const maxZ = Math.max(...allPts.map(p => p[1]));

    const overhang = roof?.overhang ?? 0.6;
    const w = maxX - minX + overhang * 2;
    const d = maxZ - minZ + overhang * 2;
    const h = roof?.height ?? 2.2;
    const type = roof?.type ?? 'pitched_gable';
    const color = roof?.color ?? '#b91c1c';

    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;

    return { w, d, h, cx, cz, type, color };
  }, [rooms, roof]);

  if (!roofData) return null;

  return (
    <group position={[roofData.cx, wallHeight, roofData.cz]}>
      {roofData.type === 'flat' ? (
        <group>
          <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
            <boxGeometry args={[roofData.w, 0.2, roofData.d]} />
            <meshStandardMaterial color="#334155" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[roofData.w, 0.5, roofData.d]} />
            <meshStandardMaterial color="#475569" roughness={0.7} />
          </mesh>
        </group>
      ) : (
        <group>
          <mesh position={[0, roofData.h / 2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
            <coneGeometry args={[Math.max(roofData.w, roofData.d) * 0.65, roofData.h, 4]} />
            <meshStandardMaterial color={roofData.color} roughness={0.5} metalness={0.15} />
          </mesh>
          <mesh position={[0, 0.05, 0]} castShadow>
            <boxGeometry args={[roofData.w, 0.1, roofData.d]} />
            <meshStandardMaterial color="#1e293b" roughness={0.6} />
          </mesh>
        </group>
      )}
    </group>
  );
};

// ── RoomMesh ──────────────────────────────────────────────────────────────────

const RoomMesh: React.FC<{
  room: Room;
  opacity: number;
  depthWrite: boolean;
  isSelected: boolean;
  onClick: (e: { stopPropagation: () => void }) => void;
}> = ({ room, opacity, depthWrite, isSelected, onClick }) => {
  const geometry = useMemo(() => {
    if (!room.polygon || room.polygon.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(room.polygon[0][0], room.polygon[0][1]);
    for (let i = 1; i < room.polygon.length; i++) {
      shape.lineTo(room.polygon[i][0], room.polygon[i][1]);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
  }, [room.polygon]);

  if (!geometry) return null;

  const colorHex = ROOM_COLORS[room.type] ?? '#4a5568';

  return (
    <mesh
      name={room.id}
      geometry={geometry}
      position={[0, -0.04, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={onClick}
      receiveShadow
    >
      <meshStandardMaterial
        color={isSelected ? '#818cf8' : colorHex}
        roughness={0.9}
        transparent
        opacity={opacity * (isSelected ? 0.95 : 0.85)}
        depthWrite={depthWrite}
      />
    </mesh>
  );
};

// ── FurnitureProcedural ───────────────────────────────────────────────────────

const FurnitureProcedural: React.FC<{
  furniture: FurnitureItem;
  isSelected: boolean;
  onClick: (e: { stopPropagation: () => void }) => void;
}> = ({ furniture, isSelected, onClick }) => {
  const dims = FURNITURE_DIMENSIONS[furniture.type] ?? { w: 1.0, d: 1.0, h: 1.0 };
  const pos = furniture.position ?? [0, 0, 0];
  const rot = furniture.rotation ?? [0, 0, 0];
  const px = pos[0] ?? 0;
  const pz = pos[2] ?? pos[1] ?? 0;
  const ry = (rot[1] ?? 0) * (Math.PI / 180);

  const isBed = furniture.type.startsWith('bed');
  const isSofa = furniture.type.startsWith('sofa');
  const isKitchen = furniture.type.includes('kitchen');
  const isBath = furniture.type === 'toilet' || furniture.type === 'bathtub' || furniture.type === 'shower' || furniture.type === 'sink';

  return (
    <group position={[px, 0, pz]} rotation={[0, ry, 0]} onClick={onClick}>

      {/* ── BED ───────────────────────────────────────────────────────────── */}
      {isBed && (
        <group position={[0, dims.h / 2, 0]}>
          <mesh castShadow position={[0, -dims.h * 0.3, 0]}>
            <boxGeometry args={[dims.w, dims.h * 0.4, dims.d]} />
            <meshStandardMaterial color="#451a03" roughness={0.6} />
          </mesh>
          <mesh castShadow position={[0, dims.h * 0.2, -dims.d / 2 + 0.05]}>
            <boxGeometry args={[dims.w, dims.h * 0.8, 0.1]} />
            <meshStandardMaterial color={isSelected ? '#6366f1' : '#312e81'} roughness={0.4} />
          </mesh>
          <mesh castShadow position={[0, 0.05, 0.05]}>
            <boxGeometry args={[dims.w - 0.08, dims.h * 0.35, dims.d - 0.15]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.8} />
          </mesh>
          <mesh castShadow position={[-dims.w * 0.25, dims.h * 0.25, -dims.d * 0.3]}>
            <boxGeometry args={[dims.w * 0.4, 0.1, 0.35]} />
            <meshStandardMaterial color="#e0e7ff" />
          </mesh>
          <mesh castShadow position={[dims.w * 0.25, dims.h * 0.25, -dims.d * 0.3]}>
            <boxGeometry args={[dims.w * 0.4, 0.1, 0.35]} />
            <meshStandardMaterial color="#e0e7ff" />
          </mesh>
        </group>
      )}

      {/* ── SOFA ──────────────────────────────────────────────────────────── */}
      {isSofa && (
        <group position={[0, dims.h / 2, 0]}>
          <mesh castShadow position={[0, -0.1, 0]}>
            <boxGeometry args={[dims.w, dims.h * 0.5, dims.d]} />
            <meshStandardMaterial color={isSelected ? '#6366f1' : '#4c1d95'} roughness={0.7} />
          </mesh>
          <mesh castShadow position={[0, dims.h * 0.2, -dims.d / 2 + 0.1]}>
            <boxGeometry args={[dims.w, dims.h * 0.6, 0.2]} />
            <meshStandardMaterial color="#5b21b6" roughness={0.6} />
          </mesh>
          <mesh castShadow position={[-dims.w / 2 + 0.1, 0.05, 0]}>
            <boxGeometry args={[0.2, dims.h * 0.5, dims.d]} />
            <meshStandardMaterial color="#3b0764" />
          </mesh>
          <mesh castShadow position={[dims.w / 2 - 0.1, 0.05, 0]}>
            <boxGeometry args={[0.2, dims.h * 0.5, dims.d]} />
            <meshStandardMaterial color="#3b0764" />
          </mesh>
        </group>
      )}

      {/* ── KITCHEN COUNTER / REFRIGERATOR ──────────────────────────────── */}
      {isKitchen && (
        <group position={[0, dims.h / 2, 0]}>
          {furniture.type === 'refrigerator' ? (
            <group>
              <mesh castShadow>
                <boxGeometry args={[dims.w, dims.h, dims.d]} />
                <meshStandardMaterial color={isSelected ? '#6366f1' : '#64748b'} metalness={0.8} roughness={0.2} />
              </mesh>
              <mesh position={[0.02, 0.2, dims.d / 2 + 0.02]}>
                <boxGeometry args={[0.04, 0.6, 0.03]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
              </mesh>
            </group>
          ) : (
            <group>
              <mesh castShadow>
                <boxGeometry args={[dims.w, dims.h * 0.9, dims.d]} />
                <meshStandardMaterial color="#0f172a" roughness={0.5} />
              </mesh>
              <mesh position={[0, dims.h * 0.45 + 0.02, 0]} castShadow>
                <boxGeometry args={[dims.w + 0.04, 0.05, dims.d + 0.04]} />
                <meshStandardMaterial color="#334155" roughness={0.2} metalness={0.3} />
              </mesh>
              <mesh position={[0, dims.h * 0.45 + 0.03, 0]}>
                <boxGeometry args={[0.5, 0.02, 0.4]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
              </mesh>
            </group>
          )}
        </group>
      )}

      {/* ── BATHROOM FIXTURES ────────────────────────────────────────────── */}
      {isBath && (
        <group position={[0, dims.h / 2, 0]}>
          {furniture.type === 'toilet' && (
            <group>
              <mesh castShadow position={[0, -0.1, 0.1]}>
                <boxGeometry args={[0.38, 0.4, 0.5]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.2} />
              </mesh>
              <mesh castShadow position={[0, 0.15, -0.15]}>
                <boxGeometry args={[0.4, 0.5, 0.22]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.2} />
              </mesh>
            </group>
          )}
          {furniture.type === 'bathtub' && (
            <mesh castShadow>
              <boxGeometry args={[dims.w, dims.h, dims.d]} />
              <meshStandardMaterial color="#e0f2fe" roughness={0.2} metalness={0.2} />
            </mesh>
          )}
          {furniture.type === 'shower' && (
            <group>
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[dims.w, dims.h, dims.d]} />
                <meshStandardMaterial color="#38bdf8" transparent opacity={0.3} roughness={0.1} />
              </mesh>
            </group>
          )}
          {furniture.type === 'sink' && (
            <mesh castShadow position={[0, 0.2, 0]}>
              <boxGeometry args={[dims.w, 0.25, dims.d]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.2} />
            </mesh>
          )}
        </group>
      )}

      {/* ── GENERIC / TABLES / WARDROBES / TV ────────────────────────────── */}
      {!isBed && !isSofa && !isKitchen && !isBath && (
        <mesh position={[0, dims.h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[dims.w, dims.h, dims.d]} />
          <meshStandardMaterial
            color={isSelected ? '#6366f1' : '#d97706'}
            roughness={0.5}
            metalness={0.2}
            emissive={isSelected ? new THREE.Color('#4f46e5') : new THREE.Color('#000000')}
            emissiveIntensity={isSelected ? 0.4 : 0}
          />
        </mesh>
      )}

    </group>
  );
};
