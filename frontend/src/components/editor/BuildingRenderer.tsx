import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useBuildingStore } from '../../store/buildingStore';
import { useUIStore } from '../../store/uiStore';
import type { Wall, Room, FurnitureItem, Door, Window, Staircase, Roof } from '../../schema/building.types';
import { ROOM_COLORS, FURNITURE_DIMENSIONS } from '../../schema/building.types';

export const BuildingRenderer: React.FC = () => {
  const { building, selectedObjectId, selectObject } = useBuildingStore();
  const { layerVisibility } = useUIStore();

  // ── All hooks MUST be called unconditionally before any early returns ──────
  const maxFloorIndex = useMemo(
    () => building ? building.floors.reduce((max, f) => Math.max(max, f.index), 0) : 0,
    [building]
  );

  const floorRenderData = useMemo(() => {
    if (!building) return [];

    return building.floors.map((floor) => {
      const floorIdx = floor.index ?? 0;
      const elevation = floor.elevation ?? floor.height ?? (floorIdx * 3.0);
      const floorHeight = floor.floorToFloorHeight ?? 3.0;

      // 1. Authoritative Wall Graph (deduplicates overlapping walls)
      const effectiveWalls: Wall[] = [];
      const wallMap = new Set<string>();

      if (floor.walls && floor.walls.length > 0) {
        floor.walls.forEach(w => {
          const key = `${w.startPoint[0].toFixed(2)},${w.startPoint[1].toFixed(2)}-${w.endPoint[0].toFixed(2)},${w.endPoint[1].toFixed(2)}`;
          const revKey = `${w.endPoint[0].toFixed(2)},${w.endPoint[1].toFixed(2)}-${w.startPoint[0].toFixed(2)},${w.startPoint[1].toFixed(2)}`;
          if (!wallMap.has(key) && !wallMap.has(revKey)) {
            wallMap.add(key);
            effectiveWalls.push(w);
          }
        });
      }

      // Auto-derive missing partition/perimeter walls from room polygons
      floor.rooms.forEach((room, rIdx) => {
        if (!room.polygon || room.polygon.length < 3) return;
        const pts = room.polygon;
        for (let i = 0; i < pts.length; i++) {
          const p1 = pts[i];
          const p2 = pts[(i + 1) % pts.length];
          const key1 = `${p1[0].toFixed(2)},${p1[1].toFixed(2)}-${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
          const key2 = `${p2[0].toFixed(2)},${p2[1].toFixed(2)}-${p1[0].toFixed(2)},${p1[1].toFixed(2)}`;

          if (!wallMap.has(key1) && !wallMap.has(key2)) {
            wallMap.add(key1);
            effectiveWalls.push({
              id: `wall-auto-${floorIdx}-${rIdx}-${i}`,
              startPoint: [p1[0], p1[1]],
              endPoint: [p2[0], p2[1]],
              thickness: 0.2,
              height: floorHeight,
              isExterior: false,
            });
          }
        }
      });

      // 2. Wall Opening Segment Calculator for Doors & Windows
      const wallSegments = effectiveWalls.flatMap((wall) => {
        const sp = wall.startPoint;
        const ep = wall.endPoint;
        const dx = ep[0] - sp[0];
        const dz = ep[1] - sp[1];
        const wallLen = Math.sqrt(dx * dx + dz * dz);
        if (wallLen < 0.05) return [];

        const angle = Math.atan2(dz, dx);
        const thickness = wall.thickness ?? 0.2;
        const height = wall.height ?? floorHeight;

        // Doors on this wall — only match by wallId (no silent fallback)
        const doorsOnWall = (floor.doors ?? []).filter(d => d.wallId === wall.id);
        const windowsOnWall = (floor.windows ?? []).filter(w => w.wallId === wall.id);

        // Calculate cutouts along wall length (t in [0..1])
        const cutouts: { startDist: number; endDist: number; type: 'door' | 'window'; obj: Door | Window }[] = [];

        doorsOnWall.forEach(d => {
          let t = 0.5;
          if (typeof d.position === 'number') {
            t = d.position;
          } else if (Array.isArray(d.position)) {
            const px = d.position[0] - sp[0];
            const pz = d.position[1] - sp[1];
            t = (px * dx + pz * dz) / (wallLen * wallLen);
          } else if (typeof d.t === 'number') {
            t = d.t;
          }
          t = Math.max(0.05, Math.min(0.95, t));
          const centerDist = t * wallLen;
          const halfW = (d.width ?? 0.9) / 2;
          cutouts.push({
            startDist: Math.max(0, centerDist - halfW),
            endDist: Math.min(wallLen, centerDist + halfW),
            type: 'door',
            obj: d,
          });
        });

        windowsOnWall.forEach(w => {
          let t = 0.5;
          if (typeof w.position === 'number') {
            t = w.position;
          } else if (Array.isArray(w.position)) {
            const px = w.position[0] - sp[0];
            const pz = w.position[1] - sp[1];
            t = (px * dx + pz * dz) / (wallLen * wallLen);
          } else if (typeof w.t === 'number') {
            t = w.t;
          }
          t = Math.max(0.05, Math.min(0.95, t));
          const centerDist = t * wallLen;
          const halfW = (w.width ?? 1.2) / 2;
          cutouts.push({
            startDist: Math.max(0, centerDist - halfW),
            endDist: Math.min(wallLen, centerDist + halfW),
            type: 'window',
            obj: w,
          });
        });

        // Sort cutouts along wall
        cutouts.sort((a, b) => a.startDist - b.startDist);

        // Sub-segment generation
        const segments: {
          id: string;
          wallId: string;
          midX: number;
          midZ: number;
          length: number;
          height: number;
          yOffset: number;
          thickness: number;
          angle: number;
          isExterior: boolean;
        }[] = [];

        let currentDist = 0;

        cutouts.forEach((c, idx) => {
          // Solid wall segment before cutout
          if (c.startDist > currentDist + 0.05) {
            const segLen = c.startDist - currentDist;
            const segMidDist = currentDist + segLen / 2;
            const frac = segMidDist / wallLen;
            segments.push({
              id: `${wall.id}-seg-${idx}-full`,
              wallId: wall.id,
              midX: sp[0] + frac * dx,
              midZ: sp[1] + frac * dz,
              length: segLen,
              height: height,
              yOffset: height / 2,
              thickness,
              angle,
              isExterior: wall.isExterior,
            });
          }

          // Lintel / Sill wall segments around cutout
          const cutoutMidDist = (c.startDist + c.endDist) / 2;
          const cutoutLen = c.endDist - c.startDist;
          const frac = cutoutMidDist / wallLen;
          const cx = sp[0] + frac * dx;
          const cz = sp[1] + frac * dz;

          if (c.type === 'door') {
            const doorObj = c.obj as Door;
            const doorH = doorObj.height ?? 2.1;
            const headerH = Math.max(0, height - doorH);
            if (headerH > 0.05) {
              segments.push({
                id: `${wall.id}-door-lintel-${idx}`,
                wallId: wall.id,
                midX: cx,
                midZ: cz,
                length: cutoutLen,
                height: headerH,
                yOffset: doorH + headerH / 2,
                thickness,
                angle,
                isExterior: wall.isExterior,
              });
            }
          } else if (c.type === 'window') {
            const winObj = c.obj as Window;
            const sillH = winObj.sillHeight ?? winObj.sill ?? 0.9;
            const winH = winObj.height ?? 1.2;

            // Wall below window sill
            if (sillH > 0.05) {
              segments.push({
                id: `${wall.id}-win-sill-${idx}`,
                wallId: wall.id,
                midX: cx,
                midZ: cz,
                length: cutoutLen,
                height: sillH,
                yOffset: sillH / 2,
                thickness,
                angle,
                isExterior: wall.isExterior,
              });
            }

            // Wall above window lintel
            const topH = Math.max(0, height - (sillH + winH));
            if (topH > 0.05) {
              segments.push({
                id: `${wall.id}-win-lintel-${idx}`,
                wallId: wall.id,
                midX: cx,
                midZ: cz,
                length: cutoutLen,
                height: topH,
                yOffset: (sillH + winH) + topH / 2,
                thickness,
                angle,
                isExterior: wall.isExterior,
              });
            }
          }

          currentDist = Math.max(currentDist, c.endDist);
        });

        // Remaining wall segment to end
        if (wallLen > currentDist + 0.05) {
          const segLen = wallLen - currentDist;
          const segMidDist = currentDist + segLen / 2;
          const frac = segMidDist / wallLen;
          segments.push({
            id: `${wall.id}-seg-end`,
            wallId: wall.id,
            midX: sp[0] + frac * dx,
            midZ: sp[1] + frac * dz,
            length: segLen,
            height: height,
            yOffset: height / 2,
            thickness,
            angle,
            isExterior: wall.isExterior,
          });
        }

        return segments;
      });

      return {
        floorIdx,
        elevation,
        floorHeight,
        effectiveWalls,
        wallSegments,
        rooms: floor.rooms,
        doors: floor.doors,
        windows: floor.windows,
        staircases: floor.staircases,
        roof: floor.roof,
        isTopFloor: floorIdx === maxFloorIndex,
      };
    });
  }, [building, maxFloorIndex]);

  // ── NOW safe to have conditional return AFTER all hook calls ──────────────
  if (!building) return null;

  return (
    <group name="building-root">
      {floorRenderData.map((floor) => {
        return (
          <group key={`floor-${floor.floorIdx}`} name={`floor-${floor.floorIdx}`} position={[0, floor.elevation, 0]}>
            {/* ── Floor Structural Base Slab ──────────────────────────────────── */}
            <FloorSlabMesh rooms={floor.rooms} />

            {/* ── Room Surfaces ──────────────────────────────────────────────── */}
            {floor.rooms.map((room) => (
              <RoomMesh
                key={`room-${room.id}`}
                room={room}
                isSelected={selectedObjectId === room.id}
                onClick={(e) => { e.stopPropagation(); selectObject(room.id, 'room'); }}
              />
            ))}

            {/* ── Solid Architectural Wall Meshes with Real Door/Window Openings */}
            {layerVisibility.walls && floor.wallSegments.map((seg) => (
              <WallSegmentMesh
                key={seg.id}
                segment={seg}
                isSelected={selectedObjectId === seg.wallId}
                onClick={(e) => { e.stopPropagation(); selectObject(seg.wallId, 'wall'); }}
              />
            ))}

            {/* ── Doors with Frames & Handles ────────────────────────────────── */}
            {layerVisibility.doors && floor.doors.map((door) => (
              <DoorMesh
                key={`door-${door.id}`}
                door={door}
                walls={floor.effectiveWalls}
                isSelected={selectedObjectId === door.id}
                onClick={(e) => { e.stopPropagation(); selectObject(door.id, 'door'); }}
              />
            ))}

            {/* ── Windows with Glass Panes & Mullions ────────────────────────── */}
            {layerVisibility.windows && floor.windows.map((win) => (
              <WindowMesh
                key={`win-${win.id}`}
                windowObj={win}
                walls={floor.effectiveWalls}
                isSelected={selectedObjectId === win.id}
                onClick={(e) => { e.stopPropagation(); selectObject(win.id, 'window'); }}
              />
            ))}

            {/* ── Parametric Staircases ───────────────────────────────────────── */}
            {floor.staircases.map((stair) => (
              <StaircaseMesh
                key={`stair-${stair.id}`}
                stair={stair}
                floorElevation={floor.elevation}
                floorHeight={floor.floorHeight}
                isSelected={selectedObjectId === stair.id}
                onClick={(e) => { e.stopPropagation(); selectObject(stair.id, 'staircase'); }}
              />
            ))}

            {/* ── Procedural Furniture Objects ────────────────────────────────── */}
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

            {/* ── Top Floor Roof Structure ─────────────────────────────────────── */}
            {layerVisibility.roof && floor.isTopFloor && (
              <RoofMesh
                roof={floor.roof}
                rooms={floor.rooms}
                wallHeight={floor.floorHeight}
              />
            )}
          </group>
        );
      })}
    </group>
  );
};

// ── FloorSlabMesh ─────────────────────────────────────────────────────────────

const FloorSlabMesh: React.FC<{ rooms: Room[] }> = ({ rooms }) => {
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
        <meshStandardMaterial color="#1e293b" roughness={0.8} transparent={false} />
      </mesh>
    </group>
  );
};

// ── WallSegmentMesh ───────────────────────────────────────────────────────────

const WallSegmentMesh: React.FC<{
  segment: {
    id: string;
    wallId: string;
    midX: number;
    midZ: number;
    length: number;
    height: number;
    yOffset: number;
    thickness: number;
    angle: number;
    isExterior: boolean;
  };
  isSelected: boolean;
  onClick: (e: { stopPropagation: () => void }) => void;
}> = ({ segment, isSelected, onClick }) => {
  const wallColor = isSelected ? '#6366f1' : segment.isExterior ? '#334155' : '#475569';

  return (
    <group position={[segment.midX, segment.yOffset, segment.midZ]} rotation={[0, -segment.angle, 0]} onClick={onClick}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[segment.length, segment.height, segment.thickness]} />
        <meshStandardMaterial
          color={wallColor}
          roughness={0.75}
          metalness={0.1}
          transparent={false}
          emissive={isSelected ? new THREE.Color('#4f46e5') : new THREE.Color('#000000')}
          emissiveIntensity={isSelected ? 0.4 : 0}
        />
      </mesh>
    </group>
  );
};

// ── DoorMesh ──────────────────────────────────────────────────────────────────

const DoorMesh: React.FC<{
  door: Door;
  walls: Wall[];
  isSelected: boolean;
  onClick: (e: { stopPropagation: () => void }) => void;
}> = ({ door, walls, isSelected, onClick }) => {
  // Strict lookup — no silent fallback to walls[0]
  const wall = walls.find(w => w.id === door.wallId);
  if (!wall) return null;

  const sp = wall.startPoint;
  const ep = wall.endPoint;
  const dx = ep[0] - sp[0];
  const dz = ep[1] - sp[1];
  const wallLen = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);

  let t = 0.5;
  if (typeof door.position === 'number') {
    t = Math.max(0.05, Math.min(0.95, door.position));
  } else if (Array.isArray(door.position)) {
    const px = door.position[0] - sp[0];
    const pz = door.position[1] - sp[1];
    t = wallLen > 0 ? Math.max(0.05, Math.min(0.95, (px * dx + pz * dz) / (wallLen * wallLen))) : 0.5;
  } else if (typeof door.t === 'number') {
    t = Math.max(0.05, Math.min(0.95, door.t));
  }

  const px = sp[0] + t * dx;
  const pz = sp[1] + t * dz;

  return (
    <group position={[px, door.height / 2, pz]} rotation={[0, -angle, 0]} onClick={onClick}>
      {/* Outer Wooden Frame */}
      <mesh castShadow>
        <boxGeometry args={[door.width + 0.08, door.height + 0.06, 0.22]} />
        <meshStandardMaterial color={isSelected ? '#6366f1' : '#1e293b'} roughness={0.4} transparent={false} />
      </mesh>
      {/* Wooden Door Panel */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[door.width - 0.04, door.height - 0.04, 0.06]} />
        <meshStandardMaterial color="#9a3412" roughness={0.5} transparent={false} />
      </mesh>
      {/* Metallic Door Handle Knob */}
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
  isSelected: boolean;
  onClick: (e: { stopPropagation: () => void }) => void;
}> = ({ windowObj, walls, isSelected, onClick }) => {
  // Strict lookup — no silent fallback to walls[0]
  const wall = walls.find(w => w.id === windowObj.wallId);
  if (!wall) return null;

  const sp = wall.startPoint;
  const ep = wall.endPoint;
  const dx = ep[0] - sp[0];
  const dz = ep[1] - sp[1];
  const wallLen = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);

  let t = 0.5;
  if (typeof windowObj.position === 'number') {
    t = Math.max(0.05, Math.min(0.95, windowObj.position));
  } else if (Array.isArray(windowObj.position)) {
    const px = windowObj.position[0] - sp[0];
    const pz = windowObj.position[1] - sp[1];
    t = wallLen > 0 ? Math.max(0.05, Math.min(0.95, (px * dx + pz * dz) / (wallLen * wallLen))) : 0.5;
  } else if (typeof windowObj.t === 'number') {
    t = Math.max(0.05, Math.min(0.95, windowObj.t));
  }

  const px = sp[0] + t * dx;
  const pz = sp[1] + t * dz;

  const sillH = windowObj.sillHeight ?? windowObj.sill ?? 0.9;
  const py = sillH + windowObj.height / 2;

  return (
    <group position={[px, py, pz]} rotation={[0, -angle, 0]} onClick={onClick}>
      {/* Aluminum Window Frame */}
      <mesh castShadow>
        <boxGeometry args={[windowObj.width + 0.08, windowObj.height + 0.08, 0.22]} />
        <meshStandardMaterial color={isSelected ? '#6366f1' : '#0f172a'} roughness={0.3} metalness={0.5} transparent={false} />
      </mesh>
      {/* Translucent Glass Pane */}
      <mesh>
        <boxGeometry args={[windowObj.width - 0.04, windowObj.height - 0.04, 0.03]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.45} roughness={0.1} metalness={0.8} />
      </mesh>
      {/* Window Mullion Divider */}
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
  floorElevation: number;
  floorHeight: number;
  isSelected: boolean;
  onClick: (e: { stopPropagation: () => void }) => void;
}> = ({ stair, floorHeight, isSelected, onClick }) => {
  const px = stair.position[0];
  const pz = stair.position[1];
  const totalH = floorHeight ?? 3.0;
  const steps = Math.max(10, Math.round(totalH / 0.2)); // ~200mm riser
  const stepH = totalH / steps;
  const stepL = stair.length / steps;
  const stepW = stair.width;

  // Stair orientation: along Z axis by default
  const diagonalLen = Math.sqrt(totalH * totalH + stair.length * stair.length);
  const railAngle = Math.atan2(totalH, stair.length);

  return (
    <group position={[px, 0, pz]} onClick={onClick}>
      {/* Stair treads */}
      {Array.from({ length: steps }).map((_, i) => (
        <mesh key={i} position={[0, i * stepH + stepH / 2, i * stepL + stepL / 2]} castShadow receiveShadow>
          <boxGeometry args={[stepW, stepH, stepL]} />
          <meshStandardMaterial
            color={isSelected ? '#6366f1' : '#64748b'}
            roughness={0.6}
            metalness={0.15}
            transparent={false}
          />
        </mesh>
      ))}
      {/* Left handrail */}
      <mesh
        position={[-stepW / 2 + 0.05, totalH / 2 + 0.5, stair.length / 2]}
        rotation={[-railAngle, 0, 0]}
      >
        <cylinderGeometry args={[0.03, 0.03, diagonalLen + 0.3, 8]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Right handrail */}
      <mesh
        position={[stepW / 2 - 0.05, totalH / 2 + 0.5, stair.length / 2]}
        rotation={[-railAngle, 0, 0]}
      >
        <cylinderGeometry args={[0.03, 0.03, diagonalLen + 0.3, 8]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
};

// ── RoofMesh — proper gabled prism instead of a cone ─────────────────────────

const RoofMesh: React.FC<{
  roof?: Roof;
  rooms: Room[];
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
    const type = roof?.type ?? 'flat';
    const color = roof?.color ?? '#b91c1c';

    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;

    return { w, d, h, cx, cz, type, color };
  }, [rooms, roof]);

  // Build gable roof geometry procedurally
  const gableGeometry = useMemo(() => {
    if (!roofData || roofData.type === 'flat') return null;
    const { w, d, h } = roofData;
    // A gabled prism: 5 vertices — 4 base corners + 2 ridge points
    // Ridge runs along X axis at the mid-Z
    const hw = w / 2;
    const hd = d / 2;

    const vertices = new Float32Array([
      // Base quad (CCW from front)
      -hw, 0,  hd,   // 0 front-left
       hw, 0,  hd,   // 1 front-right
       hw, 0, -hd,   // 2 back-right
      -hw, 0, -hd,   // 3 back-left
      // Ridge
      -hw, h,  0,    // 4 ridge-left
       hw, h,  0,    // 5 ridge-right
    ]);

    // 8 triangles forming the gable prism
    const indices = new Uint16Array([
      // Front gable triangle
      0, 1, 4,  1, 5, 4,
      // Back gable triangle
      3, 4, 2,  4, 5, 2,
      // Left slope (front-left → ridge-left → back-left)
      0, 4, 3,
      // Right slope (front-right → back-right → ridge-right)
      1, 2, 5,
      // Base (optional — covered by slab so skip)
    ]);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [roofData]);

  if (!roofData) return null;

  return (
    <group position={[roofData.cx, wallHeight, roofData.cz]}>
      {roofData.type === 'flat' ? (
        <group>
          {/* Terrace Slab */}
          <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
            <boxGeometry args={[roofData.w, 0.2, roofData.d]} />
            <meshStandardMaterial color="#334155" roughness={0.8} transparent={false} />
          </mesh>
          {/* Parapet Rim Wall */}
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[roofData.w, 0.5, roofData.d]} />
            <meshStandardMaterial color="#475569" roughness={0.7} transparent={false} />
          </mesh>
        </group>
      ) : roofData.type === 'pitched_hip' ? (
        <group>
          {/* Hip roof — 4-sided pyramid */}
          <mesh position={[0, roofData.h / 2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
            <coneGeometry args={[Math.max(roofData.w, roofData.d) * 0.72, roofData.h, 4]} />
            <meshStandardMaterial color={roofData.color} roughness={0.5} metalness={0.15} transparent={false} />
          </mesh>
          {/* Eave underhang */}
          <mesh position={[0, 0.05, 0]} castShadow>
            <boxGeometry args={[roofData.w, 0.1, roofData.d]} />
            <meshStandardMaterial color="#1e293b" roughness={0.6} transparent={false} />
          </mesh>
        </group>
      ) : gableGeometry ? (
        /* Proper gabled prism for pitched_gable */
        <group>
          <mesh geometry={gableGeometry} castShadow receiveShadow>
            <meshStandardMaterial color={roofData.color} roughness={0.5} metalness={0.1} side={THREE.DoubleSide} transparent={false} />
          </mesh>
          {/* Eave underhang */}
          <mesh position={[0, 0.05, 0]} castShadow>
            <boxGeometry args={[roofData.w, 0.1, roofData.d]} />
            <meshStandardMaterial color="#1e293b" roughness={0.6} transparent={false} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
};

// ── RoomMesh ──────────────────────────────────────────────────────────────────

const RoomMesh: React.FC<{
  room: Room;
  isSelected: boolean;
  onClick: (e: { stopPropagation: () => void }) => void;
}> = ({ room, isSelected, onClick }) => {
  const geometry = useMemo(() => {
    if (!room.polygon || room.polygon.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(room.polygon[0][0], -room.polygon[0][1]);
    for (let i = 1; i < room.polygon.length; i++) {
      shape.lineTo(room.polygon[i][0], -room.polygon[i][1]);
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
        transparent={false}
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
  const isKitchen = furniture.type.includes('kitchen') || furniture.type === 'refrigerator' || furniture.type === 'stove';
  const isBath = furniture.type === 'toilet' || furniture.type === 'bathtub' || furniture.type === 'shower' || furniture.type === 'sink';
  const isTable = furniture.type === 'dining_table' || furniture.type === 'coffee_table';
  const isDeskOrShelf = furniture.type === 'desk' || furniture.type === 'bookshelf' || furniture.type === 'dresser' || furniture.type === 'wardrobe';
  const isTV = furniture.type === 'tv' || furniture.type === 'tv_unit';

  return (
    <group position={[px, 0, pz]} rotation={[0, ry, 0]} onClick={onClick}>

      {/* ── BED ──────────────────────────────────────────────────────────── */}
      {isBed && (
        <group position={[0, dims.h / 2, 0]}>
          {/* Bed frame */}
          <mesh castShadow position={[0, -dims.h * 0.3, 0]}>
            <boxGeometry args={[dims.w, dims.h * 0.4, dims.d]} />
            <meshStandardMaterial color="#451a03" roughness={0.6} transparent={false} />
          </mesh>
          {/* Headboard */}
          <mesh castShadow position={[0, dims.h * 0.2, -dims.d / 2 + 0.05]}>
            <boxGeometry args={[dims.w, dims.h * 0.8, 0.1]} />
            <meshStandardMaterial color={isSelected ? '#6366f1' : '#312e81'} roughness={0.4} transparent={false} />
          </mesh>
          {/* Mattress */}
          <mesh castShadow position={[0, 0.05, 0.05]}>
            <boxGeometry args={[dims.w - 0.08, dims.h * 0.35, dims.d - 0.15]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.8} transparent={false} />
          </mesh>
          {/* Pillows */}
          <mesh castShadow position={[-dims.w * 0.25, dims.h * 0.25, -dims.d * 0.3]}>
            <boxGeometry args={[dims.w * 0.4, 0.1, 0.35]} />
            <meshStandardMaterial color="#e0e7ff" transparent={false} />
          </mesh>
          <mesh castShadow position={[dims.w * 0.25, dims.h * 0.25, -dims.d * 0.3]}>
            <boxGeometry args={[dims.w * 0.4, 0.1, 0.35]} />
            <meshStandardMaterial color="#e0e7ff" transparent={false} />
          </mesh>
        </group>
      )}

      {/* ── SOFA ─────────────────────────────────────────────────────────── */}
      {isSofa && (
        <group position={[0, dims.h / 2, 0]}>
          <mesh castShadow position={[0, -0.1, 0]}>
            <boxGeometry args={[dims.w, dims.h * 0.5, dims.d]} />
            <meshStandardMaterial color={isSelected ? '#6366f1' : '#4c1d95'} roughness={0.7} transparent={false} />
          </mesh>
          <mesh castShadow position={[0, dims.h * 0.2, -dims.d / 2 + 0.1]}>
            <boxGeometry args={[dims.w, dims.h * 0.6, 0.2]} />
            <meshStandardMaterial color="#5b21b6" roughness={0.6} transparent={false} />
          </mesh>
          <mesh castShadow position={[-dims.w / 2 + 0.1, 0.05, 0]}>
            <boxGeometry args={[0.2, dims.h * 0.5, dims.d]} />
            <meshStandardMaterial color="#3b0764" transparent={false} />
          </mesh>
          <mesh castShadow position={[dims.w / 2 - 0.1, 0.05, 0]}>
            <boxGeometry args={[0.2, dims.h * 0.5, dims.d]} />
            <meshStandardMaterial color="#3b0764" transparent={false} />
          </mesh>
        </group>
      )}

      {/* ── KITCHEN APPLIANCES ───────────────────────────────────────────── */}
      {isKitchen && (
        <group position={[0, dims.h / 2, 0]}>
          {furniture.type === 'refrigerator' ? (
            <group>
              <mesh castShadow>
                <boxGeometry args={[dims.w, dims.h, dims.d]} />
                <meshStandardMaterial color={isSelected ? '#6366f1' : '#64748b'} metalness={0.8} roughness={0.2} transparent={false} />
              </mesh>
              <mesh position={[0.02, 0.2, dims.d / 2 + 0.02]}>
                <boxGeometry args={[0.04, 0.6, 0.03]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.9} transparent={false} />
              </mesh>
            </group>
          ) : furniture.type === 'stove' ? (
            <group>
              <mesh castShadow>
                <boxGeometry args={[dims.w, dims.h, dims.d]} />
                <meshStandardMaterial color="#1e293b" roughness={0.4} transparent={false} />
              </mesh>
              {/* Burner rings */}
              {[[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]].map(([bx, bz], bi) => (
                <mesh key={bi} position={[bx, dims.h / 2 + 0.01, bz]}>
                  <cylinderGeometry args={[0.08, 0.08, 0.02, 16]} />
                  <meshStandardMaterial color="#374151" roughness={0.3} />
                </mesh>
              ))}
            </group>
          ) : (
            <group>
              <mesh castShadow>
                <boxGeometry args={[dims.w, dims.h * 0.9, dims.d]} />
                <meshStandardMaterial color="#0f172a" roughness={0.5} transparent={false} />
              </mesh>
              <mesh position={[0, dims.h * 0.45 + 0.02, 0]} castShadow>
                <boxGeometry args={[dims.w + 0.04, 0.05, dims.d + 0.04]} />
                <meshStandardMaterial color="#334155" roughness={0.2} metalness={0.3} transparent={false} />
              </mesh>
              <mesh position={[0, dims.h * 0.45 + 0.03, 0]}>
                <boxGeometry args={[0.5, 0.02, 0.4]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} transparent={false} />
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
                <meshStandardMaterial color="#f8fafc" roughness={0.2} transparent={false} />
              </mesh>
              <mesh castShadow position={[0, 0.15, -0.15]}>
                <boxGeometry args={[0.4, 0.5, 0.22]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.2} transparent={false} />
              </mesh>
            </group>
          )}
          {furniture.type === 'bathtub' && (
            <mesh castShadow>
              <boxGeometry args={[dims.w, dims.h, dims.d]} />
              <meshStandardMaterial color="#e0f2fe" roughness={0.2} metalness={0.2} transparent={false} />
            </mesh>
          )}
          {furniture.type === 'shower' && (
            <group>
              <mesh>
                <boxGeometry args={[dims.w, dims.h, dims.d]} />
                <meshStandardMaterial color="#38bdf8" transparent opacity={0.3} roughness={0.1} />
              </mesh>
              <mesh position={[0, dims.h / 2, 0]}>
                <cylinderGeometry args={[0.03, 0.03, 0.1, 8]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
              </mesh>
            </group>
          )}
          {furniture.type === 'sink' && (
            <mesh castShadow>
              <boxGeometry args={[dims.w, dims.h + 0.7, dims.d]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.2} transparent={false} />
            </mesh>
          )}
        </group>
      )}

      {/* ── TABLES ───────────────────────────────────────────────────────── */}
      {isTable && (
        <group>
          {/* Table top */}
          <mesh position={[0, dims.h, 0]} castShadow>
            <boxGeometry args={[dims.w, 0.05, dims.d]} />
            <meshStandardMaterial color={isSelected ? '#6366f1' : '#78350f'} roughness={0.5} transparent={false} />
          </mesh>
          {/* Table legs */}
          {[[-dims.w / 2 + 0.05, -dims.d / 2 + 0.05], [dims.w / 2 - 0.05, -dims.d / 2 + 0.05],
            [-dims.w / 2 + 0.05, dims.d / 2 - 0.05], [dims.w / 2 - 0.05, dims.d / 2 - 0.05]].map(([lx, lz], li) => (
            <mesh key={li} position={[lx, dims.h / 2, lz]} castShadow>
              <cylinderGeometry args={[0.03, 0.03, dims.h, 8]} />
              <meshStandardMaterial color="#451a03" roughness={0.5} />
            </mesh>
          ))}
        </group>
      )}

      {/* ── WARDROBE / DESK / SHELF / DRESSER ───────────────────────────── */}
      {isDeskOrShelf && (
        <mesh position={[0, dims.h / 2, 0]} castShadow>
          <boxGeometry args={[dims.w, dims.h, dims.d]} />
          <meshStandardMaterial color={isSelected ? '#6366f1' : furniture.type === 'wardrobe' ? '#292524' : '#1c1917'} roughness={0.6} transparent={false} />
        </mesh>
      )}

      {/* ── TV / TV UNIT ─────────────────────────────────────────────────── */}
      {isTV && (
        <group>
          <mesh position={[0, dims.h / 2, 0]} castShadow>
            <boxGeometry args={[dims.w, dims.h, dims.d]} />
            <meshStandardMaterial color={isSelected ? '#6366f1' : '#0f172a'} roughness={0.3} metalness={0.5} transparent={false} />
          </mesh>
          {furniture.type === 'tv' && (
            <mesh position={[0, dims.h / 2, 0.01]}>
              <boxGeometry args={[dims.w - 0.04, dims.h - 0.04, 0.01]} />
              <meshStandardMaterial color="#1d4ed8" emissive="#1d4ed8" emissiveIntensity={0.3} transparent={false} />
            </mesh>
          )}
        </group>
      )}

      {/* ── DINING CHAIR / OFFICE CHAIR ─────────────────────────────────── */}
      {(furniture.type === 'dining_chair' || furniture.type === 'office_chair') && (
        <group>
          {/* Seat */}
          <mesh position={[0, dims.h * 0.5, 0]} castShadow>
            <boxGeometry args={[dims.w, 0.05, dims.d]} />
            <meshStandardMaterial color={isSelected ? '#6366f1' : '#4b5563'} roughness={0.6} transparent={false} />
          </mesh>
          {/* Backrest */}
          <mesh position={[0, dims.h * 0.75, -dims.d / 2 + 0.05]} castShadow>
            <boxGeometry args={[dims.w, dims.h * 0.4, 0.06]} />
            <meshStandardMaterial color="#374151" roughness={0.6} transparent={false} />
          </mesh>
          {/* Legs */}
          {[[-dims.w / 2 + 0.05, -dims.d / 2 + 0.05], [dims.w / 2 - 0.05, -dims.d / 2 + 0.05],
            [-dims.w / 2 + 0.05, dims.d / 2 - 0.05], [dims.w / 2 - 0.05, dims.d / 2 - 0.05]].map(([lx, lz], li) => (
            <mesh key={li} position={[lx, dims.h * 0.25, lz]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, dims.h * 0.5, 6]} />
              <meshStandardMaterial color="#1f2937" roughness={0.4} />
            </mesh>
          ))}
        </group>
      )}

      {/* ── SIDE TABLE ───────────────────────────────────────────────────── */}
      {furniture.type === 'side_table' && (
        <group>
          <mesh position={[0, dims.h, 0]} castShadow>
            <boxGeometry args={[dims.w, 0.04, dims.d]} />
            <meshStandardMaterial color={isSelected ? '#6366f1' : '#78350f'} roughness={0.5} transparent={false} />
          </mesh>
          <mesh position={[0, dims.h / 2, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, dims.h, 8]} />
            <meshStandardMaterial color="#451a03" roughness={0.5} />
          </mesh>
        </group>
      )}
    </group>
  );
};
