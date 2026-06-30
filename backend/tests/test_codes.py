from datetime import datetime, timezone, timedelta

import pytest

from database import get_db, init_db, create_user, get_latest_email_code, create_email_code
from auth import hash_password
import codes


@pytest.fixture
def db(tmp_path):
    conn = get_db(str(tmp_path / "t.db"))
    init_db(conn)
    yield conn
    conn.close()


@pytest.fixture
def uid(db):
    return create_user(db, email="u@test.com", password_hash="h")


def test_generate_code_is_six_digits():
    for _ in range(50):
        c = codes.generate_code()
        assert len(c) == 6 and c.isdigit()


def test_issue_code_returns_plaintext_and_persists_hash(db, uid):
    code = codes.issue_code(db, uid, "verify")
    assert code is not None and len(code) == 6
    stored = get_latest_email_code(db, uid, "verify")
    assert stored["code_hash"] != code  # stored hashed, not plaintext


def test_verify_code_happy_path(db, uid):
    code = codes.issue_code(db, uid, "verify")
    assert codes.verify_code(db, uid, "verify", code) is True


def test_verify_code_is_single_use(db, uid):
    code = codes.issue_code(db, uid, "verify")
    assert codes.verify_code(db, uid, "verify", code) is True
    assert codes.verify_code(db, uid, "verify", code) is False


def test_verify_code_wrong_increments_attempts(db, uid):
    codes.issue_code(db, uid, "verify")
    assert codes.verify_code(db, uid, "verify", "000000") is False
    assert get_latest_email_code(db, uid, "verify")["attempts"] == 1


def test_verify_code_locks_after_max_attempts(db, uid):
    code = codes.issue_code(db, uid, "verify")
    for _ in range(codes.MAX_ATTEMPTS):
        codes.verify_code(db, uid, "verify", "999999")
    # even the correct code now fails because the code is locked
    assert codes.verify_code(db, uid, "verify", code) is False


def test_verify_code_rejects_expired(db, uid):
    # insert an already-expired code directly
    past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    create_email_code(db, uid, "verify", hash_password("123456"), past)
    assert codes.verify_code(db, uid, "verify", "123456") is False


def test_issue_code_enforces_cooldown(db, uid):
    first = codes.issue_code(db, uid, "verify")
    assert first is not None
    assert codes.issue_code(db, uid, "verify") is None  # within 60s cooldown


def test_verify_code_none_when_no_code(db, uid):
    assert codes.verify_code(db, uid, "verify", "123456") is False
