import pytest
from auth import hash_password, verify_password, create_token, decode_token


def test_hash_password_returns_string():
    hashed = hash_password("mypassword")
    assert isinstance(hashed, str)
    assert hashed != "mypassword"


def test_verify_password_correct():
    hashed = hash_password("mypassword")
    assert verify_password("mypassword", hashed) is True


def test_verify_password_wrong():
    hashed = hash_password("mypassword")
    assert verify_password("wrongpassword", hashed) is False


def test_create_token_returns_string():
    token = create_token(user_id=1, email="test@example.com")
    assert isinstance(token, str)


def test_decode_token_roundtrip():
    token = create_token(user_id=42, email="user@test.com")
    payload = decode_token(token)
    assert payload["user_id"] == 42
    assert payload["email"] == "user@test.com"


def test_decode_token_invalid():
    payload = decode_token("garbage.token.here")
    assert payload is None


def test_decode_token_expired():
    import jwt
    from datetime import datetime, timezone, timedelta
    from auth import JWT_SECRET
    expired_payload = {
        "user_id": 1,
        "email": "test@test.com",
        "exp": datetime.now(timezone.utc) - timedelta(hours=1),
    }
    token = jwt.encode(expired_payload, JWT_SECRET, algorithm="HS256")
    assert decode_token(token) is None
