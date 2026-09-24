import json
from pathlib import Path
import pytest
from app.schema.building import Building
from app.validator.validator import validate_building
from app.validator.structural import normalize_slab_geometry

TEMPLATES_DIR = Path(__file__).parent.parent / "seed_data" / "templates"

@pytest.mark.parametrize("template_path", list(TEMPLATES_DIR.glob("*.json")))
def test_template_roundtrip_and_validation(template_path: Path):
    with open(template_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Parse JSON into Pydantic model
    building = Building.model_validate(data)
    assert building.building_id is not None
    assert len(building.floors) > 0

    # 2. Re-serialize back to JSON dict
    exported_data = building.model_dump(by_alias=True, mode="json")
    
    # 3. Verify round-trip safety (re-parse)
    reparsed_building = Building.model_validate(exported_data)
    assert reparsed_building.building_id == building.building_id
    assert len(reparsed_building.floors) == len(building.floors)

    # 4. Run validators
    normalize_slab_geometry(building)
    result = validate_building(building)
    # Ensure no severe structural/connectivity errors
    assert len(result.errors) == 0, f"Template {template_path.name} failed validation errors: {result.errors}"
