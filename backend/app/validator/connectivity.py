import networkx as nx
from app.schema.building import Building
from app.validator.models import ValidationError, Severity

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

        # Check entrance connection
        if building.entrance and building.entrance.floor_index == floor_idx:
            G.add_node("entrance")
            entrance_added = True
            # Find wall/door associated with entrance
            entrance_wall_id = building.entrance.wall_id
            entrance_door_id = building.entrance.door_id
            
            # Find room on this floor containing or matching entrance wall/door
            connected_to_entrance = False
            for room in floor.rooms:
                # If room connects to entrance wall or has door
                for conn in room.connections:
                    if conn.door_id and conn.door_id == entrance_door_id:
                        G.add_edge(room.room_id, "entrance")
                        connected_to_entrance = True
                        break
            
            # If no direct connection found by door_id, connect first room or rooms near entrance wall
            if not connected_to_entrance and floor.rooms:
                G.add_edge(floor.rooms[0].room_id, "entrance")
                connected_to_entrance = True

        # Check for entrance marked on doors
        for door in floor.doors:
            if door.is_entrance:
                if "entrance" not in G:
                    G.add_node("entrance")
                    entrance_added = True
                # Connect entrance to the room associated with this door or door's wall if not already connected
                for room in floor.rooms:
                    for conn in room.connections:
                        if conn.door_id == door.door_id:
                            G.add_edge(room.room_id, "entrance")
                            break
                if G.degree("entrance") == 0 and floor.rooms:
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
            if fl.staircase:
                staircases.append(fl.staircase)

        # Check for non-adjacent staircase connections
        for stair in staircases:
            floors_connected = stair.connects_floors
            if len(floors_connected) >= 2:
                for i in range(len(floors_connected) - 1):
                    a, b = floors_connected[i], floors_connected[i+1]
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
                if f1_idx in stair.connects_floors and f2_idx in stair.connects_floors:
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
