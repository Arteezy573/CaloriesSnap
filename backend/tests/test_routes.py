import json
import os
import tempfile
from unittest.mock import MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from main import app, get_db_conn
from database import get_db, init_db


@pytest.fixture
def db_path():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    yield path
    os.unlink(path)


@pytest.fixture
def test_app(db_path):
    conn = get_db(db_path)
    init_db(conn)

    def override_db():
        return conn

    app.dependency_overrides[get_db_conn] = override_db
    yield app
    app.dependency_overrides.clear()
    conn.close()


@pytest_asyncio.fixture
async def client(test_app):
    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_get_goals_defaults(client):
    resp = await client.get("/api/goals")
    assert resp.status_code == 200
    data = resp.json()
    assert data["calories"] == 2000
    assert data["protein_g"] == 150


@pytest.mark.asyncio
async def test_update_goals(client):
    resp = await client.put("/api/goals", json={
        "calories": 1800,
        "protein_g": 120,
        "carbs_g": 200,
        "fat_g": 50,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["calories"] == 1800

    resp2 = await client.get("/api/goals")
    assert resp2.json()["calories"] == 1800


@pytest.mark.asyncio
async def test_update_goals_invalid(client):
    resp = await client.put("/api/goals", json={
        "calories": -100,
        "protein_g": 120,
        "carbs_g": 200,
        "fat_g": 50,
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_and_get_meals(client):
    resp = await client.post("/api/meals", json={
        "source": "manual",
        "foods": [
            {"name": "Apple", "quantity": "1 large", "calories": 95, "protein_g": 0.5, "carbs_g": 25.0, "fat_g": 0.3}
        ],
        "notes": "snack",
    })
    assert resp.status_code == 200
    meal = resp.json()
    assert meal["id"] > 0
    assert meal["total_calories"] == 95

    from datetime import date
    today = date.today().isoformat()
    resp2 = await client.get(f"/api/meals?date={today}")
    assert resp2.status_code == 200
    meals = resp2.json()
    assert len(meals) == 1


@pytest.mark.asyncio
async def test_delete_meal(client):
    resp = await client.post("/api/meals", json={
        "source": "manual",
        "foods": [
            {"name": "Apple", "quantity": "1", "calories": 95, "protein_g": 0.5, "carbs_g": 25.0, "fat_g": 0.3}
        ],
    })
    meal_id = resp.json()["id"]

    del_resp = await client.delete(f"/api/meals/{meal_id}")
    assert del_resp.status_code == 200

    del_resp2 = await client.delete(f"/api/meals/{meal_id}")
    assert del_resp2.status_code == 404


@pytest.mark.asyncio
async def test_daily_summary(client):
    await client.post("/api/meals", json={
        "source": "manual",
        "foods": [
            {"name": "Chicken", "quantity": "200g", "calories": 350, "protein_g": 42.0, "carbs_g": 0.0, "fat_g": 8.5}
        ],
    })
    from datetime import date
    today = date.today().isoformat()
    resp = await client.get(f"/api/summary?date={today}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["consumed"]["calories"] == 350
    assert data["meals_count"] == 1
    assert data["remaining"]["calories"] == 2000 - 350


MOCK_ANALYZE_RESPONSE = json.dumps({
    "foods": [
        {"name": "Banana", "quantity": "1 medium", "calories": 105, "protein_g": 1.3, "carbs_g": 27.0, "fat_g": 0.4}
    ],
    "confidence": "high",
})


@pytest.mark.asyncio
async def test_analyze_text(client):
    mock_client = MagicMock()
    message = MagicMock()
    message.content = [MagicMock(text=MOCK_ANALYZE_RESPONSE)]
    mock_client.messages.create.return_value = message

    with patch("main.anthropic_client", mock_client):
        resp = await client.post("/api/analyze_text", json={"food_description": "1 medium banana"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["foods"]) == 1
    assert data["foods"][0]["name"] == "Banana"
    assert data["total_calories"] == 105
