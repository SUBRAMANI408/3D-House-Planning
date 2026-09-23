from __future__ import annotations

import re
import time
from typing import Any, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.schema.building import Building, Floor, Room, Wall, Door, Window, Staircase, Roof, BuildingType, Entrance, RoomConnection, ConnectionVia
from app.validator import validate_building

router = APIRouter(prefix="/api/ai", tags=["ai"])


class AIGenerateRequest(BaseModel):
    prompt: str = Field(..., json_schema_extra={"example": "3 BHK modern minimalist house with 2 floors, master suite, garage, and balcony"})
    building_type: str = Field("house", alias="buildingType")
    floors_count: int = Field(2, alias="floorsCount")
    bedrooms_count: int = Field(3, alias="bedroomsCount")
    bathrooms_count: int = Field(2, alias="bathroomsCount")
    has_garage: bool = Field(True, alias="hasGarage")
    has_balcony: bool = Field(True, alias="hasBalcony")
    style: str = Field("Modern Minimalist")

    model_config = {"populate_by_name": True}


class AIGenerateResponse(BaseModel):
    building: dict[str, Any]
    validation: dict[str, Any]


def calculate_shoelace_area(polygon: list[list[float]]) -> float:
    if not polygon or len(polygon) < 3:
        return 0.0
    n = len(polygon)
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += polygon[i][0] * polygon[j][1]
        area -= polygon[j][0] * polygon[i][1]
    return abs(area) / 2.0


def parse_prompt(prompt: str) -> dict[str, Any]:
    """Parse key attributes from natural language prompt."""
    p_lower = prompt.lower()
    
    # Check floors count
    floors = 1
    if "2 floor" in p_lower or "2 story" in p_lower or "2-story" in p_lower or "duplex" in p_lower or "two floor" in p_lower:
        floors = 2
    elif "3 floor" in p_lower or "3 story" in p_lower or "3-story" in p_lower or "triplex" in p_lower or "three floor" in p_lower:
        floors = 3

    # Check bedrooms
    bhk_match = re.search(r'(\d+)\s*(bhk|bedroom|bed)', p_lower)
    bedrooms = int(bhk_match.group(1)) if bhk_match else 3

    # Check garage & balcony
    garage = "garage" in p_lower or "carport" in p_lower or "parking" in p_lower
    balcony = "balcony" in p_lower or "terrace" in p_lower or "deck" in p_lower

    return {
        "floors_count": floors,
        "bedrooms_count": bedrooms,
        "has_garage": garage,
        "has_balcony": balcony,
    }


@router.post("/generate", response_model=AIGenerateResponse)
async def generate_ai_building(req: AIGenerateRequest) -> AIGenerateResponse:
    """Generate a valid canonical 3D building layout from natural language input and parametric controls."""
    ts = int(time.time() * 1000)
    building_id = f"ai-house-{ts}"

    # Extract dynamic properties from natural prompt if available
    prompt_parsed = parse_prompt(req.prompt)
    effective_floors = max(req.floors_count, prompt_parsed["floors_count"])
    effective_bedrooms = max(req.bedrooms_count, prompt_parsed["bedrooms_count"])
    effective_garage = req.has_garage or prompt_parsed["has_garage"]
    effective_balcony = req.has_balcony or prompt_parsed["has_balcony"]

    floors_list: list[dict[str, Any]] = []
    gf_width = 15.0 if effective_garage else 11.0

    # ── GROUND FLOOR (Floor 0) ───────────────────────────────────────────────
    liv_poly = [[0.0, 0.0], [6.0, 0.0], [6.0, 5.0], [0.0, 5.0]]
    kit_poly = [[6.0, 0.0], [11.0, 0.0], [11.0, 5.0], [6.0, 5.0]]
    din_poly = [[0.0, 5.0], [6.0, 5.0], [6.0, 9.0], [0.0, 9.0]]
    bath0_poly = [[6.0, 5.0], [9.0, 5.0], [9.0, 7.0], [6.0, 7.0]]
    foyer_poly = [[6.0, 7.0], [9.0, 7.0], [9.0, 9.0], [6.0, 9.0]]

    w0_s1 = f"w0-s1-{ts}"
    w0_e1 = f"w0-e1-{ts}"
    w0_n1 = f"w0-n1-{ts}"
    w0_e2 = f"w0-e2-{ts}"
    w0_n2 = f"w0-n2-{ts}"
    w0_w1 = f"w0-w1-{ts}"
    w0_i1 = f"w0-i1-{ts}"  # x=6, y=0..9
    w0_i2 = f"w0-i2-{ts}"  # y=5, x=0..11
    w0_i3 = f"w0-i3-{ts}"  # y=7, x=6..9
    w0_i4 = f"w0-i4-{ts}"  # x=11, y=0..7 (garage interior wall)

    d0_main = f"d0-main-{ts}"
    d0_kit = f"d0-kit-{ts}"
    d0_bath = f"d0-bath-{ts}"
    d0_din = f"d0-din-{ts}"

    floor0_rooms = [
        {
            "id": f"r-gf-liv-{ts}",
            "name": "Living Room",
            "type": "living",
            "polygon": liv_poly,
            "area": calculate_shoelace_area(liv_poly),
            "areaSqFt": calculate_shoelace_area(liv_poly) * 10.7639,
            "wallIds": [w0_s1, w0_i1, w0_i2, w0_w1],
            "connections": [
                {"toRoomId": f"r-gf-kit-{ts}", "via": "door", "doorId": d0_kit},
                {"toRoomId": f"r-gf-din-{ts}", "via": "door", "doorId": d0_din},
                {"toRoomId": "entrance", "via": "door", "doorId": d0_main},
            ],
            "furniture": [
                {"id": f"f-gf-sofa-{ts}", "type": "sofa_l", "position": [3.0, 0.0, 2.5], "rotation": [0.0, 0.0, 0.0]},
                {"id": f"f-gf-tv-{ts}", "type": "tv_unit", "position": [5.5, 0.0, 2.5], "rotation": [0.0, 270.0, 0.0]},
                {"id": f"f-gf-table-{ts}", "type": "coffee_table", "position": [3.0, 0.0, 1.8], "rotation": [0.0, 0.0, 0.0]},
            ]
        },
        {
            "id": f"r-gf-kit-{ts}",
            "name": "Kitchen",
            "type": "kitchen",
            "polygon": kit_poly,
            "area": calculate_shoelace_area(kit_poly),
            "areaSqFt": calculate_shoelace_area(kit_poly) * 10.7639,
            "wallIds": [w0_s1, w0_i4 if effective_garage else w0_e1, w0_i2, w0_i1],
            "connections": [
                {"toRoomId": f"r-gf-liv-{ts}", "via": "door", "doorId": d0_kit},
            ],
            "furniture": [
                {"id": f"f-gf-counter-{ts}", "type": "kitchen_counter", "position": [9.0, 0.0, 4.4], "rotation": [0.0, 0.0, 0.0]},
                {"id": f"f-gf-fridge-{ts}", "type": "refrigerator", "position": [10.2, 0.0, 1.0], "rotation": [0.0, 270.0, 0.0]}
            ]
        },
        {
            "id": f"r-gf-din-{ts}",
            "name": "Dining Room",
            "type": "dining",
            "polygon": din_poly,
            "area": calculate_shoelace_area(din_poly),
            "areaSqFt": calculate_shoelace_area(din_poly) * 10.7639,
            "wallIds": [w0_i2, w0_i1, w0_n2, w0_w1],
            "connections": [
                {"toRoomId": f"r-gf-liv-{ts}", "via": "door", "doorId": d0_din},
                {"toRoomId": f"r-gf-foyer-{ts}", "via": "opening"},
            ],
            "furniture": [
                {"id": f"f-gf-din-tbl-{ts}", "type": "dining_table", "position": [3.0, 0.0, 7.0], "rotation": [0.0, 0.0, 0.0]}
            ]
        },
        {
            "id": f"r-gf-bath-{ts}",
            "name": "Guest Bathroom",
            "type": "bathroom",
            "polygon": bath0_poly,
            "area": calculate_shoelace_area(bath0_poly),
            "areaSqFt": calculate_shoelace_area(bath0_poly) * 10.7639,
            "wallIds": [w0_i2, w0_e2, w0_i3, w0_i1],
            "connections": [
                {"toRoomId": f"r-gf-foyer-{ts}", "via": "door", "doorId": d0_bath}
            ],
            "furniture": [
                {"id": f"f-gf-toilet-{ts}", "type": "toilet", "position": [7.0, 0.0, 6.0], "rotation": [0.0, 0.0, 0.0]},
                {"id": f"f-gf-sink-{ts}", "type": "sink", "position": [8.2, 0.0, 6.0], "rotation": [0.0, 0.0, 0.0]}
            ]
        },
        {
            "id": f"r-gf-foyer-{ts}",
            "name": "Entrance Foyer",
            "type": "corridor",
            "polygon": foyer_poly,
            "area": calculate_shoelace_area(foyer_poly),
            "areaSqFt": calculate_shoelace_area(foyer_poly) * 10.7639,
            "wallIds": [w0_i3, w0_e2, w0_n1, w0_i1],
            "connections": [
                {"toRoomId": f"r-gf-din-{ts}", "via": "opening"},
                {"toRoomId": f"r-gf-bath-{ts}", "via": "door", "doorId": d0_bath},
                {"toRoomId": "entrance", "via": "door", "doorId": d0_main}
            ],
            "furniture": []
        }
    ]

    if effective_garage:
        gar_poly = [[11.0, 0.0], [15.0, 0.0], [15.0, 7.0], [11.0, 7.0]]
        floor0_rooms.append({
            "id": f"r-gf-gar-{ts}",
            "name": "Garage",
            "type": "garage",
            "polygon": gar_poly,
            "area": calculate_shoelace_area(gar_poly),
            "areaSqFt": calculate_shoelace_area(gar_poly) * 10.7639,
            "wallIds": [w0_s1, w0_e1, w0_n1, w0_i4],
            "connections": [
                {"toRoomId": f"r-gf-kit-{ts}", "via": "door", "doorId": f"d0-gar-{ts}"}
            ],
            "furniture": []
        })

    floor0_walls = [
        {"id": w0_s1, "startPoint": [0.0, 0.0], "endPoint": [gf_width, 0.0], "thickness": 0.25, "height": 3.0, "isExterior": True, "isLoadBearing": True},
        {"id": w0_e1, "startPoint": [gf_width, 0.0], "endPoint": [gf_width, 7.0], "thickness": 0.25, "height": 3.0, "isExterior": True, "isLoadBearing": True},
        {"id": w0_n1, "startPoint": [gf_width, 7.0], "endPoint": [9.0, 7.0], "thickness": 0.25, "height": 3.0, "isExterior": True, "isLoadBearing": True},
        {"id": w0_e2, "startPoint": [9.0, 7.0], "endPoint": [9.0, 9.0], "thickness": 0.25, "height": 3.0, "isExterior": True, "isLoadBearing": True},
        {"id": w0_n2, "startPoint": [9.0, 9.0], "endPoint": [0.0, 9.0], "thickness": 0.25, "height": 3.0, "isExterior": True, "isLoadBearing": True},
        {"id": w0_w1, "startPoint": [0.0, 9.0], "endPoint": [0.0, 0.0], "thickness": 0.25, "height": 3.0, "isExterior": True, "isLoadBearing": True},
        {"id": w0_i1, "startPoint": [6.0, 0.0], "endPoint": [6.0, 9.0], "thickness": 0.15, "height": 3.0, "isExterior": False, "isLoadBearing": True},
        {"id": w0_i2, "startPoint": [0.0, 5.0], "endPoint": [11.0, 5.0], "thickness": 0.15, "height": 3.0, "isExterior": False, "isLoadBearing": True},
        {"id": w0_i3, "startPoint": [6.0, 7.0], "endPoint": [9.0, 7.0], "thickness": 0.15, "height": 3.0, "isExterior": False, "isLoadBearing": False},
    ]
    if effective_garage:
        floor0_walls.append({"id": w0_i4, "startPoint": [11.0, 0.0], "endPoint": [11.0, 7.0], "thickness": 0.15, "height": 3.0, "isExterior": False, "isLoadBearing": True})

    floor0_doors = [
        {"id": d0_main, "wallId": w0_s1, "position": [3.0, 0.0], "width": 1.0, "height": 2.2, "swing": "in-left", "isEntrance": True},
        {"id": d0_kit, "wallId": w0_i1, "position": [6.0, 2.5], "width": 0.9, "height": 2.1, "swing": "in-left"},
        {"id": d0_din, "wallId": w0_i2, "position": [3.0, 5.0], "width": 0.9, "height": 2.1, "swing": "in-left"},
        {"id": d0_bath, "wallId": w0_i3, "position": [7.5, 7.0], "width": 0.8, "height": 2.0, "swing": "in-right"}
    ]
    if effective_garage:
        floor0_doors.append({"id": f"d0-gar-{ts}", "wallId": w0_i4, "position": [11.0, 3.5], "width": 0.9, "height": 2.1, "swing": "in-right"})

    floor0_windows = [
        {"id": f"win0-liv-{ts}", "wallId": w0_s1, "position": [1.5, 0.0], "width": 1.6, "height": 1.4, "sillHeight": 0.8},
        {"id": f"win0-kit-{ts}", "wallId": w0_s1, "position": [8.5, 0.0], "width": 1.4, "height": 1.2, "sillHeight": 0.9},
        {"id": f"win0-din-{ts}", "wallId": w0_w1, "position": [0.0, 7.0], "width": 1.5, "height": 1.2, "sillHeight": 0.9}
    ]

    floor0_stairs = [
        {"id": f"stair0-{ts}", "startFloorIndex": 0, "endFloorIndex": 1, "connectsFloors": [0, 1], "position": [3.2, 5.2], "width": 1.2, "length": 2.6, "type": "straight"}
    ] if effective_floors > 1 else []

    floors_list.append({
        "floorIndex": 0,
        "name": "Ground Floor",
        "elevation": 0.0,
        "floorHeight": 3.0,
        "rooms": floor0_rooms,
        "walls": floor0_walls,
        "doors": floor0_doors,
        "windows": floor0_windows,
        "staircases": floor0_stairs,
        "roof": None
    })

    # ── FIRST FLOOR (Floor 1 if effective_floors >= 2) ───────────────────────
    if effective_floors >= 2:
        mbed_poly = [[0.0, 0.0], [6.0, 0.0], [6.0, 5.0], [0.0, 5.0]]
        mbath_poly = [[6.0, 0.0], [9.0, 0.0], [9.0, 3.0], [6.0, 3.0]]
        bed2_poly = [[0.0, 5.0], [5.0, 5.0], [5.0, 9.0], [0.0, 9.0]]
        bed3_poly = [[5.0, 5.0], [10.0, 5.0], [10.0, 9.0], [5.0, 9.0]]
        lounge_poly = [[6.0, 3.0], [11.0, 3.0], [11.0, 5.0], [6.0, 5.0]]

        w1_s1 = f"w1-s1-{ts}"
        w1_e1 = f"w1-e1-{ts}"
        w1_e2 = f"w1-e2-{ts}"
        w1_n1 = f"w1-n1-{ts}"
        w1_n2 = f"w1-n2-{ts}"
        w1_w1 = f"w1-w1-{ts}"
        w1_i1 = f"w1-i1-{ts}"
        w1_i2 = f"w1-i2-{ts}"
        w1_i3 = f"w1-i3-{ts}"
        w1_i4 = f"w1-i4-{ts}"

        d1_mbed = f"d1-mbed-{ts}"
        d1_mbath = f"d1-mbath-{ts}"
        d1_bed2 = f"d1-bed2-{ts}"
        d1_bed3 = f"d1-bed3-{ts}"

        floor1_rooms = [
            {
                "id": f"r-f1-mbed-{ts}",
                "name": "Master Suite",
                "type": "bedroom",
                "polygon": mbed_poly,
                "area": calculate_shoelace_area(mbed_poly),
                "areaSqFt": calculate_shoelace_area(mbed_poly) * 10.7639,
                "wallIds": [w1_s1, w1_w1, w1_i1, w1_i3],
                "connections": [
                    {"toRoomId": f"r-f1-lounge-{ts}", "via": "door", "doorId": d1_mbed},
                    {"toRoomId": f"r-f1-mbath-{ts}", "via": "door", "doorId": d1_mbath},
                ],
                "furniture": [
                    {"id": f"f-f1-king-{ts}", "type": "bed_king", "position": [3.0, 0.0, 2.0], "rotation": [0.0, 0.0, 0.0]},
                    {"id": f"f-f1-ward-{ts}", "type": "wardrobe", "position": [5.2, 0.0, 4.0], "rotation": [0.0, 270.0, 0.0]}
                ]
            },
            {
                "id": f"r-f1-mbath-{ts}",
                "name": "Ensuite Bathroom",
                "type": "bathroom",
                "polygon": mbath_poly,
                "area": calculate_shoelace_area(mbath_poly),
                "areaSqFt": calculate_shoelace_area(mbath_poly) * 10.7639,
                "wallIds": [w1_s1, w1_i1, w1_i2, w1_e1],
                "connections": [
                    {"toRoomId": f"r-f1-mbed-{ts}", "via": "door", "doorId": d1_mbath}
                ],
                "furniture": [
                    {"id": f"f-f1-tub-{ts}", "type": "bathtub", "position": [7.5, 0.0, 1.5], "rotation": [0.0, 0.0, 0.0]},
                    {"id": f"f-f1-toilet-{ts}", "type": "toilet", "position": [8.2, 0.0, 2.5], "rotation": [0.0, 0.0, 0.0]}
                ]
            },
            {
                "id": f"r-f1-bed2-{ts}",
                "name": "Bedroom 2",
                "type": "bedroom",
                "polygon": bed2_poly,
                "area": calculate_shoelace_area(bed2_poly),
                "areaSqFt": calculate_shoelace_area(bed2_poly) * 10.7639,
                "wallIds": [w1_w1, w1_i3, w1_i4, w1_n2],
                "connections": [
                    {"toRoomId": f"r-f1-lounge-{ts}", "via": "door", "doorId": d1_bed2}
                ],
                "furniture": [
                    {"id": f"f-f1-b2bed-{ts}", "type": "bed_queen", "position": [2.5, 0.0, 7.0], "rotation": [0.0, 0.0, 0.0]}
                ]
            },
            {
                "id": f"r-f1-bed3-{ts}",
                "name": "Bedroom 3" if effective_bedrooms >= 3 else "Study Office",
                "type": "bedroom" if effective_bedrooms >= 3 else "office",
                "polygon": bed3_poly,
                "area": calculate_shoelace_area(bed3_poly),
                "areaSqFt": calculate_shoelace_area(bed3_poly) * 10.7639,
                "wallIds": [w1_i4, w1_i3, w1_n1, w1_n2],
                "connections": [
                    {"toRoomId": f"r-f1-lounge-{ts}", "via": "door", "doorId": d1_bed3}
                ],
                "furniture": [
                    {"id": f"f-f1-b3bed-{ts}", "type": "bed_queen" if effective_bedrooms >= 3 else "desk", "position": [7.5, 0.0, 7.0], "rotation": [0.0, 0.0, 0.0]}
                ]
            },
            {
                "id": f"r-f1-lounge-{ts}",
                "name": "Family Lounge",
                "type": "living",
                "polygon": lounge_poly,
                "area": calculate_shoelace_area(lounge_poly),
                "areaSqFt": calculate_shoelace_area(lounge_poly) * 10.7639,
                "wallIds": [w1_i1, w1_i2, w1_e2, w1_i3],
                "connections": [
                    {"toRoomId": f"r-f1-mbed-{ts}", "via": "door", "doorId": d1_mbed},
                    {"toRoomId": f"r-f1-bed2-{ts}", "via": "door", "doorId": d1_bed2},
                    {"toRoomId": f"r-f1-bed3-{ts}", "via": "door", "doorId": d1_bed3},
                    {"toRoomId": f"stair0-{ts}", "via": "staircase"}
                ],
                "furniture": [
                    {"id": f"f-f1-lsofa-{ts}", "type": "sofa", "position": [8.5, 0.0, 4.0], "rotation": [0.0, 180.0, 0.0]}
                ]
            }
        ]

        if effective_balcony:
            balc_poly = [[9.0, 0.0], [14.0, 0.0], [14.0, 3.0], [9.0, 3.0]]
            floor1_rooms.append({
                "id": f"r-f1-balc-{ts}",
                "name": "Terrace Balcony",
                "type": "balcony",
                "polygon": balc_poly,
                "area": calculate_shoelace_area(balc_poly),
                "areaSqFt": calculate_shoelace_area(balc_poly) * 10.7639,
                "wallIds": [w1_e1, w1_e2, w1_s1],
                "connections": [
                    {"toRoomId": f"r-f1-mbath-{ts}", "via": "door", "doorId": f"d1-balc-{ts}"}
                ],
                "furniture": []
            })

        end_s1 = 14.0 if effective_balcony else 11.0
        floor1_walls = [
            {"id": w1_s1, "startPoint": [0.0, 0.0], "endPoint": [end_s1, 0.0], "thickness": 0.25, "height": 3.0, "isExterior": True, "isLoadBearing": True},
            {"id": w1_e1, "startPoint": [end_s1, 0.0], "endPoint": [end_s1, 3.0], "thickness": 0.25, "height": 3.0, "isExterior": True, "isLoadBearing": False},
            {"id": w1_e2, "startPoint": [end_s1, 3.0], "endPoint": [11.0, 3.0], "thickness": 0.25, "height": 3.0, "isExterior": True, "isLoadBearing": False},
            {"id": w1_n1, "startPoint": [10.0, 5.0], "endPoint": [10.0, 9.0], "thickness": 0.25, "height": 3.0, "isExterior": True, "isLoadBearing": False},
            {"id": w1_n2, "startPoint": [10.0, 9.0], "endPoint": [0.0, 9.0], "thickness": 0.25, "height": 3.0, "isExterior": True, "isLoadBearing": True},
            {"id": w1_w1, "startPoint": [0.0, 9.0], "endPoint": [0.0, 0.0], "thickness": 0.25, "height": 3.0, "isExterior": True, "isLoadBearing": True},
            {"id": w1_i1, "startPoint": [6.0, 0.0], "endPoint": [6.0, 5.0], "thickness": 0.15, "height": 3.0, "isExterior": False, "isLoadBearing": True},
            {"id": w1_i2, "startPoint": [9.0, 0.0], "endPoint": [9.0, 3.0], "thickness": 0.15, "height": 3.0, "isExterior": False, "isLoadBearing": False},
            {"id": w1_i3, "startPoint": [0.0, 5.0], "endPoint": [10.0, 5.0], "thickness": 0.15, "height": 3.0, "isExterior": False, "isLoadBearing": True},
            {"id": w1_i4, "startPoint": [5.0, 5.0], "endPoint": [5.0, 9.0], "thickness": 0.15, "height": 3.0, "isExterior": False, "isLoadBearing": False}
        ]

        floor1_doors = [
            {"id": d1_mbed, "wallId": w1_i1, "position": [6.0, 4.2], "width": 0.9, "height": 2.1, "swing": "in-left"},
            {"id": d1_mbath, "wallId": w1_i2, "position": [9.0, 1.5], "width": 0.8, "height": 2.0, "swing": "in-left"},
            {"id": d1_bed2, "wallId": w1_i3, "position": [2.5, 5.0], "width": 0.9, "height": 2.1, "swing": "in-left"},
            {"id": d1_bed3, "wallId": w1_i3, "position": [7.5, 5.0], "width": 0.9, "height": 2.1, "swing": "in-left"}
        ]
        if effective_balcony:
            floor1_doors.append({"id": f"d1-balc-{ts}", "wallId": w1_e2, "position": [11.0, 3.0], "width": 1.2, "height": 2.2, "swing": "sliding"})

        floor1_windows = [
            {"id": f"win1-mbed-{ts}", "wallId": w1_s1, "position": [3.0, 0.0], "width": 1.8, "height": 1.4, "sillHeight": 0.8},
            {"id": f"win1-bed2-{ts}", "wallId": w1_w1, "position": [0.0, 7.0], "width": 1.5, "height": 1.2, "sillHeight": 0.9},
            {"id": f"win1-bed3-{ts}", "wallId": w1_n2, "position": [7.5, 9.0], "width": 1.5, "height": 1.2, "sillHeight": 0.9}
        ]

        floor1_stairs = [
            {"id": f"stair1-{ts}", "startFloorIndex": 0, "endFloorIndex": 1, "connectsFloors": [0, 1], "position": [2.8, 5.3], "width": 1.2, "length": 2.8, "type": "straight"}
        ]

        floors_list.append({
            "floorIndex": 1,
            "name": "First Floor",
            "elevation": 3.0,
            "floorHeight": 3.0,
            "rooms": floor1_rooms,
            "walls": floor1_walls,
            "doors": floor1_doors,
            "windows": floor1_windows,
            "staircases": floor1_stairs,
            "roof": None
        })

    # Topmost floor roof assignment
    top_floor = floors_list[-1]
    roof_type = "flat" if "minimalist" in req.style.lower() or "contemporary" in req.style.lower() else "pitched_hip"
    top_floor["roof"] = {
        "id": f"roof-ai-{ts}",
        "type": roof_type,
        "height": 0.4 if roof_type == "flat" else 2.2,
        "overhang": 0.6,
        "color": "#475569" if roof_type == "flat" else "#b91c1c",
        "visible": True
    }

    raw_building = {
        "schemaVersion": "1.0",
        "buildingId": building_id,
        "buildingType": req.building_type,
        "name": f"AI {req.style} {effective_bedrooms} BHK ({effective_floors} Story)",
        "units": "metric",
        "entrance": {
            "id": f"entrance-ai-{ts}",
            "floorIndex": 0,
            "wallId": w0_s1,
            "doorId": d0_main,
            "position": [3.0, 0.0],
            "type": "main",
            "facing": "south"
        },
        "metadata": {
            "createdVia": "ai",
            "createdBy": "AI Builder Engine",
            "style": req.style,
            "description": f"AI-generated {effective_bedrooms} BHK, {effective_floors}-story layout with reciprocal connectivity graphs, structural wall definitions, alignment staircases, and eave roofs."
        },
        "floors": floors_list
    }

    # Validate generated model
    try:
        b_obj = Building.model_validate(raw_building)
        val_res = validate_building(b_obj)
        issues = val_res.errors + val_res.warnings
        issues_dict = [iss.model_dump(by_alias=True) for iss in issues]
        has_errors = len(val_res.errors) > 0
        val_status = "failed" if has_errors else "passed"
    except Exception as e:
        val_status = "error"
        issues_dict = [{"code": "SCHEMA_ERROR", "severity": "error", "message": str(e)}]

    validation_result = {
        "status": val_status,
        "issues": issues_dict,
        "totalIssues": len(issues_dict),
    }

    return AIGenerateResponse(building=raw_building, validation=validation_result)


@router.post("/validate")
async def validate_ai_building(building_data: dict[str, Any]) -> dict[str, Any]:
    """Validate any client building json before loading into canvas."""
    try:
        b_obj = Building.model_validate(building_data)
        val_res = validate_building(b_obj)
        issues = val_res.errors + val_res.warnings
        issues_dict = [iss.model_dump(by_alias=True) for iss in issues]
        has_errors = len(val_res.errors) > 0
        return {
            "status": "failed" if has_errors else "passed",
            "issues": issues_dict,
            "totalIssues": len(issues_dict)
        }
    except Exception as e:
        return {
            "status": "error",
            "issues": [{"code": "SCHEMA_ERROR", "severity": "error", "message": str(e)}],
            "totalIssues": 1
        }
