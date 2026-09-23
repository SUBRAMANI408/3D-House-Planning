import { describe, it, expect } from 'vitest';
import { computeSlabGeometries, GeometryValidationError } from '../src/utils/geometry';
import type { Building, Floor, Room, Staircase } from '../src/schema/building.types';

describe('Geometry Utils', () => {
  const createBaseBuilding = (): Building => {
    const room: Room = {
      id: 'room1',
      type: 'living',
      polygon: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10]
      ]
    };
    const floor0: Floor = {
      index: 0,
      name: 'Ground',
      height: 3,
      rooms: [room],
      walls: [],
      doors: [],
      windows: [],
      staircases: []
    };
    const floor1: Floor = {
      index: 1,
      name: 'First',
      height: 3,
      rooms: [room],
      walls: [],
      doors: [],
      windows: [],
      staircases: []
    };
    return {
      id: 'b1',
      floors: [floor0, floor1],
      settings: {}
    } as any;
  };

  it('computes union slab when no stairs', () => {
    const building = createBaseBuilding();
    const result = computeSlabGeometries(building);
    expect(result.floors[0].slabGeometry?.length).toBe(1);
    expect(result.floors[0].slabGeometry?.[0].outerRing.length).toBeGreaterThanOrEqual(4);
  });

  it('subtracts fully contained axis-aligned stair', () => {
    const building = createBaseBuilding();
    const stair: Staircase = {
      id: 'st1',
      startFloorIndex: 0,
      endFloorIndex: 1,
      position: [5, 5],
      width: 2,
      length: 2,
      type: 'straight'
    };
    building.floors[0].staircases.push(stair);
    const result = computeSlabGeometries(building);
    // Floor 0 should not have hole (start floor)
    expect(result.floors[0].slabGeometry?.[0].innerRings.length).toBe(0);
    // Floor 1 should have hole
    expect(result.floors[1].slabGeometry?.[0].innerRings.length).toBe(1);
  });

  it('fails when stair is partially outside slab', () => {
    const building = createBaseBuilding();
    const stair: Staircase = {
      id: 'st2',
      startFloorIndex: 0,
      endFloorIndex: 1,
      position: [10, 5], // on edge (x=10)
      width: 2,
      length: 2,
      type: 'straight'
    };
    building.floors[0].staircases.push(stair);
    expect(() => computeSlabGeometries(building)).toThrowError(GeometryValidationError);
  });

  it('ignores stair completely outside slab', () => {
    const building = createBaseBuilding();
    const stair: Staircase = {
      id: 'st3',
      startFloorIndex: 0,
      endFloorIndex: 1,
      position: [20, 20],
      width: 2,
      length: 2,
      type: 'straight'
    };
    building.floors[0].staircases.push(stair);
    const result = computeSlabGeometries(building);
    expect(result.floors[1].slabGeometry?.[0].innerRings.length).toBe(0);
  });

  it('respects rotated staircases', () => {
    const building = createBaseBuilding();
    const stair: Staircase = {
      id: 'st4',
      startFloorIndex: 0,
      endFloorIndex: 1,
      position: [5, 5],
      width: 2,
      length: 8, // 8 length rotated 90 deg (pi/2) fits in 10x10. If not rotated, it would fit too.
      rotation: Math.PI / 2,
      type: 'straight'
    };
    building.floors[0].staircases.push(stair);
    const result = computeSlabGeometries(building);
    expect(result.floors[1].slabGeometry?.[0].innerRings.length).toBe(1);
    
    // Now make it fail by rotating it to cross boundary
    stair.position = [1, 5];
    stair.rotation = 0; // Length 8 at x=1,z=5 means z from 1 to 9 (fits)
    // Actually, position is [1,5]. length is 8, Z goes from 5-4=1 to 5+4=9. Fits.
    // If rotation = pi/2, width=2, length=8, X goes from 1-4=-3 to 1+4=5. Crosses x=0 boundary!
    stair.rotation = Math.PI / 2;
    expect(() => computeSlabGeometries(building)).toThrowError(GeometryValidationError);
  });

  it('uses custom footprint if provided', () => {
    const building = createBaseBuilding();
    const stair: Staircase = {
      id: 'st5',
      startFloorIndex: 0,
      endFloorIndex: 1,
      position: [0, 0], // Ignored
      width: 0, length: 0,
      footprint: [
        [4, 4],
        [6, 4],
        [6, 6],
        [4, 6]
      ],
      type: 'straight'
    };
    building.floors[0].staircases.push(stair);
    const result = computeSlabGeometries(building);
    expect(result.floors[1].slabGeometry?.[0].innerRings.length).toBe(1);
  });
});
