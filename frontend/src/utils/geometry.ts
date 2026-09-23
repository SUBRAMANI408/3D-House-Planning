import * as polygonClipping from 'polygon-clipping';
import type { Building } from '../schema/building.types';

export class GeometryValidationError extends Error {
  floorIndex: number;
  staircaseId?: string;
  constructor(message: string, floorIndex: number, staircaseId?: string) {
    super(message);
    this.name = 'GeometryValidationError';
    this.floorIndex = floorIndex;
    this.staircaseId = staircaseId;
  }
}

/**
 * Computes the canonical structural slab geometry for all floors in a building.
 * @param building The building model to compute slabs for.
 * @returns The same building object, mutated with `slabGeometry` on each floor.
 * @throws GeometryValidationError if a footprint violates structural constraints (e.g. stair outside slab).
 */
export function computeSlabGeometries(building: Building): Building {
  building.floors.forEach((floor, idx) => {
    // 1. Union all room polygons
    const validRooms = floor.rooms.filter(r => r.polygon && r.polygon.length >= 3);
    if (validRooms.length === 0) {
      floor.slabGeometry = [];
      return;
    }

    // Convert to polygon-clipping format (negating Y to Z for Three.js orientation matching)
    // Note: If we do this in the model, maybe we shouldn't negate Y here, but keep native coordinates?
    // Let's keep native 2D coordinates (X, Y) in the canonical model, and let renderer negate Y->Z.
    // So we use native polygon data.
    const polys = validRooms.map(r => [r.polygon.map(p => [p[0], p[1]] as [number, number])]);
    
    let unionPolys: any;
    try {
      if (polys.length > 1) {
        unionPolys = polygonClipping.union(polys[0], ...polys.slice(1));
      } else {
        unionPolys = [polys[0]];
      }
    } catch (e) {
      throw new GeometryValidationError(`Polygon union failed for floor ${floor.index}.`, floor.index);
    }

    // 2. Compute penetrating staircases
    const allStaircases = building.floors.flatMap(f => f.staircases || []);
    const penetratingStaircases = allStaircases.filter(s => 
      (s.startFloorIndex !== undefined && s.startFloorIndex < idx && (s.endFloorIndex === undefined || s.endFloorIndex >= idx)) ||
      (s.startFloorIndex === undefined && idx > 0)
    );

    // 3. Subtract staircases
    for (const stair of penetratingStaircases) {
      let stairPoly: [number, number][] = [];
      
      if (stair.footprint && stair.footprint.length >= 3) {
        stairPoly = stair.footprint.map(p => [p[0], p[1]] as [number, number]);
      } else {
        const sx = stair.position[0];
        const sz = stair.position[1];
        const sw = stair.width ?? 1.2;
        const sl = stair.length ?? 2.6;
        const rot = stair.rotation ?? 0;

        const corners = [
          [-sw / 2, -sl / 2],
          [sw / 2, -sl / 2],
          [sw / 2, sl / 2],
          [-sw / 2, sl / 2]
        ];

        stairPoly = corners.map(c => {
          const x = c[0] * Math.cos(rot) - c[1] * Math.sin(rot);
          const z = c[0] * Math.sin(rot) + c[1] * Math.cos(rot);
          return [sx + x, sz + z] as [number, number];
        });
        stairPoly.push(stairPoly[0]); // Close the loop
      }

      const stairRing: any = [stairPoly];

      try {
        const intersection = polygonClipping.intersection(stairRing, unionPolys);
        if (intersection.length === 0) {
          // Completely outside, ignore
          continue;
        }

        const outsideParts = polygonClipping.difference(stairRing, unionPolys);
        if (outsideParts.length > 0) {
          throw new GeometryValidationError(
            `Staircase ${stair.id || 'unknown'} footprint partially intersects the floor slab boundaries on floor ${floor.index}.`,
            floor.index,
            stair.id
          );
        }

        unionPolys = polygonClipping.difference(unionPolys, stairRing);
      } catch (err) {
        if (err instanceof GeometryValidationError) throw err;
        throw new GeometryValidationError(
          `Failed to subtract stair hole footprint on floor ${floor.index}: ${err}`,
          floor.index,
          stair.id
        );
      }
    }

    // 4. Map back to SlabGeometry schema
    floor.slabGeometry = unionPolys.map((poly: any) => {
      const outerRing = poly[0].map((p: any) => [p[0], p[1]] as [number, number]);
      const innerRings = poly.slice(1).map((ring: any) => ring.map((p: any) => [p[0], p[1]] as [number, number]));
      return { outerRing, innerRings };
    });
  });

  return building;
}
