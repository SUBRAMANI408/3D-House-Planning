from app.schema.building import Building
from app.validator.models import ValidationResult, ValidationError
from app.validator.connectivity import check_connectivity
from app.validator.collision import check_collisions
from app.validator.structural import check_structural, normalize_slab_geometry
from app.validator.room_sizing import check_room_sizing

def validate_building(building: Building) -> ValidationResult:
    """
    Validates building layout against architectural rules (connectivity, collision, structural, sizing).
    
    API Contract & Pipeline Sequence:
      1. Parsing: Input dict is validated against Pydantic Building model schema.
      2. Normalization (optional): Handled upstream. Populates missing canonical slab_geometry
         on floors while enforcing staircase footprint containment.
      3. Structural & Topological Validation: Enforces slab geometry matching, stair containment,
         and continuous load-bearing wall support.
      4. Sizing & Connectivity Validation: Enforces minimum room areas and door/stair reachability.
      
    Args:
        building: Parsed Pydantic Building model instance.
    """

    issues: list[ValidationError] = []
    issues += check_connectivity(building)
    issues += check_collisions(building)
    issues += check_structural(building)
    issues += check_room_sizing(building)
    return ValidationResult.from_all(issues)
