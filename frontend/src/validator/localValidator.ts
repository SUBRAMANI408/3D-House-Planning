import type { Building } from '../schema/building.types';

export interface ValidationReport {
  status: 'passed' | 'failed' | 'error';
  totalIssues: number;
  issues: string[];
}

/**
 * Lightweight client-side preflight validation.
 * 
 * NOTE: This validator does NOT guarantee structural integrity. It only checks basic existence 
 * of geometry arrays and minimal constraints. It DOES NOT validate:
 * - Polygon self-intersection or room overlap
 * - Furniture collisions or stair containment
 * - Full graph connectivity and accessibility
 * - Load-bearing support
 * 
 * For full validation, the building must be passed through the backend `/api/ai/validate` endpoint.
 */
export const validateBuildingLocal = (building: Building): ValidationReport => {
  const issues: string[] = [];

  if (!building.floors || building.floors.length === 0) {
    issues.push('Building must have at least one floor.');
  }

  building.floors.forEach(floor => {
    // Structural constraints
    if (floor.rooms.length === 0) {
      issues.push(`Floor ${floor.index} has no rooms.`);
    }
    
    // Geometry constraints
    floor.rooms.forEach(room => {
      if (!room.polygon || room.polygon.length < 3) {
        issues.push(`Room ${room.id} has invalid polygon geometry.`);
      }
      if ((room.area ?? 0) < 1) {
        issues.push(`Room ${room.id} has unusually small area (${room.area}).`);
      }
    });

    floor.walls.forEach(wall => {
      if (!wall.startPoint || !wall.endPoint || wall.startPoint.length < 2 || wall.endPoint.length < 2) {
        issues.push(`Wall ${wall.id} has invalid coordinates.`);
      }
    });

    // Basic Connectivity constraints (doors)
    const doorCount = floor.doors?.length || 0;
    const openingCount = floor.rooms.reduce((acc, r) => acc + (r.connections?.filter(c => c.via === 'opening').length || 0), 0);
    if (doorCount === 0 && openingCount === 0 && floor.rooms.length > 1) {
      issues.push(`Floor ${floor.index} has multiple rooms but no doors or openings.`);
    }

    // Top floor roof check
    if (floor.index === building.floors.length - 1 && !floor.roof) {
      issues.push(`Top floor ${floor.index} is missing a roof.`);
    }
  });

  return {
    status: issues.length > 0 ? 'failed' : 'passed',
    totalIssues: issues.length,
    issues
  };
};
