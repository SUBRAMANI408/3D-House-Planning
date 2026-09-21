/**
 * denormalizeBuilding.ts
 *
 * Converts frontend canonical Building interface (id, startPoint, endPoint, index, entrances array, staircases array)
 * into backend Pydantic-compatible JSON format (buildingId, buildingType, start, end, floorIndex, singular staircase, singular entrance).
 */

import type { Building, Floor, Room, Wall, Door, Window, FurnitureItem } from './building.types';
import { FURNITURE_DIMENSIONS } from './building.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function denormalizeBuilding(building: Building): Record<string, any> {
  const primaryEntrance = building.entrances && building.entrances.length > 0
    ? {
        floorIndex: building.entrances[0].floorIndex ?? 0,
        wallId: 'w1',
        doorId: undefined,
        facing: 'south'
      }
    : undefined;

  return {
    buildingId: building.id,
    buildingType: building.metadata.type,
    name: building.metadata.name,
    units: building.metadata.units,
    metadata: {
      createdBy: undefined,
      createdVia: building.metadata.createdVia,
      createdAt: building.metadata.createdAt,
      style: undefined,
      description: building.metadata.description
    },
    entrance: primaryEntrance,
    floors: building.floors.map((floor: Floor) => {
      const primaryStaircase = floor.staircases && floor.staircases.length > 0
        ? {
            staircaseId: floor.staircases[0].id,
            location: 'internal',
            connectsFloors: [floor.staircases[0].startFloorIndex, floor.staircases[0].endFloorIndex],
            footprint: [
              [floor.staircases[0].position[0], floor.staircases[0].position[1]],
              [floor.staircases[0].position[0] + floor.staircases[0].width, floor.staircases[0].position[1]],
              [floor.staircases[0].position[0] + floor.staircases[0].width, floor.staircases[0].position[1] + floor.staircases[0].length],
              [floor.staircases[0].position[0], floor.staircases[0].position[1] + floor.staircases[0].length]
            ],
            style: floor.staircases[0].type || 'straight'
          }
        : undefined;

      return {
        floorIndex: floor.index,
        label: floor.name,
        elevation: floor.height,
        floorHeight: 3.0,
        staircase: primaryStaircase,
        rooms: floor.rooms.map((room: Room) => ({
          roomId: room.id,
          type: room.type,
          label: room.name,
          polygon: room.polygon,
          areaSqFt: room.area,
          connections: room.connections.map((conn) => ({
            toRoomId: conn.targetRoomId,
            via: conn.via,
            doorId: conn.description
          })),
          furniture: room.furniture.map((f: FurnitureItem) => {
            const dims = FURNITURE_DIMENSIONS[f.type] || { w: 1.0, d: 1.0, h: 1.0 };
            return {
              furnitureId: f.id,
              type: f.type,
              assetRef: undefined,
              position: f.position,
              rotation: f.rotation,
              scale: [1, 1, 1],
              boundingBox: { w: dims.w, d: dims.d, h: dims.h },
              visible: f.visible ?? true
            };
          }),
          visible: room.visible ?? true
        })),
        walls: floor.walls.map((wall: Wall) => ({
          wallId: wall.id,
          start: wall.startPoint,
          end: wall.endPoint,
          thickness: wall.thickness,
          height: wall.height,
          material: 'concrete',
          is_load_bearing: wall.isExterior,
          visible: wall.visible ?? true
        })),
        doors: floor.doors.map((door: Door) => ({
          doorId: door.id,
          wallId: door.wallId,
          position: Array.isArray(door.position) ? 0.5 : (door.position ?? 0.5),
          width: door.width,
          height: door.height,
          swing: door.swing,
          is_entrance: false,
          visible: door.visible ?? true
        })),
        windows: floor.windows.map((win: Window) => ({
          windowId: win.id,
          wallId: win.wallId,
          position: Array.isArray(win.position) ? 0.5 : (win.position ?? 0.5),
          width: win.width,
          height: win.height,
          sill: win.sillHeight,
          visible: win.visible ?? true
        }))
      };
    })
  };
}
