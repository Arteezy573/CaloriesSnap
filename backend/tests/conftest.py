import os
import tempfile

import pytest

from database import get_db, init_db


@pytest.fixture
def db():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    conn = get_db(path)
    init_db(conn)
    yield conn
    conn.close()
    os.unlink(path)
