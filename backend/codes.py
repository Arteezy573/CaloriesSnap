import secrets
from datetime import datetime, timezone, timedelta

from auth import hash_password, verify_password
from database import (
    create_email_code,
    get_latest_email_code,
    increment_email_code_attempts,
    consume_email_code,
)

CODE_TTL_MINUTES = 15
MAX_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 60


def generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts)


def issue_code(conn, user_id: int, purpose: str) -> str | None:
    now = datetime.now(timezone.utc)
    latest = get_latest_email_code(conn, user_id, purpose)
    if latest is not None:
        created = _parse(latest["created_at"])
        if (now - created).total_seconds() < RESEND_COOLDOWN_SECONDS:
            return None
    code = generate_code()
    expires_at = (now + timedelta(minutes=CODE_TTL_MINUTES)).isoformat()
    create_email_code(conn, user_id, purpose, hash_password(code), expires_at)
    return code


def verify_code(conn, user_id: int, purpose: str, code: str) -> bool:
    latest = get_latest_email_code(conn, user_id, purpose)
    if latest is None:
        return False
    if latest["consumed_at"] is not None:
        return False
    if latest["attempts"] >= MAX_ATTEMPTS:
        return False
    if _parse(latest["expires_at"]) < datetime.now(timezone.utc):
        return False
    if not verify_password(code, latest["code_hash"]):
        increment_email_code_attempts(conn, latest["id"])
        return False
    consume_email_code(conn, latest["id"])
    return True
