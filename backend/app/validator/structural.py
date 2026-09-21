import math
from app.schema.building import Building
from app.validator.models import ValidationError, Severity

def calculate_polygon_area(polygon: list[list[float]]) -> float:
    if not polygon or len(polygon) < 3:
        return 0.0
    n = len(polygon)
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += polygon[i][0] * polygon[j][1]
        area -= polygon[j][0] * polygon[i][1]
    return abs(area) / 2.0

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

        # 1. Cantilever check
        area_current = sum(
            room.area_sq_ft or calculate_polygon_area(room.polygon)
            for room in floor.rooms
        )
        area_below = sum(
            room.area_sq_ft or calculate_polygon_area(room.polygon)
            for room in floor_below.rooms
        )

        if area_below > 0 and area_current > area_below * 1.2:
            issues.append(ValidationError(
                code='CANTILEVER_EXCEEDED',
                severity=Severity.warning,
                message=f'Floor {floor_idx} area exceeds floor below by > 20%',
                floor_index=floor_idx
            ))

        # 2. Load-bearing wall support check
        walls_below = floor_below.walls

        for wall in floor.walls:
            if wall.is_load_bearing:
                x1, y1 = wall.start[0], wall.start[1]
                x2, y2 = wall.end[0], wall.end[1]
                mx, my = (x1 + x2) / 2.0, (y1 + y2) / 2.0

                supported = False
                for wb in walls_below:
                    wbx1, wby1 = wb.start[0], wb.start[1]
                    wbx2, wby2 = wb.end[0], wb.end[1]
                    wbmx, wbmy = (wbx1 + wbx2) / 2.0, (wby1 + wby2) / 2.0
                    
                    dist = math.hypot(mx - wbmx, my - wbmy)
                    if dist <= 1.0:  # Within 1m tolerance
                        supported = True
                        break

                if not supported:
                    issues.append(ValidationError(
                        code='FLOATING_LOAD_BEARING_WALL',
                        severity=Severity.error,
                        message=f'Load bearing wall {wall.wall_id} has no support below',
                        floor_index=floor_idx,
                        object_id=wall.wall_id
                    ))

    return issues
