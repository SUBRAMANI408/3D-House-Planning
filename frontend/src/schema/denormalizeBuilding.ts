/**
 * denormalizeBuilding.ts
 *
 * Converts canonical Building interface into API / template JSON format with field aliases.
 * Preserves all object IDs, furniture bounding boxes, door/window scalar positions t (0..1),
 * staircases array, entrances, and roof definitions.
 */

import type { Building, Floor, Room, Wall, Door, Window, FurnitureItem } from './building.types';
import { FURNITURE_DIMENSIONS } from './building.types';

export function denormalizeBuilding(building: Building): Record<string, any> {
  const primaryEntrance = building.entrances && building.entrances.length > 0
    ? {
        id: building.entrances[0].id,
        floorIndex: building.entrances[0].floorIndex ?? 0,
        wallId: building.entrances[0].wallId ?? '',
        doorId: building.entrances[0].doorId,
        position: building.entrances[0].position,
        type: building.entrances[0].type ?? 'main'
      }
    : undefined;

  return {
    schemaVersion: building.schemaVersion ?? '1.0',
    buildingId: building.id,
    id: building.id,
    buildingType: building.metadata.type,
    name: building.metadata.name,
    units: building.metadata.units,
    metadata: {
      createdBy: building.metadata.createdBy,
      createdVia: building.metadata.createdVia,
      createdAt: building.metadata.createdAt,
      updatedAt: building.metadata.updatedAt,
      style: building.metadata.style,
      description: building.metadata.description,
      tags: building.metadata.tags
    },
    entrance: primaryEntrance,
    entrances: building.entrances,
    floors: building.floors.map((floor: Floor) => {
      const staircases = floor.staircases.map(stair => ({
        staircaseId: stair.id,
        id: stair.id,
        startFloorIndex: stair.startFloorIndex,
        endFloorIndex: stair.endFloorIndex,
        location: 'internal',
        connectsFloors: [stair.startFloorIndex, stair.endFloorIndex],
        position: stair.position,
        width: stair.width,
        length: stair.length,
        footprint: stair.footprint ?? [
          [stair.position[0], stair.position[1]],
          [stair.position[0] + stair.width, stair.position[1]],
          [stair.position[0] + stair.width, stair.position[1] + stair.length],
          [stair.position[0], stair.position[1] + stair.length]
        ],
        style: stair.type || 'straight',
        type: stair.type || 'straight'
      }));

      const primaryStaircase = staircases.length > 0 ? staircases[0] : undefined;

      return {
        floorIndex: floor.index,
        index: floor.index,
        label: floor.name,
        name: floor.name,
        elevation: floor.elevation ?? floor.height,
        height: floor.elevation ?? floor.height,
        floorHeight: floor.floorToFloorHeight ?? 3.0,
        staircase: primaryStaircase,
        staircases,
        roof: floor.roof ? {
          id: floor.roof.id,
          type: floor.roof.type,
          height: floor.roof.height,
          overhang: floor.roof.overhang,
          color: floor.roof.color,
          visible: floor.roof.visible ?? true
        } : undefined,
        rooms: floor.rooms.map((room: Room) => ({
          roomId: room.id,
          id: room.id,
          type: room.type,
          label: room.name,
          name: room.name,
          polygon: room.polygon,
          area: room.area,
          areaSqFt: room.areaSqFt ?? (room.area ? room.area * 10.7639 : 0),
          wallIds: room.wallIds,
          connections: room.connections.map((conn) => ({
            toRoomId: conn.targetRoomId,
            targetRoomId: conn.targetRoomId,
            via: conn.via,
            doorId: conn.doorId ?? conn.description,
            description: conn.description
          })),
          furniture: room.furniture.map((f: FurnitureItem) => {
            const dims = f.boundingBox ?? FURNITURE_DIMENSIONS[f.type] ?? { w: 1.0, d: 1.0, h: 1.0 };
            return {
              furnitureId: f.id,
              id: f.id,
              type: f.type,
              position: f.position,
              rotation: f.rotation,
              scale: f.scale ?? [1, 1, 1],
              boundingBox: typeof dims === 'object' ? dims : { w: 1, d: 1, h: 1 },
              visible: f.visible ?? true
            };
          }),
          visible: room.visible ?? true
        })),
        walls: floor.walls.map((wall: Wall) => ({
          wallId: wall.id,
          id: wall.id,
          start: wall.startPoint,
          startPoint: wall.startPoint,
          end: wall.endPoint,
          endPoint: wall.endPoint,
          thickness: wall.thickness,
          height: wall.height,
          material: wall.material ?? 'concrete',
          is_load_bearing: wall.isExterior,
          isExterior: wall.isExterior,
          visible: wall.visible ?? true
        })),
        doors: floor.doors.map((door: Door) => {
          let posVal: any = door.position;
          if (Array.isArray(door.position)) {
            // Find wall endpoints to calculate normalized scalar t (0..1)
            const wall = floor.walls.find(w => w.id === door.wallId);
            if (wall) {
              const dx = wall.endPoint[0] - wall.startPoint[0];
              const dy = wall.endPoint[1] - wall.startPoint[1];
              const lenSq = dx * dx + dy * dy;
              if (lenSq > 0.0001) {
                const px = door.position[0] - wall.startPoint[0];
                const py = door.position[1] - wall.startPoint[1];
                posVal = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
              }
            }
          }
          return {
            doorId: door.id,
            id: door.id,
            wallId: door.wallId,
            position: posVal,
            width: door.width,
            height: door.height,
            swing: door.swing,
            is_entrance: door.isEntrance ?? false,
            isEntrance: door.isEntrance ?? false,
            visible: door.visible ?? true
          };
        }),
        windows: floor.windows.map((win: Window) => {
          let posVal: any = win.position;
          if (Array.isArray(win.position)) {
            const wall = floor.walls.find(w => w.id === win.wallId);
            if (wall) {
              const dx = wall.endPoint[0] - wall.startPoint[0];
              const dy = wall.endPoint[1] - wall.startPoint[1];
              const lenSq = dx * dx + dy * dy;
              if (lenSq > 0.0001) {
                const px = win.position[0] - wall.startPoint[0];
                const py = win.position[1] - wall.startPoint[1];
                posVal = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
              }
            }
          }
          return {
            windowId: win.id,
            id: win.id,
            wallId: win.wallId,
            position: posVal,
            width: win.width,
            height: win.height,
            sill: win.sillHeight ?? win.sill,
            sillHeight: win.sillHeight ?? win.sill,
            visible: win.visible ?? true
          };
        })
      };
    })
  };
}
