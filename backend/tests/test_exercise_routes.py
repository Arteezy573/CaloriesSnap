import os
import tempfile

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from auth import create_token, hash_password
from database import create_user, get_db, init_db
from main import app, get_db_conn


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


@pytest.fixture
def auth_header(test_app, db_path):
    conn = get_db(db_path)
    user_id = create_user(conn, email="exercise@test.com", password_hash=hash_password("pw"))
    token = create_token(user_id=user_id, email="exercise@test.com")
    conn.close()
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_log_and_get_exercise(client, auth_header):
    resp = await client.post(
        "/api/exercises",
        json={"date": "2026-06-10", "name": "Running", "duration_min": 30, "calories_burned": 320},
        headers=auth_header,
    )
    assert resp.status_code == 201
    assert resp.json()["calories_burned"] == 320

    resp2 = await client.get("/api/exercises?date=2026-06-10", headers=auth_header)
    assert resp2.status_code == 200
    entries = resp2.json()
    assert len(entries) == 1
    assert entries[0]["name"] == "Running"


@pytest.mark.asyncio
async def test_log_exercise_rejects_negative_calories(client, auth_header):
    resp = await client.post(
        "/api/exercises",
        json={"date": "2026-06-10", "name": "Running", "duration_min": 30, "calories_burned": -5},
        headers=auth_header,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_log_exercise_rejects_blank_name(client, auth_header):
    resp = await client.post(
        "/api/exercises",
        json={"date": "2026-06-10", "name": "", "duration_min": 30, "calories_burned": 100},
        headers=auth_header,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_delete_exercise(client, auth_header):
    resp = await client.post(
        "/api/exercises",
        json={"date": "2026-06-10", "name": "Running", "duration_min": 30, "calories_burned": 320},
        headers=auth_header,
    )
    ex_id = resp.json()["id"]
    resp2 = await client.delete(f"/api/exercises/{ex_id}", headers=auth_header)
    assert resp2.status_code == 200
    resp3 = await client.get("/api/exercises?date=2026-06-10", headers=auth_header)
    assert resp3.json() == []


@pytest.mark.asyncio
async def test_delete_missing_exercise_404(client, auth_header):
    resp = await client.delete("/api/exercises/999", headers=auth_header)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_exercise_requires_auth(client):
    resp = await client.get("/api/exercises?date=2026-06-10")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_summary_reflects_logged_exercise(client, auth_header):
    await client.post(
        "/api/exercises",
        json={"date": "2026-06-10", "name": "Running", "duration_min": 30, "calories_burned": 250},
        headers=auth_header,
    )
    resp = await client.get("/api/summary?date=2026-06-10", headers=auth_header)
    data = resp.json()
    assert data["calories_burned"] == 250
    assert data["exercise_count"] == 1
    assert data["remaining"]["calories"] == 2000 + 250
