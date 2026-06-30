import sqlite3
from datetime import datetime, timezone
from typing import Optional


def get_db(path: str = "caloriessnap.db") -> sqlite3.Connection:
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            calories INTEGER NOT NULL DEFAULT 2000,
            protein_g INTEGER NOT NULL DEFAULT 150,
            carbs_g INTEGER NOT NULL DEFAULT 250,
            fat_g INTEGER NOT NULL DEFAULT 65,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS meals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            source TEXT NOT NULL CHECK(source IN ('photo', 'manual')),
            image_path TEXT,
            notes TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
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

        CREATE TABLE IF NOT EXISTS saved_meals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS saved_meal_foods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            saved_meal_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            quantity TEXT NOT NULL,
            calories INTEGER NOT NULL,
            protein_g REAL NOT NULL,
            carbs_g REAL NOT NULL,
            fat_g REAL NOT NULL,
            FOREIGN KEY (saved_meal_id) REFERENCES saved_meals(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS api_calls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            endpoint TEXT NOT NULL,
            called_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS weight_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            weight_kg REAL NOT NULL,
            note TEXT,
            created_at TEXT NOT NULL,
            UNIQUE(user_id, date),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS exercises (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            name TEXT NOT NULL,
            duration_min INTEGER NOT NULL,
            calories_burned INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    """)


def create_user(conn: sqlite3.Connection, email: str, password_hash: str) -> int | None:
    now = datetime.now(timezone.utc).isoformat()
    try:
        cursor = conn.execute(
            "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
            (email, password_hash, now),
        )
        conn.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        return None


def get_user_by_email(conn: sqlite3.Connection, email: str) -> dict | None:
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    return dict(row) if row else None


def get_goals(conn: sqlite3.Connection, user_id: int) -> dict:
    row = conn.execute("SELECT * FROM goals WHERE user_id = ?", (user_id,)).fetchone()
    if row is None:
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "INSERT INTO goals (user_id, calories, protein_g, carbs_g, fat_g, updated_at) VALUES (?, 2000, 150, 250, 65, ?)",
            (user_id, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM goals WHERE user_id = ?", (user_id,)).fetchone()
    return dict(row)


def update_goals(conn: sqlite3.Connection, user_id: int, calories: int, protein_g: int, carbs_g: int, fat_g: int) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    existing = conn.execute("SELECT id FROM goals WHERE user_id = ?", (user_id,)).fetchone()
    if existing:
        conn.execute(
            "UPDATE goals SET calories=?, protein_g=?, carbs_g=?, fat_g=?, updated_at=? WHERE user_id=?",
            (calories, protein_g, carbs_g, fat_g, now, user_id),
        )
    else:
        conn.execute(
            "INSERT INTO goals (user_id, calories, protein_g, carbs_g, fat_g, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, calories, protein_g, carbs_g, fat_g, now),
        )
    conn.commit()
    return get_goals(conn, user_id)


def create_meal(
    conn: sqlite3.Connection,
    user_id: int,
    date: str,
    source: str,
    foods: list[dict],
    image_path: Optional[str] = None,
    notes: Optional[str] = None,
) -> int:
    now = datetime.now(timezone.utc).isoformat()
    cursor = conn.execute(
        "INSERT INTO meals (user_id, date, time, source, image_path, notes) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, date, now, source, image_path, notes),
    )
    meal_id = cursor.lastrowid
    for food in foods:
        conn.execute(
            "INSERT INTO food_items (meal_id, name, quantity, calories, protein_g, carbs_g, fat_g) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (meal_id, food["name"], food["quantity"], food["calories"], food["protein_g"], food["carbs_g"], food["fat_g"]),
        )
    conn.commit()
    return meal_id


def get_meals_by_date(conn: sqlite3.Connection, user_id: int, date: str) -> list[dict]:
    meals = conn.execute(
        "SELECT * FROM meals WHERE user_id = ? AND date = ? ORDER BY time", (user_id, date)
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


def get_meal(conn: sqlite3.Connection, user_id: int, meal_id: int) -> dict | None:
    meal = conn.execute(
        "SELECT * FROM meals WHERE id = ? AND user_id = ?", (meal_id, user_id)
    ).fetchone()
    if meal is None:
        return None
    meal_dict = dict(meal)
    foods = conn.execute(
        "SELECT * FROM food_items WHERE meal_id = ?", (meal_id,)
    ).fetchall()
    food_list = [dict(f) for f in foods]
    meal_dict["foods"] = food_list
    meal_dict["total_calories"] = sum(f["calories"] for f in food_list)
    return meal_dict


def update_meal(
    conn: sqlite3.Connection,
    user_id: int,
    meal_id: int,
    foods: list[dict],
    notes: Optional[str] = None,
) -> bool:
    row = conn.execute(
        "SELECT id FROM meals WHERE id = ? AND user_id = ?", (meal_id, user_id)
    ).fetchone()
    if row is None:
        return False
    conn.execute("DELETE FROM food_items WHERE meal_id = ?", (meal_id,))
    for food in foods:
        conn.execute(
            "INSERT INTO food_items (meal_id, name, quantity, calories, protein_g, carbs_g, fat_g) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (meal_id, food["name"], food["quantity"], food["calories"], food["protein_g"], food["carbs_g"], food["fat_g"]),
        )
    if notes is not None:
        conn.execute("UPDATE meals SET notes = ? WHERE id = ?", (notes, meal_id))
    conn.commit()
    return True


def delete_meal(conn: sqlite3.Connection, user_id: int, meal_id: int) -> bool:
    cursor = conn.execute("DELETE FROM meals WHERE id = ? AND user_id = ?", (meal_id, user_id))
    conn.commit()
    return cursor.rowcount > 0


def count_api_calls_today(conn: sqlite3.Connection, user_id: int) -> int:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    row = conn.execute(
        "SELECT COUNT(*) as cnt FROM api_calls WHERE user_id = ? AND called_at >= ?",
        (user_id, today),
    ).fetchone()
    return row["cnt"]


def record_api_call(conn: sqlite3.Connection, user_id: int, endpoint: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO api_calls (user_id, endpoint, called_at) VALUES (?, ?, ?)",
        (user_id, endpoint, now),
    )
    conn.commit()


def create_saved_meal(conn: sqlite3.Connection, user_id: int, name: str, foods: list[dict]) -> int:
    now = datetime.now(timezone.utc).isoformat()
    cursor = conn.execute(
        "INSERT INTO saved_meals (user_id, name, created_at) VALUES (?, ?, ?)",
        (user_id, name, now),
    )
    saved_meal_id = cursor.lastrowid
    for food in foods:
        conn.execute(
            "INSERT INTO saved_meal_foods (saved_meal_id, name, quantity, calories, protein_g, carbs_g, fat_g) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (saved_meal_id, food["name"], food["quantity"], food["calories"], food["protein_g"], food["carbs_g"], food["fat_g"]),
        )
    conn.commit()
    return saved_meal_id


def get_saved_meals(conn: sqlite3.Connection, user_id: int, query: Optional[str] = None) -> list[dict]:
    if query:
        meals = conn.execute(
            "SELECT * FROM saved_meals WHERE user_id = ? AND name LIKE ? ORDER BY created_at DESC",
            (user_id, f"%{query}%"),
        ).fetchall()
    else:
        meals = conn.execute(
            "SELECT * FROM saved_meals WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    result = []
    for meal in meals:
        meal_dict = dict(meal)
        foods = conn.execute(
            "SELECT * FROM saved_meal_foods WHERE saved_meal_id = ?", (meal_dict["id"],)
        ).fetchall()
        meal_dict["foods"] = [dict(f) for f in foods]
        meal_dict["total_calories"] = sum(f["calories"] for f in foods)
        result.append(meal_dict)
    return result


def delete_saved_meal(conn: sqlite3.Connection, user_id: int, saved_meal_id: int) -> bool:
    cursor = conn.execute("DELETE FROM saved_meals WHERE id = ? AND user_id = ?", (saved_meal_id, user_id))
    conn.commit()
    return cursor.rowcount > 0


def get_history(conn: sqlite3.Connection, user_id: int, start: str, end: str) -> list[dict]:
    rows = conn.execute(
        """
        SELECT m.date,
            COALESCE(SUM(fi.calories), 0) as calories,
            COALESCE(SUM(fi.protein_g), 0) as protein_g,
            COALESCE(SUM(fi.carbs_g), 0) as carbs_g,
            COALESCE(SUM(fi.fat_g), 0) as fat_g,
            COUNT(DISTINCT m.id) as meals_count
        FROM meals m
        LEFT JOIN food_items fi ON fi.meal_id = m.id
        WHERE m.user_id = ? AND m.date >= ? AND m.date <= ?
        GROUP BY m.date
        ORDER BY m.date
        """,
        (user_id, start, end),
    ).fetchall()
    return [dict(r) for r in rows]


def log_weight(
    conn: sqlite3.Connection,
    user_id: int,
    date: str,
    weight_kg: float,
    note: Optional[str] = None,
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """
        INSERT INTO weight_logs (user_id, date, weight_kg, note, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, date) DO UPDATE SET weight_kg=excluded.weight_kg, note=excluded.note
        """,
        (user_id, date, weight_kg, note, now),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM weight_logs WHERE user_id = ? AND date = ?", (user_id, date)
    ).fetchone()
    return dict(row)


def get_weight_logs(conn: sqlite3.Connection, user_id: int, start: str, end: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM weight_logs WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date",
        (user_id, start, end),
    ).fetchall()
    return [dict(r) for r in rows]


def get_latest_weight(conn: sqlite3.Connection, user_id: int) -> dict | None:
    row = conn.execute(
        "SELECT * FROM weight_logs WHERE user_id = ? ORDER BY date DESC LIMIT 1", (user_id,)
    ).fetchone()
    return dict(row) if row else None


def delete_weight_log(conn: sqlite3.Connection, user_id: int, date: str) -> bool:
    cursor = conn.execute(
        "DELETE FROM weight_logs WHERE user_id = ? AND date = ?", (user_id, date)
    )
    conn.commit()
    return cursor.rowcount > 0


def create_exercise(
    conn: sqlite3.Connection,
    user_id: int,
    date: str,
    name: str,
    duration_min: int,
    calories_burned: int,
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    cursor = conn.execute(
        "INSERT INTO exercises (user_id, date, name, duration_min, calories_burned, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, date, name, duration_min, calories_burned, now),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM exercises WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return dict(row)


def get_exercises_by_date(conn: sqlite3.Connection, user_id: int, date: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM exercises WHERE user_id = ? AND date = ? ORDER BY created_at",
        (user_id, date),
    ).fetchall()
    return [dict(r) for r in rows]


def delete_exercise(conn: sqlite3.Connection, user_id: int, exercise_id: int) -> bool:
    cursor = conn.execute(
        "DELETE FROM exercises WHERE id = ? AND user_id = ?", (exercise_id, user_id)
    )
    conn.commit()
    return cursor.rowcount > 0


def get_daily_summary(conn: sqlite3.Connection, user_id: int, date: str) -> dict:
    goals = get_goals(conn, user_id)
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
        WHERE m.user_id = ? AND m.date = ?
        """,
        (user_id, date),
    ).fetchone()

    consumed_cal = int(row["calories"])
    consumed_p = round(float(row["protein_g"]), 1)
    consumed_c = round(float(row["carbs_g"]), 1)
    consumed_f = round(float(row["fat_g"]), 1)

    ex_row = conn.execute(
        """
        SELECT
            COALESCE(SUM(calories_burned), 0) as burned,
            COUNT(*) as exercise_count
        FROM exercises
        WHERE user_id = ? AND date = ?
        """,
        (user_id, date),
    ).fetchone()
    calories_burned = int(ex_row["burned"])
    exercise_count = int(ex_row["exercise_count"])

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
            # Exercise calories are "eaten back" into the day's budget (MyFitnessPal model)
            "calories": goals["calories"] - consumed_cal + calories_burned,
            "protein_g": round(float(goals["protein_g"]) - consumed_p, 1),
            "carbs_g": round(float(goals["carbs_g"]) - consumed_c, 1),
            "fat_g": round(float(goals["fat_g"]) - consumed_f, 1),
        },
        "calories_burned": calories_burned,
        "exercise_count": exercise_count,
        "meals_count": int(row["meals_count"]),
    }
