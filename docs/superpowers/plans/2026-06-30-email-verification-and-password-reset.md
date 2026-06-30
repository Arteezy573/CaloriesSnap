# Email Verification & Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add self-service password reset and hard-gated signup email verification to CaloriesSnap, delivered via 6-digit codes over a Resend-backed email service.

**Architecture:** A swappable `EmailSender` (Resend in prod, a logging/capturing fake in dev & tests) plus a single-use, 15-minute, bcrypt-hashed 6-digit code mechanism backed by a new `email_codes` table. Registration creates unverified users and emails a verify code; login is blocked until verified; forgot/reset password reuses the same code mechanism. The Expo app gains verify/forgot/reset screens.

**Tech Stack:** FastAPI + SQLite (`sqlite3`), bcrypt (via existing `auth.hash_password`/`verify_password`), `httpx` for the Resend HTTP call, Pydantic models; Expo / React Native (TypeScript) for the mobile client. Tests: pytest + httpx `AsyncClient`.

## Global Constraints

- Python: match existing style — plain `sqlite3.Connection` helpers in `database.py` that `conn.commit()` internally; functions take `conn` as first arg.
- All timestamps stored as `datetime.now(timezone.utc).isoformat()` (timezone-aware ISO strings), consistent with existing rows.
- Email is normalized `lower().strip()` everywhere (matches existing `RegisterRequest`/`LoginRequest` validators).
- Password minimum length is **6** (matches existing `RegisterRequest.password`).
- Code is exactly **6 numeric digits**; TTL **15 minutes**; max **5** wrong attempts per code; resend cooldown **60 seconds**.
- Codes are stored only as bcrypt hashes — never plaintext.
- New env vars: `RESEND_API_KEY` (when unset → use `LoggingEmailSender`), `EMAIL_FROM` (default `"CaloriesSnap <noreply@caloriessnap.app>"`).
- `forgot-password` and `resend-verification` always return a generic success body (no account enumeration).
- Run backend tests from the `backend/` directory: `cd backend && python -m pytest`.

---

## File Structure

**Backend (create):**
- `backend/email_service.py` — `EmailSender` interface, `ResendEmailSender`, `LoggingEmailSender`, `build_email_sender()`.
- `backend/codes.py` — `generate_code()`, `issue_code()`, `verify_code()` (orchestration over `database.py` helpers).
- `backend/tests/test_email_service.py`, `backend/tests/test_codes.py`, `backend/tests/test_email_auth_routes.py` — new tests.

**Backend (modify):**
- `backend/database.py` — schema (`users.email_verified` column + migration, `email_codes` table) and code/user helpers.
- `backend/models.py` — new request/response models.
- `backend/main.py` — `get_email_sender` dependency, register/login changes, verify/resend/forgot/reset endpoints.
- `backend/tests/test_routes.py` — update `test_register_success`, `test_login_success`, and `test_user_data` fixture.

**Frontend (create):**
- `mobile/app/(auth)/verify-email.tsx`, `mobile/app/(auth)/forgot-password.tsx`, `mobile/app/(auth)/reset-password.tsx`.

**Frontend (modify):**
- `mobile/services/api.ts` — new client functions + `register()` return type change.
- `mobile/app/(auth)/login.tsx` — "Forgot password?" link + `email_not_verified` routing.
- `mobile/app/(auth)/register.tsx` — route to verify screen after register.

---

## Task 1: Email service abstraction

**Files:**
- Create: `backend/email_service.py`
- Test: `backend/tests/test_email_service.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `class EmailSender` with `send(self, to: str, subject: str, body: str) -> None`.
  - `class LoggingEmailSender(EmailSender)` with attribute `sent: list[dict]` (each `{"to","subject","body"}`).
  - `class ResendEmailSender(EmailSender)` with `__init__(self, api_key: str, sender: str)`.
  - `build_email_sender() -> EmailSender` (returns `ResendEmailSender` if `RESEND_API_KEY` set, else `LoggingEmailSender`).

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_email_service.py
import httpx
import pytest

from email_service import (
    EmailSender,
    LoggingEmailSender,
    ResendEmailSender,
    build_email_sender,
)


def test_logging_sender_captures_messages():
    sender = LoggingEmailSender()
    sender.send("a@b.com", "Subject", "Body")
    assert sender.sent == [{"to": "a@b.com", "subject": "Subject", "body": "Body"}]


def test_resend_sender_posts_expected_payload(monkeypatch):
    captured = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json

        class Resp:
            def raise_for_status(self):
                return None

        return Resp()

    monkeypatch.setattr(httpx, "post", fake_post)
    ResendEmailSender("key123", "From <from@x.com>").send("to@x.com", "Subj", "Hello")

    assert captured["url"] == "https://api.resend.com/emails"
    assert captured["headers"]["Authorization"] == "Bearer key123"
    assert captured["json"] == {
        "from": "From <from@x.com>",
        "to": ["to@x.com"],
        "subject": "Subj",
        "text": "Hello",
    }


def test_build_email_sender_uses_resend_when_key_set(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "abc")
    monkeypatch.setenv("EMAIL_FROM", "X <x@y.com>")
    assert isinstance(build_email_sender(), ResendEmailSender)


def test_build_email_sender_falls_back_to_logging(monkeypatch):
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    assert isinstance(build_email_sender(), LoggingEmailSender)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_email_service.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'email_service'`.

- [ ] **Step 3: Write the implementation**

```python
# backend/email_service.py
import logging
import os

import httpx

logger = logging.getLogger("caloriessnap.email")

RESEND_API_URL = "https://api.resend.com/emails"
DEFAULT_FROM = "CaloriesSnap <noreply@caloriessnap.app>"


class EmailSender:
    def send(self, to: str, subject: str, body: str) -> None:
        raise NotImplementedError


class LoggingEmailSender(EmailSender):
    def __init__(self) -> None:
        self.sent: list[dict] = []

    def send(self, to: str, subject: str, body: str) -> None:
        self.sent.append({"to": to, "subject": subject, "body": body})
        logger.info("EMAIL (not sent) to=%s subject=%s body=%s", to, subject, body)


class ResendEmailSender(EmailSender):
    def __init__(self, api_key: str, sender: str) -> None:
        self.api_key = api_key
        self.sender = sender

    def send(self, to: str, subject: str, body: str) -> None:
        resp = httpx.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={"from": self.sender, "to": [to], "subject": subject, "text": body},
            timeout=10.0,
        )
        resp.raise_for_status()


def build_email_sender() -> EmailSender:
    api_key = os.environ.get("RESEND_API_KEY")
    sender = os.environ.get("EMAIL_FROM", DEFAULT_FROM)
    if api_key:
        return ResendEmailSender(api_key, sender)
    return LoggingEmailSender()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_email_service.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/email_service.py backend/tests/test_email_service.py
git commit -m "feat: add swappable email sender (Resend + logging fallback)"
```

---

## Task 2: Schema — email_verified column + email_codes table + DB helpers

**Files:**
- Modify: `backend/database.py`
- Test: `backend/tests/test_database.py` (append)

**Interfaces:**
- Consumes: existing `get_db`, `init_db`, `create_user`.
- Produces (all in `database.py`):
  - `users.email_verified INTEGER NOT NULL DEFAULT 0` (new column; legacy DBs migrated and existing rows backfilled to `1`).
  - Table `email_codes(id, user_id, purpose, code_hash, expires_at, attempts, consumed_at, created_at)`.
  - `create_email_code(conn, user_id: int, purpose: str, code_hash: str, expires_at: str) -> int`
  - `get_latest_email_code(conn, user_id: int, purpose: str) -> dict | None`
  - `increment_email_code_attempts(conn, code_id: int) -> None`
  - `consume_email_code(conn, code_id: int) -> None`
  - `set_email_verified(conn, user_id: int) -> None`
  - `update_user_password(conn, user_id: int, password_hash: str) -> None`

- [ ] **Step 1: Write the failing tests**

```python
# Append to backend/tests/test_database.py
from datetime import datetime, timezone, timedelta

from database import (
    create_user,
    create_email_code,
    get_latest_email_code,
    increment_email_code_attempts,
    consume_email_code,
    set_email_verified,
    update_user_password,
    get_user_by_email,
)


def _future():
    return (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()


def test_new_user_is_unverified_by_default(db):
    create_user(db, email="new@test.com", password_hash="h")
    user = get_user_by_email(db, "new@test.com")
    assert user["email_verified"] == 0


def test_set_email_verified(db):
    uid = create_user(db, email="v@test.com", password_hash="h")
    set_email_verified(db, uid)
    assert get_user_by_email(db, "v@test.com")["email_verified"] == 1


def test_create_and_get_latest_email_code(db):
    uid = create_user(db, email="c@test.com", password_hash="h")
    create_email_code(db, uid, "verify", "hash1", _future())
    code_id = create_email_code(db, uid, "verify", "hash2", _future())
    latest = get_latest_email_code(db, uid, "verify")
    assert latest["id"] == code_id
    assert latest["code_hash"] == "hash2"
    assert latest["attempts"] == 0
    assert latest["consumed_at"] is None


def test_get_latest_email_code_scoped_by_purpose(db):
    uid = create_user(db, email="p@test.com", password_hash="h")
    create_email_code(db, uid, "verify", "vh", _future())
    create_email_code(db, uid, "reset", "rh", _future())
    assert get_latest_email_code(db, uid, "reset")["code_hash"] == "rh"


def test_increment_and_consume_email_code(db):
    uid = create_user(db, email="i@test.com", password_hash="h")
    code_id = create_email_code(db, uid, "verify", "hash", _future())
    increment_email_code_attempts(db, code_id)
    increment_email_code_attempts(db, code_id)
    assert get_latest_email_code(db, uid, "verify")["attempts"] == 2
    consume_email_code(db, code_id)
    assert get_latest_email_code(db, uid, "verify")["consumed_at"] is not None


def test_update_user_password(db):
    uid = create_user(db, email="pw@test.com", password_hash="old")
    update_user_password(db, uid, "newhash")
    assert get_user_by_email(db, "pw@test.com")["password_hash"] == "newhash"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_database.py -k "email_code or verified or update_user_password or unverified" -v`
Expected: FAIL with `ImportError` / `cannot import name 'create_email_code'`.

- [ ] **Step 3: Add the column to the users CREATE TABLE**

In `backend/database.py`, change the `users` table definition inside `init_db`'s `executescript`:

```python
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email_verified INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
```

- [ ] **Step 4: Add the email_codes table to the same `executescript`**

Add after the `exercises` table block, before the closing `"""`:

```python

        CREATE TABLE IF NOT EXISTS email_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            purpose TEXT NOT NULL CHECK(purpose IN ('verify', 'reset')),
            code_hash TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            consumed_at TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
```

- [ ] **Step 5: Add the migration for legacy DBs**

In `init_db`, just before the final `conn.commit()` (next to the existing `goals` migration):

```python
    # Migration: add email_verified to users created before this column existed,
    # grandfathering all existing users as verified so they are not locked out.
    user_cols = {row["name"] for row in conn.execute("PRAGMA table_info(users)").fetchall()}
    if "email_verified" not in user_cols:
        conn.execute("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0")
        conn.execute("UPDATE users SET email_verified = 1")
```

- [ ] **Step 6: Add the helper functions**

Append to `backend/database.py` (after `get_user_by_email`):

```python
def set_email_verified(conn: sqlite3.Connection, user_id: int) -> None:
    conn.execute("UPDATE users SET email_verified = 1 WHERE id = ?", (user_id,))
    conn.commit()


def update_user_password(conn: sqlite3.Connection, user_id: int, password_hash: str) -> None:
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (password_hash, user_id))
    conn.commit()


def create_email_code(
    conn: sqlite3.Connection,
    user_id: int,
    purpose: str,
    code_hash: str,
    expires_at: str,
) -> int:
    now = datetime.now(timezone.utc).isoformat()
    cursor = conn.execute(
        "INSERT INTO email_codes (user_id, purpose, code_hash, expires_at, attempts, created_at) "
        "VALUES (?, ?, ?, ?, 0, ?)",
        (user_id, purpose, code_hash, expires_at, now),
    )
    conn.commit()
    return cursor.lastrowid


def get_latest_email_code(conn: sqlite3.Connection, user_id: int, purpose: str) -> dict | None:
    row = conn.execute(
        "SELECT * FROM email_codes WHERE user_id = ? AND purpose = ? ORDER BY id DESC LIMIT 1",
        (user_id, purpose),
    ).fetchone()
    return dict(row) if row else None


def increment_email_code_attempts(conn: sqlite3.Connection, code_id: int) -> None:
    conn.execute("UPDATE email_codes SET attempts = attempts + 1 WHERE id = ?", (code_id,))
    conn.commit()


def consume_email_code(conn: sqlite3.Connection, code_id: int) -> None:
    now = datetime.now(timezone.utc).isoformat()
    conn.execute("UPDATE email_codes SET consumed_at = ? WHERE id = ?", (now, code_id))
    conn.commit()
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_database.py -v`
Expected: PASS (new tests pass; existing `test_database.py` tests still pass).

- [ ] **Step 8: Commit**

```bash
git add backend/database.py backend/tests/test_database.py
git commit -m "feat: add email_verified column and email_codes table with helpers"
```

---

## Task 3: Code service (generate / issue / verify)

**Files:**
- Create: `backend/codes.py`
- Test: `backend/tests/test_codes.py`

**Interfaces:**
- Consumes: `auth.hash_password`, `auth.verify_password`; `database.create_email_code`, `get_latest_email_code`, `increment_email_code_attempts`, `consume_email_code`.
- Produces:
  - `generate_code() -> str` — 6-digit zero-padded string.
  - `issue_code(conn, user_id: int, purpose: str) -> str | None` — returns plaintext code, or `None` if blocked by the 60s cooldown.
  - `verify_code(conn, user_id: int, purpose: str, code: str) -> bool` — validates latest code (expiry / single-use / ≤5 attempts), incrementing attempts on a wrong guess and consuming on success.
  - Constants `CODE_TTL_MINUTES = 15`, `MAX_ATTEMPTS = 5`, `RESEND_COOLDOWN_SECONDS = 60`.

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_codes.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_codes.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'codes'`.

- [ ] **Step 3: Write the implementation**

```python
# backend/codes.py
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_codes.py -v`
Expected: PASS (9 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/codes.py backend/tests/test_codes.py
git commit -m "feat: add 6-digit code issue/verify service with expiry and cooldown"
```

---

## Task 4: Pydantic models

**Files:**
- Modify: `backend/models.py`

**Interfaces:**
- Consumes: existing `BaseModel`, `Field`, `field_validator`, `AuthResponse`, `UserResponse`.
- Produces: `VerifyEmailRequest`, `ResendVerificationRequest`, `ForgotPasswordRequest`, `ResetPasswordRequest`, `RegisterPendingResponse`, `GenericMessageResponse`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_models.py — append
from models import (
    VerifyEmailRequest,
    ResendVerificationRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    RegisterPendingResponse,
    GenericMessageResponse,
)
import pytest
from pydantic import ValidationError


def test_verify_email_normalizes_email():
    req = VerifyEmailRequest(email="  Foo@Bar.COM ", code="123456")
    assert req.email == "foo@bar.com"


def test_verify_email_requires_six_digit_code():
    with pytest.raises(ValidationError):
        VerifyEmailRequest(email="a@b.com", code="123")


def test_reset_password_requires_min_length_password():
    with pytest.raises(ValidationError):
        ResetPasswordRequest(email="a@b.com", code="123456", new_password="123")


def test_register_pending_response_shape():
    r = RegisterPendingResponse(email="a@b.com", verification_required=True)
    assert r.verification_required is True


def test_generic_message_response_shape():
    assert GenericMessageResponse(message="ok").message == "ok"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_models.py -k "verify_email or reset_password or register_pending or generic_message" -v`
Expected: FAIL with `ImportError`.

- [ ] **Step 3: Write the implementation**

Append to `backend/models.py`:

```python
class VerifyEmailRequest(BaseModel):
    email: str = Field(min_length=1)
    code: str = Field(min_length=6, max_length=6)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower().strip()


class ResendVerificationRequest(BaseModel):
    email: str = Field(min_length=1)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower().strip()


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=1)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower().strip()


class ResetPasswordRequest(BaseModel):
    email: str = Field(min_length=1)
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=6)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower().strip()


class RegisterPendingResponse(BaseModel):
    email: str
    verification_required: bool


class GenericMessageResponse(BaseModel):
    message: str
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_models.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/models.py backend/tests/test_models.py
git commit -m "feat: add request/response models for verification and reset"
```

---

## Task 5: Registration + verification endpoints (with email-sender dependency)

**Files:**
- Modify: `backend/main.py`
- Test: `backend/tests/test_email_auth_routes.py` (create), `backend/tests/test_routes.py` (update `test_register_success`)

**Interfaces:**
- Consumes: `email_service.build_email_sender`, `codes.issue_code`, `codes.verify_code`, `database.set_email_verified`, `get_user_by_email`, models from Task 4, existing `create_user`, `hash_password`, `create_token`.
- Produces:
  - `get_email_sender()` dependency in `main.py` (returns module-global `_email_sender`).
  - `POST /api/register` → 201 `RegisterPendingResponse`, user created unverified, verify code emailed, **no token**.
  - `POST /api/verify-email` → `AuthResponse` on success; 400 `"Invalid or expired code"` on bad code; 409 `"Email already verified"` if already verified.
  - `POST /api/resend-verification` → `GenericMessageResponse` (generic, cooldown-aware).

- [ ] **Step 1: Add the email-sender dependency and wire it into lifespan**

In `backend/main.py`, add near `_db_conn = None` / `anthropic_client = None`:

```python
_email_sender = None
```

Add the imports (extend existing import groups):

```python
from email_service import build_email_sender
from codes import issue_code, verify_code
from database import set_email_verified, update_user_password  # add to existing database import block
from models import (  # add to existing models import block
    VerifyEmailRequest,
    ResendVerificationRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    RegisterPendingResponse,
    GenericMessageResponse,
)
```

Add the dependency near `get_db_conn`:

```python
def get_email_sender():
    return _email_sender
```

In `lifespan`, set it (extend the `global` and assignment):

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _db_conn, anthropic_client, _email_sender
    db_path = os.environ.get("DB_PATH", "caloriessnap.db")
    _db_conn = get_db(db_path)
    init_db(_db_conn)
    anthropic_client = Anthropic()
    _email_sender = build_email_sender()
    UPLOAD_DIR.mkdir(exist_ok=True)
    yield
    _db_conn.close()
```

- [ ] **Step 2: Write the failing tests**

```python
# backend/tests/test_email_auth_routes.py
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
```

Also update `backend/tests/test_routes.py::test_register_success` to the new contract:

```python
@pytest.mark.asyncio
async def test_register_success(client):
    resp = await client.post("/api/register", json={
        "email": "newuser@test.com",
        "password": "password123",
        "invite_code": "caloriessnap2026",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "newuser@test.com"
    assert data["verification_required"] is True
    assert "token" not in data
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_email_auth_routes.py -v`
Expected: FAIL (`ImportError: cannot import name 'get_email_sender'` or 404/route errors).

- [ ] **Step 4: Rewrite the register endpoint and add verify/resend endpoints**

Replace the existing `register` function and add the two new endpoints below it:

```python
VERIFY_SUBJECT = "Verify your CaloriesSnap email"
RESET_SUBJECT = "Reset your CaloriesSnap password"


@app.post("/api/register", response_model=RegisterPendingResponse, status_code=201)
def register(req: RegisterRequest, conn=Depends(get_db_conn), sender=Depends(get_email_sender)):
    if req.invite_code != INVITE_CODE:
        raise HTTPException(status_code=403, detail="Invalid invite code")
    password_hash = hash_password(req.password)
    user_id = create_user(conn, email=req.email, password_hash=password_hash)
    if user_id is None:
        raise HTTPException(status_code=409, detail="Email already registered")
    code = issue_code(conn, user_id, "verify")
    sender.send(req.email, VERIFY_SUBJECT, f"Your verification code is {code}")
    return {"email": req.email, "verification_required": True}


@app.post("/api/verify-email", response_model=AuthResponse)
def verify_email(req: VerifyEmailRequest, conn=Depends(get_db_conn)):
    user = get_user_by_email(conn, req.email)
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    if user["email_verified"]:
        raise HTTPException(status_code=409, detail="Email already verified")
    if not verify_code(conn, user["id"], "verify", req.code):
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    set_email_verified(conn, user["id"])
    token = create_token(user_id=user["id"], email=user["email"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"]}}


@app.post("/api/resend-verification", response_model=GenericMessageResponse)
def resend_verification(
    req: ResendVerificationRequest, conn=Depends(get_db_conn), sender=Depends(get_email_sender)
):
    user = get_user_by_email(conn, req.email)
    if user is not None and not user["email_verified"]:
        code = issue_code(conn, user["id"], "verify")
        if code is not None:
            sender.send(req.email, VERIFY_SUBJECT, f"Your verification code is {code}")
    return {"message": "If that account needs verification, a code was sent."}
```

> Note: `RegisterPendingResponse` and `AuthResponse` are already imported via the models block (Step 1). Ensure `RegisterPendingResponse` is in the `from models import (...)` list. The old `from models import (... AuthResponse ...)` already exists.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_email_auth_routes.py tests/test_routes.py::test_register_success -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/main.py backend/tests/test_email_auth_routes.py backend/tests/test_routes.py
git commit -m "feat: gate registration behind email verification with code endpoints"
```

---

## Task 6: Login verification gate

**Files:**
- Modify: `backend/main.py`
- Test: `backend/tests/test_email_auth_routes.py` (append), `backend/tests/test_routes.py` (update `test_user_data` fixture + `test_login_success`)

**Interfaces:**
- Consumes: `issue_code`, `get_email_sender`, existing login logic.
- Produces: `POST /api/login` raises **403** `detail="email_not_verified"` when the password is correct but the user is unverified (and emails a fresh verify code, cooldown permitting). Verified users unchanged.

- [ ] **Step 1: Update the `test_user_data` fixture and `test_login_success` in test_routes.py**

The fixture's user must be verified so existing authenticated-route tests and the login test keep working:

```python
@pytest.fixture
def test_user_data(test_app, db_path):
    conn = get_db(db_path)
    password_hash = hash_password("testpassword")
    user_id = create_user(conn, email="existing@test.com", password_hash=password_hash)
    set_email_verified(conn, user_id)
    token = create_token(user_id=user_id, email="existing@test.com")
    conn.close()
    return {"user_id": user_id, "token": token, "email": "existing@test.com"}
```

Add the import at the top of `test_routes.py`:

```python
from database import get_db, init_db, create_user, set_email_verified
```

(`test_login_success` itself needs no change once the fixture marks the user verified.)

- [ ] **Step 2: Write the failing test (append to test_email_auth_routes.py)**

```python
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_email_auth_routes.py -k "login" -v`
Expected: `test_login_blocked_when_unverified` FAILS (currently returns 200).

- [ ] **Step 4: Update the login endpoint**

Replace the `login` function:

```python
@app.post("/api/login", response_model=AuthResponse)
def login(req: LoginRequest, conn=Depends(get_db_conn), sender=Depends(get_email_sender)):
    user = get_user_by_email(conn, req.email)
    if user is None or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user["email_verified"]:
        code = issue_code(conn, user["id"], "verify")
        if code is not None:
            sender.send(req.email, VERIFY_SUBJECT, f"Your verification code is {code}")
        raise HTTPException(status_code=403, detail="email_not_verified")
    token = create_token(user_id=user["id"], email=user["email"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"]}}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_email_auth_routes.py tests/test_routes.py -v`
Expected: PASS (all route tests, including the updated login/register ones).

- [ ] **Step 6: Commit**

```bash
git add backend/main.py backend/tests/test_email_auth_routes.py backend/tests/test_routes.py
git commit -m "feat: block login until email is verified"
```

---

## Task 7: Password reset endpoints

**Files:**
- Modify: `backend/main.py`
- Test: `backend/tests/test_email_auth_routes.py` (append)

**Interfaces:**
- Consumes: `issue_code`, `verify_code`, `update_user_password`, `get_email_sender`, models from Task 4.
- Produces:
  - `POST /api/forgot-password` → `GenericMessageResponse` (generic; emails a reset code only to verified, existing users).
  - `POST /api/reset-password` → `GenericMessageResponse`; 400 on bad/expired code; updates `password_hash` on success.

- [ ] **Step 1: Write the failing tests (append to test_email_auth_routes.py)**

```python
async def _make_verified_user(client, sender, email="reset@test.com", password="secret1"):
    await client.post("/api/register", json={
        "email": email, "password": password, "invite_code": "caloriessnap2026",
    })
    code = _last_code(sender)
    await client.post("/api/verify-email", json={"email": email, "code": code})


@pytest.mark.asyncio
async def test_forgot_password_generic_for_unknown_email(client, sender):
    resp = await client.post("/api/forgot-password", json={"email": "ghost@test.com"})
    assert resp.status_code == 200
    assert "message" in resp.json()
    assert sender.sent == []


@pytest.mark.asyncio
async def test_reset_password_happy_path(client, sender):
    await _make_verified_user(client, sender)
    await client.post("/api/forgot-password", json={"email": "reset@test.com"})
    code = _last_code(sender)
    resp = await client.post("/api/reset-password", json={
        "email": "reset@test.com", "code": code, "new_password": "brandnew1",
    })
    assert resp.status_code == 200
    # new password works, old one does not
    ok = await client.post("/api/login", json={"email": "reset@test.com", "password": "brandnew1"})
    assert ok.status_code == 200
    bad = await client.post("/api/login", json={"email": "reset@test.com", "password": "secret1"})
    assert bad.status_code == 401


@pytest.mark.asyncio
async def test_reset_password_wrong_code_400(client, sender):
    await _make_verified_user(client, sender, email="r2@test.com")
    await client.post("/api/forgot-password", json={"email": "r2@test.com"})
    resp = await client.post("/api/reset-password", json={
        "email": "r2@test.com", "code": "000000", "new_password": "brandnew1",
    })
    assert resp.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_email_auth_routes.py -k "reset or forgot" -v`
Expected: FAIL (404 — routes not defined).

- [ ] **Step 3: Add the endpoints**

Add to `backend/main.py` (after `resend_verification`):

```python
@app.post("/api/forgot-password", response_model=GenericMessageResponse)
def forgot_password(
    req: ForgotPasswordRequest, conn=Depends(get_db_conn), sender=Depends(get_email_sender)
):
    user = get_user_by_email(conn, req.email)
    if user is not None and user["email_verified"]:
        code = issue_code(conn, user["id"], "reset")
        if code is not None:
            sender.send(req.email, RESET_SUBJECT, f"Your password reset code is {code}")
    return {"message": "If that email exists, a code was sent."}


@app.post("/api/reset-password", response_model=GenericMessageResponse)
def reset_password(req: ResetPasswordRequest, conn=Depends(get_db_conn)):
    user = get_user_by_email(conn, req.email)
    if user is None or not verify_code(conn, user["id"], "reset", req.code):
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    update_user_password(conn, user["id"], hash_password(req.new_password))
    return {"message": "Password updated."}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_email_auth_routes.py -v`
Expected: PASS.

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && python -m pytest`
Expected: PASS (entire suite green).

- [ ] **Step 6: Commit**

```bash
git add backend/main.py backend/tests/test_email_auth_routes.py
git commit -m "feat: add forgot-password and reset-password endpoints"
```

---

## Task 8: Frontend API client

**Files:**
- Modify: `mobile/services/api.ts`

**Interfaces:**
- Consumes: existing `API_BASE_URL`.
- Produces (exact signatures later screens rely on):
  - `register(email, password, inviteCode): Promise<{ email: string; verification_required: boolean }>` (return type changed; no longer `AuthResponse`).
  - `verifyEmail(email: string, code: string): Promise<AuthResponse>`
  - `resendVerification(email: string): Promise<{ message: string }>`
  - `forgotPassword(email: string): Promise<{ message: string }>`
  - `resetPassword(email: string, code: string, newPassword: string): Promise<{ message: string }>`

> All five use a direct `fetch` (NOT the shared `request()` helper) because `request()` treats 403 as a session-expired event and clears the token; these pre-auth endpoints must surface 403/400 to the caller.

- [ ] **Step 1: Change `register()` return type and body**

Replace the existing `register` function in `mobile/services/api.ts`:

```ts
export async function register(
  email: string,
  password: string,
  inviteCode: string
): Promise<{ email: string; verification_required: boolean }> {
  const resp = await fetch(`${API_BASE_URL}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, invite_code: inviteCode }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status}: ${text}`);
  }
  return resp.json();
}
```

- [ ] **Step 2: Add the four new functions**

Add directly after the `login` function:

```ts
export async function verifyEmail(email: string, code: string): Promise<AuthResponse> {
  const resp = await fetch(`${API_BASE_URL}/api/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status}: ${text}`);
  }
  return resp.json();
}

export async function resendVerification(email: string): Promise<{ message: string }> {
  const resp = await fetch(`${API_BASE_URL}/api/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status}: ${text}`);
  }
  return resp.json();
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const resp = await fetch(`${API_BASE_URL}/api/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status}: ${text}`);
  }
  return resp.json();
}

export async function resetPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<{ message: string }> {
  const resp = await fetch(`${API_BASE_URL}/api/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, new_password: newPassword }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status}: ${text}`);
  }
  return resp.json();
}
```

- [ ] **Step 3: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: No errors. (If `register()` callers break, they are fixed in Task 9.)

- [ ] **Step 4: Commit**

```bash
git add mobile/services/api.ts
git commit -m "feat: add verify/resend/forgot/reset API client functions"
```

---

## Task 9: Verify-email screen + register/login wiring

**Files:**
- Create: `mobile/app/(auth)/verify-email.tsx`
- Modify: `mobile/app/(auth)/register.tsx`, `mobile/app/(auth)/login.tsx`

**Interfaces:**
- Consumes: `verifyEmail`, `resendVerification`, `register` (new return type) from `services/api`; `setToken`, `notifyAuthChange` from `services/auth`; `PENDING_ONBOARDING_KEY` from `../_layout`.
- Produces: a `/(auth)/verify-email` route accepting an `email` param.

- [ ] **Step 1: Create the verify-email screen**

```tsx
// mobile/app/(auth)/verify-email.tsx
import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { verifyEmail, resendVerification } from "../../services/api";
import { setToken, notifyAuthChange } from "../../services/auth";
import { PENDING_ONBOARDING_KEY } from "../_layout";
import { colors, spacing, type } from "../../theme";

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleVerify() {
    if (code.length !== 6) {
      Alert.alert("Error", "Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    try {
      const result = await verifyEmail(String(email), code);
      await setToken(result.token);
      await AsyncStorage.setItem(PENDING_ONBOARDING_KEY, "1");
      notifyAuthChange(true);
    } catch (e: any) {
      const msg = e.message.includes("409")
        ? "This email is already verified. Please log in."
        : "Invalid or expired code. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    try {
      await resendVerification(String(email));
      setCooldown(60);
      Alert.alert("Sent", "A new code is on its way if your account needs verification.");
    } catch {
      Alert.alert("Error", "Could not resend the code. Please try again.");
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.content}>
        <Text style={styles.logo}>📧</Text>
        <Text style={[type.largeTitle, styles.title]}>Verify your email</Text>
        <Text style={[type.footnote, styles.subtitle]}>Enter the 6-digit code we sent to {email}</Text>

        <Input placeholder="123456" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoCapitalize="none" autoCorrect={false} />

        <Button title="Verify" onPress={handleVerify} loading={loading} style={{ marginTop: spacing.s }} />

        <TouchableOpacity onPress={handleResend} disabled={cooldown > 0} style={{ marginTop: spacing.xl }}>
          <Text style={styles.link}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : <Text style={styles.linkBold}>Resend code</Text>}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: "center", padding: spacing.xl },
  logo: { fontSize: 56, textAlign: "center", marginBottom: spacing.s },
  title: { textAlign: "center" },
  subtitle: { textAlign: "center", marginTop: 4, marginBottom: spacing.xxl },
  link: { color: colors.textSecondary, textAlign: "center", fontSize: 14 },
  linkBold: { color: colors.accent, fontWeight: "700" },
});
```

- [ ] **Step 2: Update register.tsx to route to verify after register**

Replace the body of `handleRegister`'s `try` block in `mobile/app/(auth)/register.tsx`:

```tsx
    setLoading(true);
    try {
      await register(email.trim(), password, inviteCode.trim());
      router.push({ pathname: "/(auth)/verify-email", params: { email: email.trim() } });
    } catch (e: any) {
      const msg = e.message.includes("409")
        ? "An account with this email already exists."
        : e.message.includes("403")
        ? "Invalid invite code."
        : "Registration failed. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
```

Remove the now-unused imports in register.tsx: delete the `AsyncStorage` import line, the `setToken` import (keep `notifyAuthChange` only if still used — it is no longer used here, so change the line to import nothing from auth and delete it), and the `PENDING_ONBOARDING_KEY` import. Concretely, delete these three lines:

```tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setToken, notifyAuthChange } from "../../services/auth";
import { PENDING_ONBOARDING_KEY } from "../_layout";
```

- [ ] **Step 3: Update login.tsx to route unverified users to verify**

In `mobile/app/(auth)/login.tsx`, replace the `catch` block in `handleLogin`:

```tsx
    } catch (e: any) {
      if (e.message.includes("email_not_verified")) {
        router.push({ pathname: "/(auth)/verify-email", params: { email: email.trim() } });
        return;
      }
      const msg = e.message.includes("401") ? "Invalid email or password." : "Login failed. Please try again.";
      Alert.alert("Error", msg);
    } finally {
```

> Note: `login()` in `api.ts` throws `Error("${status}: ${body}")`, and the 403 body is `{"detail":"email_not_verified"}`, so `e.message.includes("email_not_verified")` matches.

- [ ] **Step 4: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Manual verification**

Start the backend (`cd backend && uvicorn main:app` — with `RESEND_API_KEY` unset so codes are logged) and the Expo app. Verify:
1. Register a new account → app navigates to the Verify screen; the backend log prints `EMAIL (not sent) ... Your verification code is NNNNNN`.
2. Enter the wrong code → "Invalid or expired code" alert.
3. Enter the logged code → app enters the main experience (onboarding shows, since `PENDING_ONBOARDING_KEY` is set).
4. Log out, log in with the same account before verifying a fresh account → an unverified login routes to the Verify screen.

- [ ] **Step 6: Commit**

```bash
git add "mobile/app/(auth)/verify-email.tsx" "mobile/app/(auth)/register.tsx" "mobile/app/(auth)/login.tsx"
git commit -m "feat: add verify-email screen and wire register/login routing"
```

---

## Task 10: Forgot-password + reset-password screens

**Files:**
- Create: `mobile/app/(auth)/forgot-password.tsx`, `mobile/app/(auth)/reset-password.tsx`
- Modify: `mobile/app/(auth)/login.tsx` (add "Forgot password?" link)

**Interfaces:**
- Consumes: `forgotPassword`, `resetPassword` from `services/api`.
- Produces: routes `/(auth)/forgot-password` and `/(auth)/reset-password` (the latter takes an `email` param).

- [ ] **Step 1: Create the forgot-password screen**

```tsx
// mobile/app/(auth)/forgot-password.tsx
import { useState } from "react";
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { forgotPassword } from "../../services/api";
import { colors, spacing, type } from "../../theme";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email.");
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      router.push({ pathname: "/(auth)/reset-password", params: { email: email.trim() } });
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.content}>
        <Text style={styles.logo}>🔑</Text>
        <Text style={[type.largeTitle, styles.title]}>Forgot password</Text>
        <Text style={[type.footnote, styles.subtitle]}>Enter your email and we'll send a reset code.</Text>

        <Input placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

        <Button title="Send reset code" onPress={handleSubmit} loading={loading} style={{ marginTop: spacing.s }} />

        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.xl }}>
          <Text style={styles.link}>
            Remembered it? <Text style={styles.linkBold}>Back to log in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: "center", padding: spacing.xl },
  logo: { fontSize: 56, textAlign: "center", marginBottom: spacing.s },
  title: { textAlign: "center" },
  subtitle: { textAlign: "center", marginTop: 4, marginBottom: spacing.xxl },
  link: { color: colors.textSecondary, textAlign: "center", fontSize: 14 },
  linkBold: { color: colors.accent, fontWeight: "700" },
});
```

- [ ] **Step 2: Create the reset-password screen**

```tsx
// mobile/app/(auth)/reset-password.tsx
import { useState } from "react";
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { resetPassword } from "../../services/api";
import { colors, spacing, type } from "../../theme";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (code.length !== 6) {
      Alert.alert("Error", "Enter the 6-digit code from your email.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(String(email), code, password);
      Alert.alert("Success", "Your password has been updated. Please log in.");
      router.replace("/(auth)/login");
    } catch {
      Alert.alert("Error", "Invalid or expired code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.content}>
        <Text style={styles.logo}>🔒</Text>
        <Text style={[type.largeTitle, styles.title]}>Reset password</Text>
        <Text style={[type.footnote, styles.subtitle]}>Enter the code sent to {email} and a new password.</Text>

        <Input placeholder="123456" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoCapitalize="none" autoCorrect={false} />
        <Input placeholder="New password" value={password} onChangeText={setPassword} secureTextEntry />
        <Input placeholder="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

        <Button title="Update password" onPress={handleSubmit} loading={loading} style={{ marginTop: spacing.s }} />

        <TouchableOpacity onPress={() => router.replace("/(auth)/login")} style={{ marginTop: spacing.xl }}>
          <Text style={styles.link}>
            <Text style={styles.linkBold}>Back to log in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: "center", padding: spacing.xl },
  logo: { fontSize: 56, textAlign: "center", marginBottom: spacing.s },
  title: { textAlign: "center" },
  subtitle: { textAlign: "center", marginTop: 4, marginBottom: spacing.xxl },
  link: { color: colors.textSecondary, textAlign: "center", fontSize: 14 },
  linkBold: { color: colors.accent, fontWeight: "700" },
});
```

- [ ] **Step 3: Add the "Forgot password?" link to login.tsx**

In `mobile/app/(auth)/login.tsx`, add a link below the Log In button and above the existing "Don't have an account?" link:

```tsx
        <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")} style={{ marginTop: spacing.l }}>
          <Text style={styles.link}>
            <Text style={styles.linkBold}>Forgot password?</Text>
          </Text>
        </TouchableOpacity>
```

> If `spacing.l` does not exist in `theme.ts`, use `spacing.m` (verify available keys in `mobile/theme.ts` before editing).

- [ ] **Step 4: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Manual verification**

With backend running (`RESEND_API_KEY` unset):
1. From Login, tap "Forgot password?" → Forgot screen.
2. Enter a verified account's email → navigates to Reset screen; backend log prints the reset code.
3. Enter the code + a new password → "Password updated" → returns to Login.
4. Log in with the new password → success. Old password → "Invalid email or password".
5. Entering an unknown email on the Forgot screen still navigates forward (generic, no enumeration) but no code is logged.

- [ ] **Step 6: Commit**

```bash
git add "mobile/app/(auth)/forgot-password.tsx" "mobile/app/(auth)/reset-password.tsx" "mobile/app/(auth)/login.tsx"
git commit -m "feat: add forgot-password and reset-password screens"
```

---

## Final verification

- [ ] **Run the full backend test suite**

Run: `cd backend && python -m pytest`
Expected: All tests pass.

- [ ] **Typecheck the mobile app**

Run: `cd mobile && npx tsc --noEmit`
Expected: No errors.

- [ ] **Update `.env.example` / docs (if present)**

Add `RESEND_API_KEY=` and `EMAIL_FROM=` to any backend env template (e.g. `backend/.env.example`) if one exists, with a note that an unset `RESEND_API_KEY` logs codes instead of sending. Skip if no such file exists.
