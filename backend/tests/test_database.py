from database import (
    create_meal,
    create_user,
    delete_meal,
    get_daily_summary,
    get_goals,
    get_meals_by_date,
    get_user_by_email,
    init_db,
    update_goals,
)


def test_init_db_creates_tables(db):
    cursor = db.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = {row[0] for row in cursor.fetchall()}
    assert "users" in tables
    assert "goals" in tables
    assert "meals" in tables
    assert "food_items" in tables


def test_get_goals_returns_defaults(db, test_user):
    goals = get_goals(db, test_user)
    assert goals["calories"] == 2000
    assert goals["protein_g"] == 150
    assert goals["carbs_g"] == 250
    assert goals["fat_g"] == 65


def test_update_goals(db, test_user):
    update_goals(db, test_user, calories=1800, protein_g=120, carbs_g=200, fat_g=50)
    goals = get_goals(db, test_user)
    assert goals["calories"] == 1800
    assert goals["protein_g"] == 120
    assert goals["carbs_g"] == 200
    assert goals["fat_g"] == 50


def test_update_goals_replaces_previous(db, test_user):
    update_goals(db, test_user, calories=1800, protein_g=120, carbs_g=200, fat_g=50)
    update_goals(db, test_user, calories=2200, protein_g=180, carbs_g=300, fat_g=70)
    goals = get_goals(db, test_user)
    assert goals["calories"] == 2200


def test_create_meal_and_retrieve(db, test_user):
    foods = [
        {"name": "Chicken", "quantity": "200g", "calories": 350, "protein_g": 42.0, "carbs_g": 0.0, "fat_g": 8.5},
        {"name": "Rice", "quantity": "1 cup", "calories": 240, "protein_g": 4.0, "carbs_g": 53.0, "fat_g": 0.4},
    ]
    meal_id = create_meal(db, test_user, date="2026-05-19", source="photo", foods=foods, image_path="uploads/test.jpg", notes="lunch")
    assert meal_id > 0

    meals = get_meals_by_date(db, test_user, "2026-05-19")
    assert len(meals) == 1
    assert meals[0]["source"] == "photo"
    assert len(meals[0]["foods"]) == 2
    assert meals[0]["total_calories"] == 590


def test_create_manual_meal(db, test_user):
    foods = [{"name": "Apple", "quantity": "1 large", "calories": 95, "protein_g": 0.5, "carbs_g": 25.0, "fat_g": 0.3}]
    create_meal(db, test_user, date="2026-05-19", source="manual", foods=foods)
    meals = get_meals_by_date(db, test_user, "2026-05-19")
    assert len(meals) == 1
    assert meals[0]["source"] == "manual"
    assert meals[0]["image_path"] is None


def test_get_meals_empty_date(db, test_user):
    meals = get_meals_by_date(db, test_user, "2026-01-01")
    assert meals == []


def test_delete_meal_cascades(db, test_user):
    foods = [{"name": "Chicken", "quantity": "200g", "calories": 350, "protein_g": 42.0, "carbs_g": 0.0, "fat_g": 8.5}]
    meal_id = create_meal(db, test_user, date="2026-05-19", source="manual", foods=foods)
    deleted = delete_meal(db, test_user, meal_id)
    assert deleted is True
    meals = get_meals_by_date(db, test_user, "2026-05-19")
    assert len(meals) == 0


def test_delete_nonexistent_meal(db, test_user):
    deleted = delete_meal(db, test_user, 9999)
    assert deleted is False


def test_delete_meal_wrong_user(db, test_user):
    foods = [{"name": "Apple", "quantity": "1", "calories": 95, "protein_g": 0.5, "carbs_g": 25.0, "fat_g": 0.3}]
    meal_id = create_meal(db, test_user, date="2026-05-19", source="manual", foods=foods)
    other_user = create_user(db, email="other@example.com", password_hash="fakehash")
    deleted = delete_meal(db, other_user, meal_id)
    assert deleted is False


def test_daily_summary(db, test_user):
    foods1 = [
        {"name": "Chicken", "quantity": "200g", "calories": 350, "protein_g": 42.0, "carbs_g": 0.0, "fat_g": 8.5},
    ]
    foods2 = [
        {"name": "Rice", "quantity": "1 cup", "calories": 240, "protein_g": 4.0, "carbs_g": 53.0, "fat_g": 0.4},
    ]
    create_meal(db, test_user, date="2026-05-19", source="photo", foods=foods1)
    create_meal(db, test_user, date="2026-05-19", source="manual", foods=foods2)

    summary = get_daily_summary(db, test_user, "2026-05-19")
    assert summary["consumed"]["calories"] == 590
    assert summary["consumed"]["protein_g"] == 46.0
    assert summary["consumed"]["carbs_g"] == 53.0
    assert summary["consumed"]["fat_g"] == 8.9
    assert summary["remaining"]["calories"] == 2000 - 590
    assert summary["meals_count"] == 2


def test_daily_summary_no_meals(db, test_user):
    summary = get_daily_summary(db, test_user, "2026-01-01")
    assert summary["consumed"]["calories"] == 0
    assert summary["meals_count"] == 0
    assert summary["remaining"]["calories"] == 2000


def test_user_data_isolation(db, test_user):
    other_user = create_user(db, email="other@example.com", password_hash="fakehash")
    foods = [{"name": "Apple", "quantity": "1", "calories": 95, "protein_g": 0.5, "carbs_g": 25.0, "fat_g": 0.3}]
    create_meal(db, test_user, date="2026-05-19", source="manual", foods=foods)
    create_meal(db, other_user, date="2026-05-19", source="manual", foods=foods)

    meals_user1 = get_meals_by_date(db, test_user, "2026-05-19")
    meals_user2 = get_meals_by_date(db, other_user, "2026-05-19")
    assert len(meals_user1) == 1
    assert len(meals_user2) == 1


def test_create_user(db):
    user_id = create_user(db, email="test@example.com", password_hash="hashed123")
    assert user_id > 0


def test_create_user_duplicate_email(db):
    create_user(db, email="test@example.com", password_hash="hashed123")
    user_id = create_user(db, email="test@example.com", password_hash="hashed456")
    assert user_id is None


def test_get_user_by_email(db):
    create_user(db, email="test@example.com", password_hash="hashed123")
    user = get_user_by_email(db, "test@example.com")
    assert user is not None
    assert user["email"] == "test@example.com"
    assert user["password_hash"] == "hashed123"


def test_get_user_by_email_not_found(db):
    user = get_user_by_email(db, "nobody@example.com")
    assert user is None
