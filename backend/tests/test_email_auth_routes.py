import os
import tempfile

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from main import app, get_db_conn, get_email_sender
from database import get_db, init_db, create_user, set_email_verified
from auth import hash_password
from email_service import LoggingEmailSender


@pytest.fixture
def db_path():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    yield path
    os.unlink(path)


@pytest.fixture
def sender():
    return LoggingEmailSender()


@pytest.fixture
def test_app(db_path, sender):
    conn = get_db(db_path)
    init_db(conn)
    app.dependency_overrides[get_db_conn] = lambda: conn
    app.dependency_overrides[get_email_sender] = lambda: sender
    yield app
    app.dependency_overrides.clear()
    conn.close()


@pytest_asyncio.fixture
async def client(test_app):
    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as c:
        yield c


def _last_code(sender):
    # body is e.g. "Your verification code is 123456"
    return sender.sent[-1]["body"].split()[-1]


@pytest.mark.asyncio
async def test_register_sends_code_and_returns_no_token(client, sender):
    resp = await client.post("/api/register", json={
        "email": "new@test.com", "password": "secret1", "invite_code": "caloriessnap2026",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data == {"email": "new@test.com", "verification_required": True}
    assert "token" not in data
    assert len(sender.sent) == 1
    assert len(_last_code(sender)) == 6


@pytest.mark.asyncio
async def test_verify_email_happy_path_returns_token(client, sender):
    await client.post("/api/register", json={
        "email": "v@test.com", "password": "secret1", "invite_code": "caloriessnap2026",
    })
    code = _last_code(sender)
    resp = await client.post("/api/verify-email", json={"email": "v@test.com", "code": code})
    assert resp.status_code == 200
    assert "token" in resp.json()


@pytest.mark.asyncio
async def test_verify_email_wrong_code_400(client, sender):
    await client.post("/api/register", json={
        "email": "w@test.com", "password": "secret1", "invite_code": "caloriessnap2026",
    })
    resp = await client.post("/api/verify-email", json={"email": "w@test.com", "code": "000000"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_verify_email_already_verified_409(client, db_path):
    conn = get_db(db_path)
    uid = create_user(conn, email="av@test.com", password_hash=hash_password("secret1"))
    set_email_verified(conn, uid)
    conn.close()
    resp = await client.post("/api/verify-email", json={"email": "av@test.com", "code": "123456"})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_resend_verification_generic_for_unknown_email(client, sender):
    resp = await client.post("/api/resend-verification", json={"email": "nobody@test.com"})
    assert resp.status_code == 200
    assert "message" in resp.json()
    assert sender.sent == []  # nothing sent for unknown account


@pytest.mark.asyncio
async def test_login_blocked_when_unverified(client, sender):
    await client.post("/api/register", json={
        "email": "lb@test.com", "password": "secret1", "invite_code": "caloriessnap2026",
    })
    resp = await client.post("/api/login", json={"email": "lb@test.com", "password": "secret1"})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "email_not_verified"


@pytest.mark.asyncio
async def test_login_succeeds_after_verification(client, sender):
    await client.post("/api/register", json={
        "email": "ok@test.com", "password": "secret1", "invite_code": "caloriessnap2026",
    })
    code = _last_code(sender)
    await client.post("/api/verify-email", json={"email": "ok@test.com", "code": code})
    resp = await client.post("/api/login", json={"email": "ok@test.com", "password": "secret1"})
    assert resp.status_code == 200
    assert "token" in resp.json()
