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
  Door,
  Window,
  Roof,
  Vector2
} from './building.types';
import { FURNITURE_DIMENSIONS } from './building.types';

export function normalizeFurniture(raw: any, idx: number): FurnitureItem {
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

  const dims = raw.boundingBox ?? raw.dimensions ?? FURNITURE_DIMENSIONS[raw.type as FurnitureType] ?? { w: 1.0, d: 1.0, h: 1.0 };
  const pos = raw.position ?? [0, 0, 0];

  return {
    id,
    type: (raw.type ?? 'sofa') as FurnitureType,
    position: [pos[0] ?? 0, pos[1] ?? 0, pos[2] ?? 0],
    rotation,
    scale: raw.scale ?? [1, 1, 1],
    boundingBox: typeof dims === 'object' ? dims : { w: 1, d: 1, h: 1 },
    visible: raw.visible !== false
  };
}

export function normalizeConnection(raw: any): RoomConnection {
  return {
    targetRoomId: raw.targetRoomId ?? raw.toRoomId ?? '',
    via: (raw.via ?? 'door') as RoomConnection['via'],
    doorId: raw.doorId,
    description: raw.description ?? raw.doorId
  };
}

export function calculatePolygonArea(polygon: Vector2[]): number {
  if (!polygon || polygon.length < 3) return 0;
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i][0] * polygon[j][1];
    area -= polygon[j][0] * polygon[i][1];
  }
  return Math.abs(area) / 2.0;
}

export function normalizeRoom(raw: any, idx: number): Room {
  const polygon: Vector2[] = (raw.polygon ?? []).map((p: any) => [Number(p[0]), Number(p[1])]);
  const calcArea = calculatePolygonArea(polygon);
  const areaM2 = calcArea > 0 ? calcArea : Number(raw.area ?? (raw.areaSqFt ? raw.areaSqFt / 10.7639 : 0));
  const areaSqFt = Number((areaM2 * 10.7639).toFixed(1));

  return {
    id: raw.id ?? raw.roomId ?? `room-${idx}`,
    name: raw.name ?? raw.label ?? raw.type ?? `Room ${idx}`,
    type: (raw.type ?? 'living') as RoomType,
    wallIds: raw.wallIds ?? [],
    polygon,
    area: Number(areaM2.toFixed(1)),
    areaSqFt,
    furniture: (raw.furniture ?? []).map((f: any, i: number) => normalizeFurniture(f, i)),
    connections: (raw.connections ?? []).map((c: any) => normalizeConnection(c)),
    visible: raw.visible !== false
  };
}

export function normalizeWall(raw: any, idx: number): Wall {
  const startPoint: Vector2 = raw.startPoint ?? raw.start ?? [0, 0];
  const endPoint: Vector2   = raw.endPoint   ?? raw.end   ?? [1, 0];
  return {
    id: raw.id ?? raw.wallId ?? `wall-${idx}`,
    startPoint: [Number(startPoint[0]), Number(startPoint[1])],
    endPoint:   [Number(endPoint[0]),   Number(endPoint[1])],
    thickness: Number(raw.thickness ?? 0.2),
    height: Number(raw.height ?? 3.0),
    material: raw.material ?? 'concrete',
    isExterior: Boolean(raw.isExterior ?? false),
    isLoadBearing: Boolean(raw.isLoadBearing ?? raw.is_load_bearing ?? false),
    visible: raw.visible !== false
  };
}

export function normalizeDoor(raw: any, idx: number): Door {
  let pos: number | Vector2;
  if (Array.isArray(raw.position)) {
    pos = [Number(raw.position[0]), Number(raw.position[1])];
  } else if (typeof raw.position === 'number') {
    pos = raw.position;
  } else {
    pos = 0.5;
  }

  return {
    id: raw.id ?? raw.doorId ?? `door-${idx}`,
    wallId: raw.wallId ?? raw.wall_id ?? '',
    position: pos,
    width: Number(raw.width ?? 0.9),
    height: Number(raw.height ?? 2.1),
    swing: (raw.swing ?? 'in-left') as Door['swing'],
    isEntrance: Boolean(raw.isEntrance ?? raw.is_entrance ?? false),
    visible: raw.visible !== false
  };
}

export function normalizeWindow(raw: any, idx: number): Window {
  let pos: number | Vector2;
  if (Array.isArray(raw.position)) {
    pos = [Number(raw.position[0]), Number(raw.position[1])];
  } else if (typeof raw.position === 'number') {
    pos = raw.position;
  } else {
    pos = 0.5;
  }

  const sill = Number(raw.sillHeight ?? raw.sill ?? 0.9);

  return {
    id: raw.id ?? raw.windowId ?? `win-${idx}`,
    wallId: raw.wallId ?? raw.wall_id ?? '',
    position: pos,
    width: Number(raw.width ?? 1.2),
    height: Number(raw.height ?? 1.2),
    sillHeight: sill,
    sill,
    visible: raw.visible !== false
  };
}

export function normalizeStaircase(raw: any, idx: number, floorIndex: number): Staircase {
  const fp: Vector2[] = (raw.footprint ?? []).map((p: any) => [Number(p[0]), Number(p[1])]);

  let minX = 0, minY = 0, maxX = 2, maxY = 3;
  if (fp.length > 0) {
    minX = Math.min(...fp.map(p => p[0]));
    minY = Math.min(...fp.map(p => p[1]));
    maxX = Math.max(...fp.map(p => p[0]));
    maxY = Math.max(...fp.map(p => p[1]));
  }

  const pos: Vector2 = raw.position ? [Number(raw.position[0]), Number(raw.position[1])] : [minX, minY];

  return {
    id: raw.staircaseId ?? raw.id ?? `stair-${idx}`,
    startFloorIndex: raw.connectsFloors ? Number(raw.connectsFloors[0]) : (raw.startFloorIndex ?? floorIndex),
    endFloorIndex: raw.connectsFloors ? Number(raw.connectsFloors[1]) : (raw.endFloorIndex ?? (floorIndex + 1)),
    position: pos,
    width: Number(raw.width ?? Math.max(0.8, maxX - minX)),
    length: Number(raw.length ?? Math.max(1.5, maxY - minY)),
    footprint: fp.length > 0 ? fp : undefined,
    type: (raw.type ?? raw.style ?? 'straight') as Staircase['type'],
    visible: raw.visible !== false
  };
}

export function normalizeFloor(raw: any, idx: number): Floor {
  const index = Number(raw.index ?? raw.floorIndex ?? idx);
  const elevation = Number(raw.elevation ?? raw.height ?? (index * 3.0));
  const floorHeight = Number(raw.floorHeight ?? raw.floorToFloorHeight ?? 3.0);

  const rawStairs: any[] = [];
  if (raw.staircases && Array.isArray(raw.staircases)) {
    rawStairs.push(...raw.staircases);
  } else if (raw.staircase && typeof raw.staircase === 'object') {
    rawStairs.push(raw.staircase);
  }

  const staircases = rawStairs.map((s, i) => normalizeStaircase(s, i, index));

  const roof: Roof | undefined = raw.roof ? {
    id: raw.roof.id ?? `roof-${index}`,
    type: raw.roof.type ?? 'pitched_hip',
    height: Number(raw.roof.height ?? 2.2),
    overhang: Number(raw.roof.overhang ?? 0.6),
    color: raw.roof.color ?? '#b91c1c',
    visible: raw.roof.visible !== false
  } : undefined;

  return {
    index,
    name: raw.name ?? raw.label ?? `Floor ${index}`,
    height: elevation,
    elevation,
    floorToFloorHeight: floorHeight,
    rooms: (raw.rooms ?? []).map((r: any, i: number) => normalizeRoom(r, i)),
    walls: (raw.walls ?? []).map((w: any, i: number) => normalizeWall(w, i)),
    doors: (raw.doors ?? []).map((d: any, i: number) => normalizeDoor(d, i)),
    windows: (raw.windows ?? []).map((w: any, i: number) => normalizeWindow(w, i)),
    staircases,
    roof
  };
}

export function normalizeBuilding(raw: any): Building {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid building raw input');
  }

  const floors: Floor[] = (raw.floors ?? []).map((f: any, i: number) => normalizeFloor(f, i));

  const entrances: Entrance[] = [];
  if (raw.entrances && Array.isArray(raw.entrances)) {
    raw.entrances.forEach((ent: any, i: number) => {
      entrances.push({
        id: ent.id ?? `entrance-${i}`,
        floorIndex: Number(ent.floorIndex ?? 0),
        position: Array.isArray(ent.position) ? [Number(ent.position[0]), Number(ent.position[1])] : [0, 0],
        wallId: ent.wallId,
        doorId: ent.doorId,
        type: ent.type ?? 'main'
      });
    });
  } else if (raw.entrance && typeof raw.entrance === 'object') {
    const rawEnt = raw.entrance;
    entrances.push({
      id: rawEnt.id ?? 'entrance-0',
      floorIndex: Number(rawEnt.floorIndex ?? 0),
      position: Array.isArray(rawEnt.position) ? [Number(rawEnt.position[0]), Number(rawEnt.position[1])] : [0, 0],
      wallId: rawEnt.wallId,
      doorId: rawEnt.doorId,
      type: rawEnt.type ?? 'main'
    });
  }

  const bId = raw.id ?? raw.buildingId ?? `building-${Date.now()}`;
  const metadata = raw.metadata ?? {};

  return {
    schemaVersion: raw.schemaVersion ?? '1.0',
    id: bId,
    metadata: {
      name: raw.name ?? raw.buildingName ?? metadata.name ?? 'Untitled Building',
      description: metadata.description ?? raw.description,
      type: (raw.buildingType ?? raw.type ?? metadata.type ?? 'house') as BuildingType,
      units: (raw.units ?? metadata.units ?? 'metric') as Units,
      createdVia: (metadata.createdVia ?? raw.createdVia ?? 'template') as CreatedVia,
      createdAt: metadata.createdAt ?? new Date().toISOString(),
      updatedAt: metadata.updatedAt ?? new Date().toISOString(),
      style: metadata.style ?? raw.style,
      tags: metadata.tags,
      location: metadata.location,
      createdBy: metadata.createdBy ?? raw.createdBy
    },
    floors,
    entrances,
    boundingBox: raw.boundingBox
  };
}
