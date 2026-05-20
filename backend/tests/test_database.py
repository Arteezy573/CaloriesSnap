from database import get_goals, init_db, update_goals
from database import create_meal, delete_meal, get_meals_by_date, get_daily_summary


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


def test_create_meal_and_retrieve(db):
    foods = [
        {"name": "Chicken", "quantity": "200g", "calories": 350, "protein_g": 42.0, "carbs_g": 0.0, "fat_g": 8.5},
        {"name": "Rice", "quantity": "1 cup", "calories": 240, "protein_g": 4.0, "carbs_g": 53.0, "fat_g": 0.4},
    ]
    meal_id = create_meal(db, date="2026-05-19", source="photo", foods=foods, image_path="uploads/test.jpg", notes="lunch")
    assert meal_id > 0

    meals = get_meals_by_date(db, "2026-05-19")
    assert len(meals) == 1
    assert meals[0]["source"] == "photo"
    assert len(meals[0]["foods"]) == 2
    assert meals[0]["total_calories"] == 590


def test_create_manual_meal(db):
    foods = [{"name": "Apple", "quantity": "1 large", "calories": 95, "protein_g": 0.5, "carbs_g": 25.0, "fat_g": 0.3}]
    create_meal(db, date="2026-05-19", source="manual", foods=foods)
    meals = get_meals_by_date(db, "2026-05-19")
    assert len(meals) == 1
    assert meals[0]["source"] == "manual"
    assert meals[0]["image_path"] is None


def test_get_meals_empty_date(db):
    meals = get_meals_by_date(db, "2026-01-01")
    assert meals == []


def test_delete_meal_cascades(db):
    foods = [{"name": "Chicken", "quantity": "200g", "calories": 350, "protein_g": 42.0, "carbs_g": 0.0, "fat_g": 8.5}]
    meal_id = create_meal(db, date="2026-05-19", source="manual", foods=foods)
    deleted = delete_meal(db, meal_id)
    assert deleted is True
    meals = get_meals_by_date(db, "2026-05-19")
    assert len(meals) == 0


def test_delete_nonexistent_meal(db):
    deleted = delete_meal(db, 9999)
    assert deleted is False


def test_daily_summary(db):
    foods1 = [
        {"name": "Chicken", "quantity": "200g", "calories": 350, "protein_g": 42.0, "carbs_g": 0.0, "fat_g": 8.5},
    ]
    foods2 = [
        {"name": "Rice", "quantity": "1 cup", "calories": 240, "protein_g": 4.0, "carbs_g": 53.0, "fat_g": 0.4},
    ]
    create_meal(db, date="2026-05-19", source="photo", foods=foods1)
    create_meal(db, date="2026-05-19", source="manual", foods=foods2)

    summary = get_daily_summary(db, "2026-05-19")
    assert summary["consumed"]["calories"] == 590
    assert summary["consumed"]["protein_g"] == 46.0
    assert summary["consumed"]["carbs_g"] == 53.0
    assert summary["consumed"]["fat_g"] == 8.9
    assert summary["remaining"]["calories"] == 2000 - 590
    assert summary["meals_count"] == 2


def test_daily_summary_no_meals(db):
    summary = get_daily_summary(db, "2026-01-01")
    assert summary["consumed"]["calories"] == 0
    assert summary["meals_count"] == 0
    assert summary["remaining"]["calories"] == 2000
