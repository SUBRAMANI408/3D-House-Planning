from app.schema.building import Building
from app.validator.models import ValidationResult, ValidationError
from app.validator.connectivity import check_connectivity
from app.validator.collision import check_collisions
from app.validator.structural import check_structural
from app.validator.room_sizing import check_room_sizing

def validate_building(building: Building) -> ValidationResult:
    issues: list[ValidationError] = []
    issues += check_connectivity(building)
    issues += check_collisions(building)
    issues += check_structural(building)
    issues += check_room_sizing(building)
    return ValidationResult.from_all(issues)
