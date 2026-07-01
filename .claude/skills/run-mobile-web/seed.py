#!/usr/bin/env python
"""Seed a verified demo user + a meal into the CaloriesSnap dev DB.

Writes straight to the DB via the backend's own modules so we can call
set_email_verified and skip the email-verification flow entirely.

  python seed.py            # ensure demo user (verified) + today's meal exist
  python seed.py --reset    # wipe the demo user's meals, recreate the clean lunch
  python seed.py --purge    # delete the demo user and all its data
"""
import argparse
import os
import sqlite3
import sys
from datetime import date

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
BACKEND = os.path.join(REPO, "backend")
DB = os.path.join(BACKEND, "caloriessnap.db")
sys.path.insert(0, BACKEND)

import auth  # noqa: E402
import database  # noqa: E402

EMAIL = "demo@test.com"
PASSWORD = "Passw0rd!"
LUNCH = [
    {"name": "Grilled chicken breast", "quantity": "150 g", "calories": 248, "protein_g": 46, "carbs_g": 0, "fat_g": 5},
    {"name": "Brown rice", "quantity": "1 cup", "calories": 216, "protein_g": 5, "carbs_g": 45, "fat_g": 2},
    {"name": "Steamed broccoli", "quantity": "1 cup", "calories": 55, "protein_g": 4, "carbs_g": 11, "fat_g": 1},
]


def connect():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    database.init_db(conn)
    return conn


def get_uid(conn):
    u = database.get_user_by_email(conn, EMAIL)
    return u["id"] if u else None


def ensure_user(conn):
    uid = get_uid(conn)
    if uid is None:
        uid = database.create_user(conn, EMAIL, auth.hash_password(PASSWORD))
        print("created user", uid)
    else:
        print("user exists", uid)
    database.set_email_verified(conn, uid)
    return uid


def clear_meals(conn, uid):
    conn.execute("DELETE FROM food_items WHERE meal_id IN (SELECT id FROM meals WHERE user_id=?)", (uid,))
    conn.execute("DELETE FROM meals WHERE user_id=?", (uid,))
    conn.commit()


def add_lunch(conn, uid):
    today = date.today().isoformat()
    mid = database.create_meal(conn, uid, today, "manual", LUNCH, notes="Lunch")
    print("created meal", mid, "on", today)


def purge(conn, uid):
    clear_meals(conn, uid)
    try:
        conn.execute("DELETE FROM email_codes WHERE user_id=?", (uid,))
    except sqlite3.OperationalError:
        pass
    conn.execute("DELETE FROM users WHERE id=?", (uid,))
    conn.commit()
    print("purged user", uid)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="wipe demo meals, recreate clean lunch")
    ap.add_argument("--purge", action="store_true", help="delete demo user + data")
    args = ap.parse_args()

    conn = connect()
    if args.purge:
        uid = get_uid(conn)
        if uid is None:
            print("no demo user")
        else:
            purge(conn, uid)
        return

    uid = ensure_user(conn)
    if args.reset:
        clear_meals(conn, uid)
        add_lunch(conn, uid)
    elif not database.get_meals_by_date(conn, uid, date.today().isoformat()):
        add_lunch(conn, uid)
    else:
        print("meal already exists for today")
    print("SEED_OK")


if __name__ == "__main__":
    main()
