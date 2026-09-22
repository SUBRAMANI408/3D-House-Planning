import networkx as nx
from app.schema.building import Building, Room, Wall, Door
from app.validator.models import ValidationError, Severity

def polygons_share_boundary(poly1: list[list[float]], poly2: list[list[float]]) -> bool:
    if not poly1 or not poly2:
        return False
    for i in range(len(poly1)):
        p1a, p1b = poly1[i], poly1[(i + 1) % len(poly1)]
        for j in range(len(poly2)):
            p2a, p2b = poly2[j], poly2[(j + 1) % len(poly2)]
            if abs(p1a[0] - p1b[0]) < 0.15 and abs(p2a[0] - p2b[0]) < 0.15:
                if abs(p1a[0] - p2a[0]) < 0.35:
                    min_y1, max_y1 = sorted([p1a[1], p1b[1]])
                    min_y2, max_y2 = sorted([p2a[1], p2b[1]])
                    if max(min_y1, min_y2) < min(max_y1, max_y2) - 0.1:
                        return True
            elif abs(p1a[1] - p1b[1]) < 0.15 and abs(p2a[1] - p2b[1]) < 0.15:
                if abs(p1a[1] - p2a[1]) < 0.35:
                    min_x1, max_x1 = sorted([p1a[0], p1b[0]])
                    min_x2, max_x2 = sorted([p2a[0], p2b[0]])
                    if max(min_x1, min_x2) < min(max_x1, max_x2) - 0.1:
                        return True
    return False

def is_wall_near_room(wall: Wall, room: Room) -> bool:
    if wall.wall_id in room.wall_ids:
        return True
    if not room.polygon or len(room.polygon) < 3:
        return False
    sp, ep = wall.start, wall.end
    mx, my = (sp[0] + ep[0]) / 2, (sp[1] + ep[1]) / 2
    for i in range(len(room.polygon)):
        p1, p2 = room.polygon[i], room.polygon[(i + 1) % len(room.polygon)]
        min_x, max_x = min(p1[0], p2[0]) - 0.35, max(p1[0], p2[0]) + 0.35
        min_y, max_y = min(p1[1], p2[1]) - 0.35, max(p1[1], p2[1]) + 0.35
        if min_x <= mx <= max_x and min_y <= my <= max_y:
            return True
    return False

def check_connectivity(building: Building) -> list[ValidationError]:
    issues: list[ValidationError] = []

    # 1. Floor level connectivity check
    for floor in building.floors:
        floor_idx = floor.floor_index
        G = nx.Graph()
        has_rooms = False
        entrance_added = False

        room_ids = {room.room_id for room in floor.rooms}

        for room in floor.rooms:
            has_rooms = True
            G.add_node(room.room_id)
            for conn in room.connections:
                to_id = conn.to_room_id or conn.target_room_id
                if to_id in room_ids:
                    G.add_edge(room.room_id, to_id)

        if not has_rooms:
            continue

        walls_by_id = {w.wall_id: w for w in floor.walls}

        # Build wall-to-room mapping
        wall_to_rooms: dict[str, list[str]] = {}
        for room in floor.rooms:
            for w_id in room.wall_ids:
                wall_to_rooms.setdefault(w_id, []).append(room.room_id)

        for w_id, r_list in wall_to_rooms.items():
            if len(r_list) > 1:
                for i in range(len(r_list)):
                    for j in range(i + 1, len(r_list)):
                        G.add_edge(r_list[i], r_list[j])

        # Connect rooms sharing a door on a wall
        for door in floor.doors:
            r_list = wall_to_rooms.get(door.wall_id, [])
            if len(r_list) >= 2:
                for i in range(len(r_list)):
                    for j in range(i + 1, len(r_list)):
                        G.add_edge(r_list[i], r_list[j])

        # Connect rooms sharing polygon boundaries (open-plan layouts)
        for i in range(len(floor.rooms)):
            r1 = floor.rooms[i]
            for j in range(i + 1, len(floor.rooms)):
                r2 = floor.rooms[j]
                if polygons_share_boundary(r1.polygon, r2.polygon):
                    G.add_edge(r1.room_id, r2.room_id)

        # Check entrance connection
        if building.entrance and building.entrance.floor_index == floor_idx:
            G.add_node("entrance")
            entrance_added = True
            e_wall_id = building.entrance.wall_id
            e_door_id = building.entrance.door_id

            for room in floor.rooms:
                w_obj = walls_by_id.get(e_wall_id) if e_wall_id else None
                if (e_wall_id and e_wall_id in room.wall_ids) or \
                   (w_obj and is_wall_near_room(w_obj, room)) or \
                   any(conn.door_id == e_door_id for conn in room.connections if conn.door_id):
                    G.add_edge(room.room_id, "entrance")

        for door in floor.doors:
            if door.is_entrance:
                if "entrance" not in G:
                    G.add_node("entrance")
                    entrance_added = True
                door_wall = walls_by_id.get(door.wall_id)
                for room in floor.rooms:
                    if door.wall_id in room.wall_ids or \
                       (door_wall and is_wall_near_room(door_wall, room)) or \
                       any(conn.door_id == door.door_id for conn in room.connections if conn.door_id):
                        G.add_edge(room.room_id, "entrance")

        if not G.nodes:
            continue

        if not nx.is_connected(G):
            components = list(nx.connected_components(G))
            main_comp = None
            if entrance_added:
                for comp in components:
                    if "entrance" in comp and len(comp) > 1:
                        main_comp = comp
                        break

            if not main_comp:
                if floor_idx == 0:
                    issues.append(ValidationError(
                        code='NO_ENTRANCE_DEFINED',
                        severity=Severity.warning,
                        message=f'No entrance defined for floor {floor_idx}',
                        floor_index=floor_idx
                    ))
                room_comps = [c - {"entrance"} for c in components if c - {"entrance"}]
                main_comp = max(room_comps, key=len) if room_comps else set()

            for comp in components:
                if comp != main_comp:
                    for node_id in comp:
                        if node_id != "entrance":
                            issues.append(ValidationError(
                                code='ROOM_NOT_REACHABLE',
                                severity=Severity.error,
                                message=f'Room {node_id} is not reachable from entrance or main component',
                                object_id=str(node_id),
                                floor_index=floor_idx
                            ))

    # 2. Multi-floor staircase connectivity
    if len(building.floors) > 1:
        sorted_floors = sorted(building.floors, key=lambda f: f.floor_index)

        staircases = []
        for fl in sorted_floors:
            if fl.staircases:
                staircases.extend(fl.staircases)
            if fl.staircase and fl.staircase not in staircases:
                staircases.append(fl.staircase)

        for stair in staircases:
            connected_indices = stair.connects_floors if stair.connects_floors else [getattr(stair, 'start_floor_index', 0), getattr(stair, 'end_floor_index', 1)]
            if len(connected_indices) >= 2:
                for i in range(len(connected_indices) - 1):
                    a, b = connected_indices[i], connected_indices[i+1]
                    if abs(a - b) != 1:
                        issues.append(ValidationError(
                            code='STAIRCASE_NON_ADJACENT',
                            severity=Severity.error,
                            message=f'Staircase {stair.staircase_id or "staircase"} connects non-adjacent floors {a} and {b}',
                            object_id=stair.staircase_id or "staircase"
                        ))

        for i in range(len(sorted_floors) - 1):
            f1_idx = sorted_floors[i].floor_index
            f2_idx = sorted_floors[i+1].floor_index

            connected = False
            for stair in staircases:
                c_floors = stair.connects_floors if stair.connects_floors else [getattr(stair, 'start_floor_index', 0), getattr(stair, 'end_floor_index', 1)]
                if f1_idx in c_floors and f2_idx in c_floors:
                    connected = True
                    break

            if not connected:
                issues.append(ValidationError(
                    code='MISSING_STAIRCASE',
                    severity=Severity.error,
                    message=f'No staircase connecting floors {f1_idx} and {f2_idx}',
                    floor_index=f2_idx
                ))

    return issues
