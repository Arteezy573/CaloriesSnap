import os
import tempfile

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
