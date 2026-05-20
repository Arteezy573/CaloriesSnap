from database import get_goals, init_db, update_goals


def test_init_db_creates_tables(db):
    cursor = db.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = {row[0] for row in cursor.fetchall()}
    assert "goals" in tables
    assert "meals" in tables
    assert "food_items" in tables


def test_get_goals_returns_defaults(db):
    goals = get_goals(db)
    assert goals["calories"] == 2000
    assert goals["protein_g"] == 150
    assert goals["carbs_g"] == 250
    assert goals["fat_g"] == 65


def test_update_goals(db):
    update_goals(db, calories=1800, protein_g=120, carbs_g=200, fat_g=50)
    goals = get_goals(db)
    assert goals["calories"] == 1800
    assert goals["protein_g"] == 120
    assert goals["carbs_g"] == 200
    assert goals["fat_g"] == 50


def test_update_goals_replaces_previous(db):
    update_goals(db, calories=1800, protein_g=120, carbs_g=200, fat_g=50)
    update_goals(db, calories=2200, protein_g=180, carbs_g=300, fat_g=70)
    goals = get_goals(db)
    assert goals["calories"] == 2200
