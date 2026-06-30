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
    user_id = create_user(conn, email="weight@test.com", password_hash=hash_password("pw"))
    token = create_token(user_id=user_id, email="weight@test.com")
    conn.close()
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_log_and_get_weight(client, auth_header):
    resp = await client.post(
        "/api/weight", json={"date": "2026-06-10", "weight_kg": 80.5}, headers=auth_header
    )
    assert resp.status_code == 201
    assert resp.json()["weight_kg"] == 80.5

    resp2 = await client.get(
        "/api/weight?start=2026-06-01&end=2026-06-30", headers=auth_header
    )
    assert resp2.status_code == 200
    logs = resp2.json()
    assert len(logs) == 1
    assert logs[0]["date"] == "2026-06-10"


@pytest.mark.asyncio
async def test_log_weight_upserts(client, auth_header):
    await client.post(
        "/api/weight", json={"date": "2026-06-10", "weight_kg": 80.5}, headers=auth_header
    )
    await client.post(
        "/api/weight", json={"date": "2026-06-10", "weight_kg": 79.0}, headers=auth_header
    )
    resp = await client.get("/api/weight?start=2026-06-01&end=2026-06-30", headers=auth_header)
    logs = resp.json()
    assert len(logs) == 1
    assert logs[0]["weight_kg"] == 79.0


@pytest.mark.asyncio
async def test_log_weight_rejects_nonpositive(client, auth_header):
    resp = await client.post(
        "/api/weight", json={"date": "2026-06-10", "weight_kg": 0}, headers=auth_header
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_delete_weight(client, auth_header):
    await client.post(
        "/api/weight", json={"date": "2026-06-10", "weight_kg": 80.5}, headers=auth_header
    )
    resp = await client.delete("/api/weight/2026-06-10", headers=auth_header)
    assert resp.status_code == 200
    resp2 = await client.get("/api/weight?start=2026-06-01&end=2026-06-30", headers=auth_header)
    assert resp2.json() == []


@pytest.mark.asyncio
async def test_delete_missing_weight_404(client, auth_header):
    resp = await client.delete("/api/weight/2026-06-10", headers=auth_header)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_weight_requires_auth(client):
    resp = await client.get("/api/weight?start=2026-06-01&end=2026-06-30")
    assert resp.status_code == 403
