from database import (
    create_user,
    delete_weight_log,
    get_latest_weight,
    get_weight_logs,
    log_weight,
)


def test_log_weight_creates_entry(db, test_user):
    entry = log_weight(db, test_user, date="2026-06-10", weight_kg=80.5)
    assert entry["date"] == "2026-06-10"
    assert entry["weight_kg"] == 80.5
    assert entry["note"] is None


def test_log_weight_upserts_same_date(db, test_user):
    log_weight(db, test_user, date="2026-06-10", weight_kg=80.5)
    log_weight(db, test_user, date="2026-06-10", weight_kg=79.0, note="after run")
    logs = get_weight_logs(db, test_user, start="2026-06-01", end="2026-06-30")
    assert len(logs) == 1
    assert logs[0]["weight_kg"] == 79.0
    assert logs[0]["note"] == "after run"


def test_get_weight_logs_filters_by_range_and_orders(db, test_user):
    log_weight(db, test_user, date="2026-06-05", weight_kg=82.0)
    log_weight(db, test_user, date="2026-06-10", weight_kg=81.0)
    log_weight(db, test_user, date="2026-07-01", weight_kg=80.0)
    logs = get_weight_logs(db, test_user, start="2026-06-01", end="2026-06-30")
    assert [l["date"] for l in logs] == ["2026-06-05", "2026-06-10"]


def test_get_weight_logs_isolated_per_user(db, test_user):
    other = create_user(db, email="other@example.com", password_hash="fakehash")
    log_weight(db, test_user, date="2026-06-10", weight_kg=80.0)
    log_weight(db, other, date="2026-06-10", weight_kg=95.0)
    logs = get_weight_logs(db, test_user, start="2026-06-01", end="2026-06-30")
    assert len(logs) == 1
    assert logs[0]["weight_kg"] == 80.0


def test_get_latest_weight_returns_most_recent(db, test_user):
    log_weight(db, test_user, date="2026-06-05", weight_kg=82.0)
    log_weight(db, test_user, date="2026-06-10", weight_kg=81.0)
    latest = get_latest_weight(db, test_user)
    assert latest["date"] == "2026-06-10"
    assert latest["weight_kg"] == 81.0


def test_get_latest_weight_none_when_empty(db, test_user):
    assert get_latest_weight(db, test_user) is None


def test_delete_weight_log(db, test_user):
    log_weight(db, test_user, date="2026-06-10", weight_kg=80.0)
    assert delete_weight_log(db, test_user, date="2026-06-10") is True
    assert get_weight_logs(db, test_user, start="2026-06-01", end="2026-06-30") == []


def test_delete_weight_log_wrong_user(db, test_user):
    other = create_user(db, email="other@example.com", password_hash="fakehash")
    log_weight(db, test_user, date="2026-06-10", weight_kg=80.0)
    assert delete_weight_log(db, other, date="2026-06-10") is False
    assert len(get_weight_logs(db, test_user, start="2026-06-01", end="2026-06-30")) == 1
