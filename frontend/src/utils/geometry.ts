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
 * @returns A new building object, deeply cloned using structuredClone, without mutating the input.
 * @throws GeometryValidationError if a footprint violates structural constraints (e.g. stair outside slab).
 */
export function computeSlabGeometries(building: Building): Building {
  // Deep clone to ensure transactional updates using structuredClone
  const newBuilding: Building = structuredClone(building);
  
  // Staging map to hold computed geometries before applying
  const stagingMap = new Map<number, any[]>();

  newBuilding.floors.forEach((floor, idx) => {
    // 1. Union all room polygons
    const validRooms = floor.rooms.filter(r => r.polygon && r.polygon.length >= 3);
    if (validRooms.length === 0) {
      stagingMap.set(idx, []);
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
    } catch {
      throw new GeometryValidationError(`Polygon union failed for floor ${floor.index}.`, floor.index);
    }

    // 2. Compute penetrating staircases
    // Convention: Staircase cutouts are created on the destination floors (upper floors).
    // The source floor (startFloorIndex) does NOT have a hole.
    const allStaircases = newBuilding.floors.flatMap(f => f.staircases || []);
    const penetratingStaircases = allStaircases.filter(s => 
      (s.startFloorIndex !== undefined && s.startFloorIndex < idx && (s.endFloorIndex === undefined || s.endFloorIndex >= idx)) ||
      (s.startFloorIndex === undefined && idx > 0)
    );

    // 3. Subtract staircases
    for (const stair of penetratingStaircases) {
      let stairPoly: [number, number][] = [];
      
      if (stair.footprint && stair.footprint.length >= 3) {
        // Validate custom footprint
        const first = stair.footprint[0];
        const last = stair.footprint[stair.footprint.length - 1];
        let fp = stair.footprint;
        if (first[0] !== last[0] || first[1] !== last[1]) {
           fp = [...fp, first]; // close the polygon
        }
        
        // Calculate area and check self-intersection / closure
        let area = 0;
        for (let i = 0; i < fp.length - 1; i++) {
          area += fp[i][0] * fp[i + 1][1] - fp[i + 1][0] * fp[i][1];
        }
        
        // Ensure orientation is consistent (polygon-clipping prefers counter-clockwise outer rings)
        // A positive area calculation normally indicates CCW if Y is up.
        if (Math.abs(area / 2) < 0.1) {
          throw new GeometryValidationError(
            `Staircase ${stair.id || 'unknown'} has invalid footprint area on floor ${floor.index}.`,
            floor.index,
            stair.id
          );
        }
        
        stairPoly = fp.map(p => [p[0], p[1]] as [number, number]);
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

    // 4. Map back to SlabGeometry schema into staging
    stagingMap.set(idx, unionPolys.map((poly: any) => {
      const outerRing = poly[0].map((p: any) => [p[0], p[1]] as [number, number]);
      const innerRings = poly.slice(1).map((ring: any) => ring.map((p: any) => [p[0], p[1]] as [number, number]));
      return { outerRing, innerRings };
    }));
  });

  // 5. Apply staging map to clone since all floors succeeded
  newBuilding.floors.forEach((floor, idx) => {
    floor.slabGeometry = stagingMap.get(idx) || [];
  });

  return newBuilding;
}
