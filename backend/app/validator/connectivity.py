import networkx as nx
from app.schema.building import Building
from app.validator.models import ValidationError, Severity

def polygons_share_boundary(poly1: list[list[float]], poly2: list[list[float]]) -> bool:
    if not poly1 or not poly2:
        return False
    for i in range(len(poly1)):
        p1a, p1b = poly1[i], poly1[(i + 1) % len(poly1)]
        for j in range(len(poly2)):
            p2a, p2b = poly2[j], poly2[(j + 1) % len(poly2)]
            # Vertical segments check
            if abs(p1a[0] - p1b[0]) < 0.05 and abs(p2a[0] - p2b[0]) < 0.05:
                if abs(p1a[0] - p2a[0]) < 0.2:
                    min_y1, max_y1 = sorted([p1a[1], p1b[1]])
                    min_y2, max_y2 = sorted([p2a[1], p2b[1]])
                    if max(min_y1, min_y2) < min(max_y1, max_y2) - 0.05:
                        return True
            # Horizontal segments check
            elif abs(p1a[1] - p1b[1]) < 0.05 and abs(p2a[1] - p2b[1]) < 0.05:
                if abs(p1a[1] - p2a[1]) < 0.2:
                    min_x1, max_x1 = sorted([p1a[0], p1b[0]])
                    min_x2, max_x2 = sorted([p2a[0], p2b[0]])
                    if max(min_x1, min_x2) < min(max_x1, max_x2) - 0.05:
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
                if conn.to_room_id in room_ids:
                    G.add_edge(room.room_id, conn.to_room_id)

        if not has_rooms:
            continue

        # Connect rooms sharing geometric polygon boundaries
        for i in range(len(floor.rooms)):
            r1 = floor.rooms[i]
            for j in range(i + 1, len(floor.rooms)):
                r2 = floor.rooms[j]
                if polygons_share_boundary(r1.polygon, r2.polygon):
                    G.add_edge(r1.room_id, r2.room_id)

        # Connect rooms sharing walls or doors
        wall_to_rooms: dict[str, list[str]] = {}
        for room in floor.rooms:
            for w_id in room.wall_ids:
                wall_to_rooms.setdefault(w_id, []).append(room.room_id)

        for w_id, r_list in wall_to_rooms.items():
            if len(r_list) > 1:
                for i in range(len(r_list)):
                    for j in range(i + 1, len(r_list)):
                        G.add_edge(r_list[i], r_list[j])

        # Connect rooms with doors on shared walls
        door_walls = {d.wall_id for d in floor.doors}
        for door in floor.doors:
            associated_rooms = wall_to_rooms.get(door.wall_id, [])
            if len(associated_rooms) >= 2:
                for i in range(len(associated_rooms)):
                    for j in range(i + 1, len(associated_rooms)):
                        G.add_edge(associated_rooms[i], associated_rooms[j])

        # Check entrance connection
        if building.entrance and building.entrance.floor_index == floor_idx:
            G.add_node("entrance")
            entrance_added = True
            entrance_wall_id = building.entrance.wall_id
            entrance_door_id = building.entrance.door_id
            
            connected_to_entrance = False
            for room in floor.rooms:
                if (entrance_wall_id and entrance_wall_id in room.wall_ids) or \
                   any(conn.door_id == entrance_door_id for conn in room.connections if conn.door_id):
                    G.add_edge(room.room_id, "entrance")
                    connected_to_entrance = True
            
            if not connected_to_entrance and floor.rooms:
                G.add_edge(floor.rooms[0].room_id, "entrance")
                connected_to_entrance = True

        for door in floor.doors:
            if door.is_entrance:
                if "entrance" not in G:
                    G.add_node("entrance")
                    entrance_added = True
                assigned = False
                for room in floor.rooms:
                    if door.wall_id in room.wall_ids or any(conn.door_id == door.door_id for conn in room.connections if conn.door_id):
                        G.add_edge(room.room_id, "entrance")
                        assigned = True
                if not assigned and floor.rooms:
                    G.add_edge(floor.rooms[0].room_id, "entrance")

        if not G.nodes:
            continue

        if not nx.is_connected(G):
            components = list(nx.connected_components(G))
            main_comp = None
            if entrance_added:
                for comp in components:
                    if "entrance" in comp:
                        main_comp = comp
                        break

            if not main_comp:
                issues.append(ValidationError(
                    code='NO_ENTRANCE_DEFINED',
                    severity=Severity.warning,
                    message=f'No entrance defined for floor {floor_idx}',
                    floor_index=floor_idx
                ))
                main_comp = max(components, key=len) if components else set()

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
        
        # Collect all staircases across all floors
        staircases = []
        for fl in sorted_floors:
            if fl.staircases:
                staircases.extend(fl.staircases)
            if fl.staircase and fl.staircase not in staircases:
                staircases.append(fl.staircase)

        # Check for non-adjacent staircase connections
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

        # Ensure every adjacent floor pair is connected by a staircase
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
