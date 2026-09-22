import math
from app.schema.building import Building
from app.validator.models import ValidationError, Severity


def calculate_polygon_area(polygon: list[list[float]]) -> float:
    """Shoelace formula — returns area in m²."""
    if not polygon or len(polygon) < 3:
        return 0.0
    n = len(polygon)
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += polygon[i][0] * polygon[j][1]
        area -= polygon[j][0] * polygon[i][1]
    return abs(area) / 2.0


def _segment_overlap_fraction(ax1: float, ay1: float, ax2: float, ay2: float,
                               bx1: float, by1: float, bx2: float, by2: float,
                               tolerance: float = 0.6) -> float:
    """
    Returns the fraction of wall-A that is within *tolerance* metres of any
    part of wall-B.  Uses a projection-based approach rather than midpoint
    proximity, so short wall segments near long supporting walls are detected.
    """
    # Direction of segment A
    dx_a = ax2 - ax1
    dy_a = ay2 - ay1
    len_a = math.hypot(dx_a, dy_a)
    if len_a < 1e-6:
        return 0.0

    # Sample 5 points evenly along wall-A and check each one's distance to wall-B
    hits = 0
    samples = 5
    for k in range(samples):
        t = k / (samples - 1)
        px = ax1 + t * dx_a
        py = ay1 + t * dy_a

        # Distance from point (px, py) to segment B
        dx_b = bx2 - bx1
        dy_b = by2 - by1
        len_b_sq = dx_b * dx_b + dy_b * dy_b
        if len_b_sq < 1e-6:
            dist = math.hypot(px - bx1, py - by1)
        else:
            tb = max(0.0, min(1.0, ((px - bx1) * dx_b + (py - by1) * dy_b) / len_b_sq))
            closest_x = bx1 + tb * dx_b
            closest_y = by1 + tb * dy_b
            dist = math.hypot(px - closest_x, py - closest_y)

        if dist <= tolerance:
            hits += 1

    return hits / samples


def check_structural(building: Building) -> list[ValidationError]:
    issues: list[ValidationError] = []

    if len(building.floors) <= 1:
        return issues

    floors_by_index = {f.floor_index: f for f in building.floors}

    for floor_idx, floor in floors_by_index.items():
        if floor_idx == 0:
            continue

        floor_below = floors_by_index.get(floor_idx - 1)
        if not floor_below:
            continue

        # 1. Cantilever check — compare actual m² polygon areas
        area_current = sum(
            calculate_polygon_area(room.polygon)
            for room in floor.rooms
            if room.polygon
        )
        area_below = sum(
            calculate_polygon_area(room.polygon)
            for room in floor_below.rooms
            if room.polygon
        )

        if area_below > 0 and area_current > area_below * 1.25:
            issues.append(ValidationError(
                code='CANTILEVER_EXCEEDED',
                severity=Severity.warning,
                message=(
                    f'Floor {floor_idx} footprint ({area_current:.1f} m²) exceeds '
                    f'floor below ({area_below:.1f} m²) by more than 25%'
                ),
                floor_index=floor_idx
            ))

        # 2. Load-bearing wall support check — geometric segment overlap
        walls_below = floor_below.walls

        for wall in floor.walls:
            if not wall.is_load_bearing:
                continue

            ax1, ay1 = wall.start[0], wall.start[1]
            ax2, ay2 = wall.end[0], wall.end[1]

            # Find the best-supporting wall below using segment overlap fraction
            best_overlap = 0.0
            for wb in walls_below:
                bx1, by1 = wb.start[0], wb.start[1]
                bx2, by2 = wb.end[0], wb.end[1]
                overlap = _segment_overlap_fraction(ax1, ay1, ax2, ay2,
                                                    bx1, by1, bx2, by2,
                                                    tolerance=0.6)
                if overlap > best_overlap:
                    best_overlap = overlap
                    if best_overlap >= 0.5:
                        break  # Sufficient support found early

            # Require ≥50% of wall length to be supported
            if best_overlap < 0.5:
                issues.append(ValidationError(
                    code='FLOATING_LOAD_BEARING_WALL',
                    severity=Severity.error,
                    message=(
                        f'Load bearing wall {wall.wall_id} on floor {floor_idx} '
                        f'has only {best_overlap * 100:.0f}% geometric support from floor below '
                        f'(need >=50%)'
                    ),
                    floor_index=floor_idx,
                    object_id=wall.wall_id
                ))

    return issues
