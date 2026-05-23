import os
import tempfile

import pytest

from database import get_db, init_db, create_user


@pytest.fixture
def db():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    conn = get_db(path)
    init_db(conn)
    yield conn
    conn.close()
    os.unlink(path)


@pytest.fixture
def test_user(db):
    user_id = create_user(db, email="test@example.com", password_hash="fakehash")
    return user_id
