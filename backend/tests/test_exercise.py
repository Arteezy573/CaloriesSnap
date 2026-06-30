from database import (
    create_exercise,
    create_meal,
    create_user,
    delete_exercise,
    get_daily_summary,
    get_exercises_by_date,
)


def test_create_exercise_returns_entry(db, test_user):
    entry = create_exercise(
        db, test_user, date="2026-06-10", name="Running", duration_min=30, calories_burned=320
    )
    assert entry["id"] > 0
    assert entry["date"] == "2026-06-10"
    assert entry["name"] == "Running"
    assert entry["duration_min"] == 30
    assert entry["calories_burned"] == 320


def test_get_exercises_by_date_filters_and_orders(db, test_user):
    create_exercise(db, test_user, date="2026-06-10", name="Running", duration_min=30, calories_burned=320)
    create_exercise(db, test_user, date="2026-06-10", name="Cycling", duration_min=45, calories_burned=400)
    create_exercise(db, test_user, date="2026-06-11", name="Yoga", duration_min=60, calories_burned=180)
    entries = get_exercises_by_date(db, test_user, "2026-06-10")
    assert len(entries) == 2
    assert {e["name"] for e in entries} == {"Running", "Cycling"}


def test_get_exercises_isolated_per_user(db, test_user):
    other = create_user(db, email="other@example.com", password_hash="fakehash")
    create_exercise(db, test_user, date="2026-06-10", name="Running", duration_min=30, calories_burned=320)
    create_exercise(db, other, date="2026-06-10", name="Swimming", duration_min=30, calories_burned=300)
    entries = get_exercises_by_date(db, test_user, "2026-06-10")
    assert len(entries) == 1
    assert entries[0]["name"] == "Running"


def test_delete_exercise(db, test_user):
    entry = create_exercise(
        db, test_user, date="2026-06-10", name="Running", duration_min=30, calories_burned=320
    )
    assert delete_exercise(db, test_user, entry["id"]) is True
    assert get_exercises_by_date(db, test_user, "2026-06-10") == []


def test_delete_exercise_wrong_user(db, test_user):
    other = create_user(db, email="other@example.com", password_hash="fakehash")
    entry = create_exercise(
        db, test_user, date="2026-06-10", name="Running", duration_min=30, calories_burned=320
    )
    assert delete_exercise(db, other, entry["id"]) is False
    assert len(get_exercises_by_date(db, test_user, "2026-06-10")) == 1


def test_summary_includes_exercise_and_eats_back_calories(db, test_user):
    foods = [
        {"name": "Chicken", "quantity": "200g", "calories": 350, "protein_g": 42.0, "carbs_g": 0.0, "fat_g": 8.5},
    ]
    create_meal(db, test_user, date="2026-06-10", source="manual", foods=foods)
    create_exercise(db, test_user, date="2026-06-10", name="Running", duration_min=30, calories_burned=300)
    create_exercise(db, test_user, date="2026-06-10", name="Cycling", duration_min=20, calories_burned=150)

    summary = get_daily_summary(db, test_user, "2026-06-10")
    assert summary["calories_burned"] == 450
    assert summary["exercise_count"] == 2
    # eat-back budget: goal - consumed + burned
    assert summary["remaining"]["calories"] == 2000 - 350 + 450


def test_summary_no_exercise_defaults_zero(db, test_user):
    summary = get_daily_summary(db, test_user, "2026-01-01")
    assert summary["calories_burned"] == 0
    assert summary["exercise_count"] == 0
    assert summary["remaining"]["calories"] == 2000
