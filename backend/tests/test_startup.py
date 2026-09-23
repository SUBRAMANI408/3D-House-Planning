from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_ai_generate_and_validate_integration():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Generate model
        gen_res = await client.post("/api/ai/generate", json={
            "prompt": "3 BHK modern house with 2 floors, master suite, garage, and balcony",
            "buildingType": "house",
            "floorsCount": 2,
            "bedroomsCount": 3,
            "hasGarage": True,
            "hasBalcony": True,
            "style": "Modern Minimalist"
        })
        assert gen_res.status_code == 200
        gen_data = gen_res.json()
        assert "building" in gen_data
        assert gen_data["validation"]["status"] == "passed"

        # Validate generated building data via /api/ai/validate
        val_res = await client.post("/api/ai/validate", json=gen_data["building"])
        assert val_res.status_code == 200
        val_data = val_res.json()
        assert val_data["status"] == "passed"
        errors = [i for i in val_data.get("issues", []) if i.get("severity") == "error"]
        assert len(errors) == 0
