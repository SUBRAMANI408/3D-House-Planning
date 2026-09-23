from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_ai_generate_endpoint_valid_house():
    payload = {
        "prompt": "3 BHK modern minimalist house with 2 floors, master suite, garage, and balcony",
        "buildingType": "house",
        "floorsCount": 2,
        "bedroomsCount": 3,
        "bathroomsCount": 2,
        "hasGarage": True,
        "hasBalcony": True,
        "style": "Modern Minimalist"
    }
    res = client.post("/api/ai/generate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert "building" in data
    assert "validation" in data

    b = data["building"]
    assert b["buildingType"] == "house"
    assert len(b["floors"]) == 2
    assert data["validation"]["status"] == "passed", f"Validation issues: {data['validation']['issues']}"

    # Verify reciprocal room connections exist
    gf_rooms = b["floors"][0]["rooms"]
    living = next((r for r in gf_rooms if r["type"] == "living"), None)
    assert living is not None
    assert len(living["connections"]) > 0

    # Verify doors exist on ground floor
    doors = b["floors"][0]["doors"]
    assert len(doors) >= 3


def test_ai_validate_endpoint_valid_and_invalid():
    # Valid generation payload test
    gen_res = client.post("/api/ai/generate", json={
        "prompt": "2 BHK house with 1 floor",
        "buildingType": "house",
        "floorsCount": 1,
        "bedroomsCount": 2,
        "bathroomsCount": 1,
        "hasGarage": False,
        "hasBalcony": False,
        "style": "Contemporary"
    })
    b = gen_res.json()["building"]

    val_res = client.post("/api/ai/validate", json=b)
    assert val_res.status_code == 200
    assert val_res.json()["status"] == "passed"

    # Modify building to remove staircases connecting multi-floor building (triggers MISSING_STAIRCASE hard error)
    gen_2fl = client.post("/api/ai/generate", json={
        "prompt": "2 BHK house with 2 floors",
        "buildingType": "house",
        "floorsCount": 2,
        "bedroomsCount": 2,
        "bathroomsCount": 1,
        "hasGarage": False,
        "hasBalcony": False,
        "style": "Contemporary"
    })
    b_2fl = gen_2fl.json()["building"]
    b_invalid = dict(b_2fl)
    b_invalid["floors"][0]["staircases"] = []
    b_invalid["floors"][1]["staircases"] = []

    val_invalid_res = client.post("/api/ai/validate", json=b_invalid)
    assert val_invalid_res.status_code == 200
    assert val_invalid_res.json()["status"] == "failed"
