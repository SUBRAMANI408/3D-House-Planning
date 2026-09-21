import math
from app.schema.building import Building
from app.validator.models import ValidationError, Severity

def get_aabb(x: float, y: float, w: float, d: float):
    return {
        'xmin': x - w / 2, 'xmax': x + w / 2,
        'ymin': y - d / 2, 'ymax': y + d / 2
    }

def aabb_intersect(b1: dict, b2: dict, margin: float = 0.0) -> bool:
    return not (b1['xmax'] + margin <= b2['xmin'] or
                b1['xmin'] - margin >= b2['xmax'] or
                b1['ymax'] + margin <= b2['ymin'] or
                b1['ymin'] - margin >= b2['ymax'])

def check_collisions(building: Building) -> list[ValidationError]:
    issues: list[ValidationError] = []

    for floor in building.floors:
        floor_idx = floor.floor_index

        for room in floor.rooms:
            furnitures = room.furniture

            # 1. Furniture overlap & minimum clearance
            for i in range(len(furnitures)):
                for j in range(i + 1, len(furnitures)):
                    f1, f2 = furnitures[i], furnitures[j]

                    x1, y1 = f1.position[0], f1.position[1]
                    w1, d1 = f1.bounding_box.w, f1.bounding_box.d
                    x2, y2 = f2.position[0], f2.position[1]
                    w2, d2 = f2.bounding_box.w, f2.bounding_box.d

                    b1 = get_aabb(x1, y1, w1, d1)
                    b2 = get_aabb(x2, y2, w2, d2)

                    if aabb_intersect(b1, b2):
                        issues.append(ValidationError(
                            code='FURNITURE_OVERLAP',
                            severity=Severity.warning,
                            message=f'Furniture {f1.furniture_id} overlaps with {f2.furniture_id}',
                            floor_index=floor_idx,
                            object_id=f1.furniture_id
                        ))
                    elif aabb_intersect(b1, b2, margin=0.6):
                        issues.append(ValidationError(
                            code='INSUFFICIENT_CLEARANCE',
                            severity=Severity.warning,
                            message=f'Clearance between furniture {f1.furniture_id} and {f2.furniture_id} is less than 0.6m',
                            floor_index=floor_idx,
                            object_id=f1.furniture_id
                        ))

        # 2. Door clearance check
        wall_map = {w.wall_id: w for w in floor.walls}
        all_floor_furniture = [f for room in floor.rooms for f in room.furniture]

        for door in floor.doors:
            wall = wall_map.get(door.wall_id)
            if not wall:
                continue

            # Compute door position in 2D
            x1, y1 = wall.start[0], wall.start[1]
            x2, y2 = wall.end[0], wall.end[1]
            t = door.position
            dx = x1 + t * (x2 - x1)
            dy = y1 + t * (y2 - y1)

            door_clearance_box = get_aabb(dx, dy, door.width, door.width)

            for f in all_floor_furniture:
                fx, fy = f.position[0], f.position[1]
                fw, fd = f.bounding_box.w, f.bounding_box.d
                fb = get_aabb(fx, fy, fw, fd)

                if aabb_intersect(door_clearance_box, fb):
                    issues.append(ValidationError(
                        code='DOOR_CLEARANCE_BLOCKED',
                        severity=Severity.warning,
                        message=f'Furniture {f.furniture_id} blocks door {door.door_id}',
                        floor_index=floor_idx,
                        object_id=door.door_id
                    ))

    return issues
