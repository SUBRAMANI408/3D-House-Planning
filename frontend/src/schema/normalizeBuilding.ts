/**
 * normalizeBuilding.ts
 *
 * Converts the template / API building JSON format (wallId, start, end, roomId, floorIndex, ...)
 * into the canonical Building interface used by the app (id, startPoint, endPoint, index, ...).
 *
 * Preserves staircases, entrances, and all connections.
 */

import type {
  Building,
  Floor,
  Room,
  Wall,
  FurnitureItem,
  RoomConnection,
  RoomType,
  FurnitureType,
  BuildingType,
  Units,
  CreatedVia,
  Staircase,
  Entrance,
} from './building.types';

// ── Raw (legacy / API) types ──────────────────────────────────────────────────

interface RawFurniture {
  furnitureId?: string;
  id?: string;
  type: string;
  position: [number, number, number];
  rotation?: [number, number, number] | number;
  scale?: [number, number, number];
  boundingBox?: { w: number; d: number; h: number };
}

interface RawConnection {
  toRoomId?: string;
  targetRoomId?: string;
  via: string;
  doorId?: string;
  description?: string;
}

interface RawRoom {
  roomId?: string;
  id?: string;
  type: string;
  label?: string;
  name?: string;
  polygon: [number, number][];
  areaSqFt?: number;
  area?: number;
  connections?: RawConnection[];
  furniture?: RawFurniture[];
  wallIds?: string[];
}

interface RawWall {
  wallId?: string;
  id?: string;
  start?: [number, number];
  end?: [number, number];
  startPoint?: [number, number];
  endPoint?: [number, number];
  thickness?: number;
  height?: number;
  is_load_bearing?: boolean;
  isExterior?: boolean;
  isLoadBearing?: boolean;
}

interface RawDoor {
  doorId?: string;
  id?: string;
  wallId?: string;
  position?: number | [number, number];
  width?: number;
  height?: number;
  swing?: string;
  is_entrance?: boolean;
}

interface RawWindow {
  windowId?: string;
  id?: string;
  wallId?: string;
  position?: number | [number, number];
  width?: number;
  height?: number;
  sillHeight?: number;
}

interface RawStaircase {
  staircaseId?: string;
  id?: string;
  location?: string;
  connectsFloors?: [number, number];
  footprint?: [number, number][];
  style?: string;
}

interface RawFloor {
  floorIndex?: number;
  index?: number;
  label?: string;
  name?: string;
  elevation?: number;
  height?: number;
  floorHeight?: number;
  rooms?: RawRoom[];
  walls?: RawWall[];
  doors?: RawDoor[];
  windows?: RawWindow[];
  staircase?: RawStaircase;
  staircases?: RawStaircase[];
}

interface RawEntrance {
  id?: string;
  floorIndex?: number;
  position?: [number, number];
  type?: 'main' | 'back' | 'service';
  wallId?: string;
  doorId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawBuilding = Record<string, any>;

// ── Normalizer ────────────────────────────────────────────────────────────────

function normalizeFurniture(raw: RawFurniture, idx: number): FurnitureItem {
  const id = raw.furnitureId ?? raw.id ?? `furn-${idx}`;
  const rot = raw.rotation;
  let rotation: [number, number, number];
  if (Array.isArray(rot)) {
    rotation = [rot[0] ?? 0, rot[1] ?? 0, rot[2] ?? 0];
  } else if (typeof rot === 'number') {
    rotation = [0, rot, 0];
  } else {
    rotation = [0, 0, 0];
  }
  return {
    id,
    type: raw.type as FurnitureType,
    position: [raw.position[0], raw.position[1], raw.position[2]],
    rotation,
  };
}

function normalizeConnection(raw: RawConnection): RoomConnection {
  return {
    targetRoomId: raw.targetRoomId ?? raw.toRoomId ?? '',
    via: raw.via as RoomConnection['via'],
    description: raw.description ?? raw.doorId,
  };
}

function normalizeRoom(raw: RawRoom, idx: number): Room {
  return {
    id: raw.id ?? raw.roomId ?? `room-${idx}`,
    name: raw.name ?? raw.label ?? raw.type,
    type: raw.type as RoomType,
    wallIds: raw.wallIds ?? [],
    polygon: raw.polygon,
    area: raw.area ?? raw.areaSqFt,
    furniture: (raw.furniture ?? []).map(normalizeFurniture),
    connections: (raw.connections ?? []).map(normalizeConnection),
  };
}

function normalizeWall(raw: RawWall, idx: number): Wall {
  const startPoint = raw.startPoint ?? raw.start ?? [0, 0];
  const endPoint   = raw.endPoint   ?? raw.end   ?? [1, 0];
  return {
    id: raw.id ?? raw.wallId ?? `wall-${idx}`,
    startPoint: [startPoint[0], startPoint[1]],
    endPoint:   [endPoint[0],   endPoint[1]],
    thickness: raw.thickness ?? 0.2,
    height: raw.height ?? 3.0,
    isExterior: raw.isExterior ?? raw.is_load_bearing ?? false,
  };
}

function normalizeStaircase(raw: RawStaircase, idx: number, floorIndex: number): Staircase {
  const fp = raw.footprint ?? [[0, 0], [2, 0], [2, 3], [0, 3]];
  const minX = Math.min(...fp.map(p => p[0]));
  const minY = Math.min(...fp.map(p => p[1]));
  const maxX = Math.max(...fp.map(p => p[0]));
  const maxY = Math.max(...fp.map(p => p[1]));

  return {
    id: raw.staircaseId ?? raw.id ?? `stair-${idx}`,
    startFloorIndex: raw.connectsFloors ? raw.connectsFloors[0] : floorIndex,
    endFloorIndex: raw.connectsFloors ? raw.connectsFloors[1] : floorIndex + 1,
    position: [minX, minY],
    width: Math.max(0.8, maxX - minX),
    length: Math.max(1.5, maxY - minY),
    type: (raw.style as Staircase['type']) || 'straight',
  };
}

function normalizeFloor(raw: RawFloor, idx: number): Floor {
  const index = raw.index ?? raw.floorIndex ?? idx;
  const height = raw.height ?? raw.elevation ?? (index * 3);

  const rawStairs: RawStaircase[] = [];
  if (raw.staircases && Array.isArray(raw.staircases)) {
    rawStairs.push(...raw.staircases);
  } else if (raw.staircase && typeof raw.staircase === 'object') {
    rawStairs.push(raw.staircase);
  }

  const staircases = rawStairs.map((s, i) => normalizeStaircase(s, i, index));

  return {
    index,
    name: raw.name ?? raw.label ?? `Floor ${index}`,
    height,
    rooms: (raw.rooms ?? []).map(normalizeRoom),
    walls: (raw.walls ?? []).map(normalizeWall),
    doors: (raw.doors ?? []).map((d: RawDoor, i: number) => ({
      id: d.id ?? d.doorId ?? `door-${i}`,
      wallId: d.wallId ?? '',
      position: Array.isArray(d.position)
        ? (d.position as [number, number])
        : [d.position ?? 0, 0],
      width: d.width ?? 0.9,
      height: d.height ?? 2.1,
      swing: (d.swing ?? 'in-left') as Building['floors'][0]['doors'][0]['swing'],
    })),
    windows: (raw.windows ?? []).map((w: RawWindow, i: number) => ({
      id: w.id ?? w.windowId ?? `win-${i}`,
      wallId: w.wallId ?? '',
      position: Array.isArray(w.position)
        ? (w.position as [number, number])
        : [w.position ?? 0, 0],
      width: w.width ?? 1.2,
      height: w.height ?? 1.2,
      sillHeight: w.sillHeight ?? 0.9,
    })),
    staircases,
  };
}

export function normalizeBuilding(raw: RawBuilding): Building {
  const isNormalized =
    typeof raw.id === 'string' &&
    raw.metadata &&
    typeof raw.metadata.name === 'string';

  if (isNormalized) return raw as unknown as Building;

  const floors: Floor[] = (raw.floors ?? []).map(
    (f: RawFloor, i: number) => normalizeFloor(f, i)
  );

  const entrances: Entrance[] = [];
  if (raw.entrances && Array.isArray(raw.entrances)) {
    entrances.push(...raw.entrances);
  } else if (raw.entrance && typeof raw.entrance === 'object') {
    const rawEnt = raw.entrance as RawEntrance;
    entrances.push({
      id: rawEnt.id ?? 'entrance-0',
      floorIndex: rawEnt.floorIndex ?? 0,
      position: rawEnt.position ?? [0, 0],
      type: rawEnt.type ?? 'main'
    });
  }

  return {
    id: raw.buildingId ?? raw.id ?? `building-${Date.now()}`,
    metadata: {
      name: raw.name ?? raw.buildingName ?? 'Untitled Building',
      description: raw.metadata?.description ?? raw.description,
      type: (raw.buildingType ?? raw.type ?? 'house') as BuildingType,
      units: (raw.units ?? 'metric') as Units,
      createdVia: (raw.metadata?.createdVia ?? 'template') as CreatedVia,
      createdAt: raw.metadata?.createdAt ?? new Date().toISOString(),
      updatedAt: raw.metadata?.updatedAt ?? new Date().toISOString(),
      tags: raw.metadata?.tags,
    },
    floors,
    entrances,
  };
}
