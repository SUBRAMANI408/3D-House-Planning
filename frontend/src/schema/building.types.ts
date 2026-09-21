export type BuildingType = 'house' | 'hospital' | 'police_station' | 'mall' | 'shop' | 'apartment';
export type Units = 'metric' | 'imperial';
export type RoomType = 'hall' | 'kitchen' | 'bedroom' | 'bathroom' | 'dining' | 'corridor' | 'living' | 'study' | 'garage' | 'balcony' | 'storeroom' | 'laundry' | 'shop_unit' | 'reception' | 'office' | 'meeting_room' | 'ward' | 'icu' | 'emergency' | 'nurse_station' | 'operating_room' | 'lockup' | 'armory' | 'food_court' | 'anchor_store';
export type FurnitureType = 'bed_single' | 'bed_double' | 'bed_queen' | 'bed_king' | 'wardrobe' | 'sofa' | 'sofa_l' | 'coffee_table' | 'dining_table' | 'dining_chair' | 'desk' | 'office_chair' | 'kitchen_counter' | 'kitchen_island' | 'refrigerator' | 'stove' | 'sink' | 'toilet' | 'bathtub' | 'shower' | 'tv' | 'tv_unit' | 'bookshelf' | 'side_table' | 'dresser';
export type DoorSwing = 'in-left' | 'in-right' | 'out-left' | 'out-right' | 'sliding' | 'double';
export type ConnectionVia = 'door' | 'opening' | 'staircase' | 'corridor';
export type CreatedVia = 'drawing' | 'ai' | 'template';

export type Vector2 = [number, number];
export type Vector3 = [number, number, number];

export interface BoundingBox {
  min: Vector3;
  max: Vector3;
}

export interface FurnitureItem {
  id: string;
  type: FurnitureType;
  position: Vector3;
  rotation: Vector3;
  scale?: Vector3;
  dimensions?: Vector3;
  boundingBox?: { w: number; d: number; h: number };
  color?: string;
  visible?: boolean;
}

export interface RoomConnection {
  targetRoomId?: string;
  toRoomId?: string;
  via: ConnectionVia;
  doorId?: string;
  description?: string;
}

export interface Wall {
  id: string;
  startPoint: Vector2;
  endPoint: Vector2;
  thickness: number;
  height: number;
  material?: string;
  isExterior: boolean;
  visible?: boolean;
}

export interface Door {
  id: string;
  wallId: string;
  position: number | Vector2; // scalar 0..1 or global Vector2
  t?: number;
  width: number;
  height: number;
  swing: DoorSwing;
  isEntrance?: boolean;
  visible?: boolean;
}

export interface Window {
  id: string;
  wallId: string;
  position: number | Vector2; // scalar 0..1 or global Vector2
  t?: number;
  width: number;
  height: number;
  sillHeight: number;
  sill?: number;
  visible?: boolean;
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  wallIds: string[];
  polygon: Vector2[];
  floorMaterial?: string;
  ceilingMaterial?: string;
  furniture: FurnitureItem[];
  connections: RoomConnection[];
  area?: number;       // Canonical area in m²
  areaSqFt?: number;   // Display derived area in sq ft
  visible?: boolean;
}

export interface Staircase {
  id: string;
  startFloorIndex: number;
  endFloorIndex: number;
  position: Vector2;
  width: number;
  length: number;
  footprint?: Vector2[];
  type: 'straight' | 'l-shaped' | 'u-shaped' | 'spiral';
  visible?: boolean;
}

export interface Roof {
  id: string;
  type: 'flat' | 'pitched_gable' | 'pitched_hip';
  height: number;
  overhang: number;
  color?: string;
  visible?: boolean;
}

export interface Floor {
  index: number;
  name: string;
  height: number;              // height of the floor base from ground
  elevation?: number;          // elevation metres from ground
  floorToFloorHeight?: number; // vertical floor-to-floor height
  rooms: Room[];
  walls: Wall[];
  doors: Door[];
  windows: Window[];
  staircases: Staircase[];
  roof?: Roof;
}

export interface Entrance {
  id: string;
  floorIndex: number;
  position: Vector2;
  wallId?: string;
  doorId?: string;
  type: 'main' | 'back' | 'service';
}

export interface BuildingMetadata {
  name: string;
  description?: string;
  type: BuildingType;
  units: Units;
  createdVia: CreatedVia;
  createdAt: string;
  updatedAt: string;
  style?: string;
  tags?: string[];
  location?: string;
  createdBy?: string;
}

export interface Building {
  schemaVersion?: string;
  id: string;
  metadata: BuildingMetadata;
  floors: Floor[];
  entrances: Entrance[];
  boundingBox?: BoundingBox;
}

export const ROOM_COLORS: Record<RoomType, string> = {
  hall: '#E8F6F3',
  kitchen: '#FAD7A1',
  bedroom: '#D4E6F1',
  bathroom: '#D1F2EB',
  dining: '#FDEBD0',
  corridor: '#F4F6F6',
  living: '#E8DAEF',
  study: '#FCF3CF',
  garage: '#E5E8E8',
  balcony: '#D5F5E3',
  storeroom: '#EBEDEF',
  laundry: '#EAF2F8',
  shop_unit: '#F9E79F',
  reception: '#FADBD8',
  office: '#D6EAF8',
  meeting_room: '#D1F2EB',
  ward: '#E8F8F5',
  icu: '#F5EEF8',
  emergency: '#FDEDEC',
  nurse_station: '#FEF9E7',
  operating_room: '#EAF2F8',
  lockup: '#F2F3F4',
  armory: '#E5E7E9',
  food_court: '#FDEBD0',
  anchor_store: '#F5B041'
};

export const FURNITURE_DIMENSIONS: Record<FurnitureType, {w: number, d: number, h: number}> = {
  bed_single: { w: 0.9, d: 1.9, h: 0.5 },
  bed_double: { w: 1.35, d: 1.9, h: 0.5 },
  bed_queen: { w: 1.5, d: 2.0, h: 0.5 },
  bed_king: { w: 1.8, d: 2.0, h: 0.5 },
  wardrobe: { w: 1.0, d: 0.6, h: 2.0 },
  sofa: { w: 2.0, d: 0.8, h: 0.8 },
  sofa_l: { w: 2.5, d: 1.5, h: 0.8 },
  coffee_table: { w: 1.0, d: 0.6, h: 0.4 },
  dining_table: { w: 1.5, d: 0.9, h: 0.75 },
  dining_chair: { w: 0.45, d: 0.45, h: 0.9 },
  desk: { w: 1.2, d: 0.6, h: 0.75 },
  office_chair: { w: 0.6, d: 0.6, h: 1.0 },
  kitchen_counter: { w: 2.0, d: 0.6, h: 0.9 },
  kitchen_island: { w: 1.8, d: 0.9, h: 0.9 },
  refrigerator: { w: 0.8, d: 0.7, h: 1.8 },
  stove: { w: 0.6, d: 0.6, h: 0.9 },
  sink: { w: 0.6, d: 0.5, h: 0.2 },
  toilet: { w: 0.4, d: 0.7, h: 0.8 },
  bathtub: { w: 0.7, d: 1.7, h: 0.5 },
  shower: { w: 0.9, d: 0.9, h: 2.0 },
  tv: { w: 1.0, d: 0.1, h: 0.6 },
  tv_unit: { w: 1.5, d: 0.4, h: 0.5 },
  bookshelf: { w: 0.8, d: 0.3, h: 1.8 },
  side_table: { w: 0.4, d: 0.4, h: 0.5 },
  dresser: { w: 1.2, d: 0.5, h: 0.8 }
};

export const ROOM_LABELS: Record<RoomType, string> = {
  hall: 'Hall',
  kitchen: 'Kitchen',
  bedroom: 'Bedroom',
  bathroom: 'Bathroom',
  dining: 'Dining Room',
  corridor: 'Corridor',
  living: 'Living Room',
  study: 'Study Room',
  garage: 'Garage',
  balcony: 'Balcony',
  storeroom: 'Storeroom',
  laundry: 'Laundry Room',
  shop_unit: 'Shop Unit',
  reception: 'Reception',
  office: 'Office',
  meeting_room: 'Meeting Room',
  ward: 'Ward',
  icu: 'ICU',
  emergency: 'Emergency',
  nurse_station: 'Nurse Station',
  operating_room: 'Operating Room',
  lockup: 'Lockup',
  armory: 'Armory',
  food_court: 'Food Court',
  anchor_store: 'Anchor Store'
};
