from app.schema.building import Building
from app.validator.models import ValidationError, Severity
from app.validator.structural import calculate_polygon_area

MIN_AREAS = {
    'hall': 80, 'kitchen': 60, 'bedroom': 100,
    'bathroom': 30, 'dining': 80, 'corridor': 20,
    'living': 120, 'study': 60, 'garage': 180,
    'balcony': 20, 'storeroom': 20, 'laundry': 20,
    'shop_unit': 100, 'reception': 60, 'office': 80,
    'meeting_room': 60, 'ward': 120, 'icu': 150,
    'emergency': 200, 'nurse_station': 60, 'operating_room': 300,
    'lockup': 60, 'armory': 80, 'food_court': 400, 'anchor_store': 500
}

def check_room_sizing(building: Building) -> list[ValidationError]:
    issues: list[ValidationError] = []

    for floor in building.floors:
        floor_idx = floor.floor_index
        for room in floor.rooms:
            area = room.area_sq_ft
            if area is None or area == 0:
                area = calculate_polygon_area(room.polygon)

            r_type = room.type.value if hasattr(room.type, 'value') else str(room.type).lower()

            if r_type in MIN_AREAS and area < MIN_AREAS[r_type]:
                issues.append(ValidationError(
                    code='ROOM_TOO_SMALL',
                    severity=Severity.warning,
                    message=f'Room {room.room_id} of type {r_type} is {round(area, 1)} sq ft, minimum is {MIN_AREAS[r_type]}',
                    floor_index=floor_idx,
                    object_id=room.room_id
                ))

    return issues
