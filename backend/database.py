import sqlite3
from datetime import datetime, timezone
from typing import Optional


def get_db(path: str = "caloriessnap.db") -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY,
            calories INTEGER NOT NULL DEFAULT 2000,
            protein_g INTEGER NOT NULL DEFAULT 150,
            carbs_g INTEGER NOT NULL DEFAULT 250,
            fat_g INTEGER NOT NULL DEFAULT 65,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS meals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            source TEXT NOT NULL CHECK(source IN ('photo', 'manual')),
            image_path TEXT,
            notes TEXT
        );

        CREATE TABLE IF NOT EXISTS food_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            meal_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            calories INTEGER NOT NULL,
            protein_g REAL NOT NULL,
            carbs_g REAL NOT NULL,
            fat_g REAL NOT NULL,
            quantity TEXT NOT NULL,
            FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
        );
    """)
    cursor = conn.execute("SELECT COUNT(*) FROM goals")
    if cursor.fetchone()[0] == 0:
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "INSERT INTO goals (id, calories, protein_g, carbs_g, fat_g, updated_at) VALUES (1, 2000, 150, 250, 65, ?)",
            (now,),
        )
        conn.commit()


def get_goals(conn: sqlite3.Connection) -> dict:
    row = conn.execute("SELECT * FROM goals WHERE id = 1").fetchone()
    return dict(row)


def update_goals(conn: sqlite3.Connection, calories: int, protein_g: int, carbs_g: int, fat_g: int) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "UPDATE goals SET calories=?, protein_g=?, carbs_g=?, fat_g=?, updated_at=? WHERE id=1",
        (calories, protein_g, carbs_g, fat_g, now),
    )
    conn.commit()
    return get_goals(conn)
