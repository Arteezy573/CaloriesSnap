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


def create_meal(
    conn: sqlite3.Connection,
    date: str,
    source: str,
    foods: list[dict],
    image_path: Optional[str] = None,
    notes: Optional[str] = None,
) -> int:
    now = datetime.now(timezone.utc).isoformat()
    cursor = conn.execute(
        "INSERT INTO meals (date, time, source, image_path, notes) VALUES (?, ?, ?, ?, ?)",
        (date, now, source, image_path, notes),
    )
    meal_id = cursor.lastrowid
    for food in foods:
        conn.execute(
            "INSERT INTO food_items (meal_id, name, quantity, calories, protein_g, carbs_g, fat_g) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (meal_id, food["name"], food["quantity"], food["calories"], food["protein_g"], food["carbs_g"], food["fat_g"]),
        )
    conn.commit()
    return meal_id


def get_meals_by_date(conn: sqlite3.Connection, date: str) -> list[dict]:
    meals = conn.execute(
        "SELECT * FROM meals WHERE date = ? ORDER BY time", (date,)
    ).fetchall()
    result = []
    for meal in meals:
        meal_dict = dict(meal)
        foods = conn.execute(
            "SELECT * FROM food_items WHERE meal_id = ?", (meal_dict["id"],)
        ).fetchall()
        food_list = [dict(f) for f in foods]
        meal_dict["foods"] = food_list
        meal_dict["total_calories"] = sum(f["calories"] for f in food_list)
        result.append(meal_dict)
    return result


def delete_meal(conn: sqlite3.Connection, meal_id: int) -> bool:
    cursor = conn.execute("DELETE FROM meals WHERE id = ?", (meal_id,))
    conn.commit()
    return cursor.rowcount > 0


def get_daily_summary(conn: sqlite3.Connection, date: str) -> dict:
    goals = get_goals(conn)
    row = conn.execute(
        """
        SELECT
            COALESCE(SUM(fi.calories), 0) as calories,
            COALESCE(SUM(fi.protein_g), 0) as protein_g,
            COALESCE(SUM(fi.carbs_g), 0) as carbs_g,
            COALESCE(SUM(fi.fat_g), 0) as fat_g,
            COUNT(DISTINCT m.id) as meals_count
        FROM meals m
        LEFT JOIN food_items fi ON fi.meal_id = m.id
        WHERE m.date = ?
        """,
        (date,),
    ).fetchone()

    consumed_cal = int(row["calories"])
    consumed_p = round(float(row["protein_g"]), 1)
    consumed_c = round(float(row["carbs_g"]), 1)
    consumed_f = round(float(row["fat_g"]), 1)

    return {
        "date": date,
        "goals": {
            "calories": goals["calories"],
            "protein_g": float(goals["protein_g"]),
            "carbs_g": float(goals["carbs_g"]),
            "fat_g": float(goals["fat_g"]),
        },
        "consumed": {
            "calories": consumed_cal,
            "protein_g": consumed_p,
            "carbs_g": consumed_c,
            "fat_g": consumed_f,
        },
        "remaining": {
            "calories": goals["calories"] - consumed_cal,
            "protein_g": round(float(goals["protein_g"]) - consumed_p, 1),
            "carbs_g": round(float(goals["carbs_g"]) - consumed_c, 1),
            "fat_g": round(float(goals["fat_g"]) - consumed_f, 1),
        },
        "meals_count": int(row["meals_count"]),
    }
