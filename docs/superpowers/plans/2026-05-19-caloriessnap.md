# CaloriesSnap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal iPhone app that estimates calories and macros from food photos using Claude Vision, with daily goal tracking.

**Architecture:** Backend-centric — React Native (Expo) app sends requests to a local FastAPI server exposed via ngrok. The backend calls Claude Vision for food analysis and stores all data in SQLite. Two-step flow: analyze returns a preview, user confirms to save.

**Tech Stack:** React Native + Expo (mobile), Python + FastAPI (backend), SQLite (database), Claude Vision API via Anthropic SDK (AI), ngrok (dev tunnel)

---

## File Map

### Backend (`backend/`)

| File | Responsibility |
|------|---------------|
| `backend/requirements.txt` | Python dependencies |
| `backend/models.py` | Pydantic request/response models |
| `backend/database.py` | SQLite setup, all DB queries (goals + meals CRUD, daily summary) |
| `backend/analyzer.py` | Claude Vision integration — image analysis + text estimation |
| `backend/main.py` | FastAPI app, all route handlers, CORS config |
| `backend/tests/test_models.py` | Model validation tests |
| `backend/tests/test_database.py` | Database query tests |
| `backend/tests/test_analyzer.py` | Analyzer tests (mocked Claude API) |
| `backend/tests/test_routes.py` | API endpoint integration tests |

### Mobile (`mobile/`)

| File | Responsibility |
|------|---------------|
| `mobile/services/api.ts` | HTTP client for all backend calls |
| `mobile/app/_layout.tsx` | Root layout with tab navigation |
| `mobile/app/(tabs)/_layout.tsx` | Tab bar configuration (Home, Snap, Goals) |
| `mobile/app/(tabs)/index.tsx` | Dashboard — calorie ring, macro bars, meal list |
| `mobile/app/(tabs)/snap.tsx` | Camera capture, AI results, manual entry |
| `mobile/app/(tabs)/goals.tsx` | Daily goal settings |
| `mobile/components/MacroBar.tsx` | Reusable macro progress bar component |
| `mobile/components/MealCard.tsx` | Reusable meal list item component |
| `mobile/components/FoodItemRow.tsx` | Editable food item row for AI results |

---

## Task 1: Backend Project Scaffold

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Create requirements.txt**

```
fastapi==0.115.12
uvicorn==0.34.2
anthropic==0.52.0
python-multipart==0.0.20
Pillow==11.2.1
pytest==8.3.5
httpx==0.28.1
```

- [ ] **Step 2: Create test infrastructure**

Create `backend/tests/__init__.py` (empty file).

Create `backend/tests/conftest.py`:

```python
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
```

- [ ] **Step 3: Install dependencies**

Run: `cd backend && pip install -r requirements.txt`
Expected: All packages install successfully.

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt backend/tests/__init__.py backend/tests/conftest.py
git commit -m "feat: backend project scaffold with dependencies and test infra"
```

---

## Task 2: Pydantic Models

**Files:**
- Create: `backend/models.py`
- Create: `backend/tests/test_models.py`

- [ ] **Step 1: Write failing tests for models**

Create `backend/tests/test_models.py`:

```python
from models import (
    AnalyzeResponse,
    FoodItem,
    GoalsRequest,
    GoalsResponse,
    MealRequest,
    MealResponse,
    SummaryResponse,
    TextAnalyzeRequest,
)


def test_food_item_valid():
    item = FoodItem(
        name="Grilled Chicken",
        quantity="1 piece, ~200g",
        calories=350,
        protein_g=42.0,
        carbs_g=0.0,
        fat_g=8.5,
    )
    assert item.name == "Grilled Chicken"
    assert item.calories == 350


def test_food_item_rejects_negative_calories():
    try:
        FoodItem(
            name="Bad",
            quantity="1",
            calories=-10,
            protein_g=0,
            carbs_g=0,
            fat_g=0,
        )
        assert False, "Should have raised"
    except ValueError:
        pass


def test_analyze_response_computes_total():
    resp = AnalyzeResponse(
        foods=[
            FoodItem(name="A", quantity="1", calories=100, protein_g=10, carbs_g=5, fat_g=3),
            FoodItem(name="B", quantity="1", calories=200, protein_g=20, carbs_g=10, fat_g=6),
        ],
        confidence="high",
    )
    assert resp.total_calories == 300


def test_goals_request_valid():
    g = GoalsRequest(calories=2000, protein_g=150, carbs_g=250, fat_g=65)
    assert g.calories == 2000


def test_meal_request_valid():
    m = MealRequest(
        source="photo",
        image_path="uploads/test.jpg",
        foods=[FoodItem(name="A", quantity="1", calories=100, protein_g=10, carbs_g=5, fat_g=3)],
        notes="",
    )
    assert m.source == "photo"


def test_meal_request_rejects_bad_source():
    try:
        MealRequest(
            source="invalid",
            foods=[FoodItem(name="A", quantity="1", calories=100, protein_g=10, carbs_g=5, fat_g=3)],
        )
        assert False, "Should have raised"
    except ValueError:
        pass


def test_text_analyze_request():
    r = TextAnalyzeRequest(food_description="1 large apple")
    assert r.food_description == "1 large apple"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'models'`

- [ ] **Step 3: Implement models**

Create `backend/models.py`:

```python
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, computed_field, field_validator


class FoodItem(BaseModel):
    name: str
    quantity: str
    calories: int = Field(ge=0)
    protein_g: float = Field(ge=0)
    carbs_g: float = Field(ge=0)
    fat_g: float = Field(ge=0)


class AnalyzeResponse(BaseModel):
    foods: list[FoodItem]
    confidence: str = Field(pattern=r"^(high|medium|low)$")

    @computed_field
    @property
    def total_calories(self) -> int:
        return sum(f.calories for f in self.foods)


class TextAnalyzeRequest(BaseModel):
    food_description: str = Field(min_length=1)


class GoalsRequest(BaseModel):
    calories: int = Field(gt=0)
    protein_g: int = Field(ge=0)
    carbs_g: int = Field(ge=0)
    fat_g: int = Field(ge=0)


class GoalsResponse(BaseModel):
    id: int
    calories: int
    protein_g: int
    carbs_g: int
    fat_g: int
    updated_at: str


class MealRequest(BaseModel):
    source: str
    image_path: Optional[str] = None
    foods: list[FoodItem]
    notes: Optional[str] = None

    @field_validator("source")
    @classmethod
    def validate_source(cls, v: str) -> str:
        if v not in ("photo", "manual"):
            raise ValueError("source must be 'photo' or 'manual'")
        return v


class FoodItemResponse(BaseModel):
    id: int
    name: str
    quantity: str
    calories: int
    protein_g: float
    carbs_g: float
    fat_g: float


class MealResponse(BaseModel):
    id: int
    date: str
    time: str
    source: str
    image_path: Optional[str]
    notes: Optional[str]
    foods: list[FoodItemResponse]
    total_calories: int


class MacroTotals(BaseModel):
    calories: int
    protein_g: float
    carbs_g: float
    fat_g: float


class SummaryResponse(BaseModel):
    date: str
    goals: MacroTotals
    consumed: MacroTotals
    remaining: MacroTotals
    meals_count: int
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_models.py -v`
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/models.py backend/tests/test_models.py
git commit -m "feat: pydantic request/response models with validation"
```

---

## Task 3: Database Layer — Setup + Goals CRUD

**Files:**
- Create: `backend/database.py`
- Create: `backend/tests/test_database.py`

- [ ] **Step 1: Write failing tests for DB setup and goals**

Create `backend/tests/test_database.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_database.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'database'`

- [ ] **Step 3: Implement database setup + goals CRUD**

Create `backend/database.py`:

```python
import sqlite3
from datetime import datetime, timezone


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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_database.py -v`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/database.py backend/tests/test_database.py
git commit -m "feat: database setup with goals CRUD"
```

---

## Task 4: Database Layer — Meals CRUD + Summary

**Files:**
- Modify: `backend/database.py`
- Modify: `backend/tests/test_database.py`

- [ ] **Step 1: Write failing tests for meals CRUD and summary**

Append to `backend/tests/test_database.py`:

```python
from database import create_meal, delete_meal, get_meals_by_date, get_daily_summary


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
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `cd backend && python -m pytest tests/test_database.py -v`
Expected: New tests FAIL — `ImportError: cannot import name 'create_meal'`

- [ ] **Step 3: Implement meals CRUD and summary**

Append to `backend/database.py`:

```python
from typing import Optional


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
```

Note: move `from typing import Optional` to the top of the file next to the existing imports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_database.py -v`
Expected: All 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/database.py backend/tests/test_database.py
git commit -m "feat: meals CRUD and daily summary queries"
```

---

## Task 5: Claude Vision Analyzer

**Files:**
- Create: `backend/analyzer.py`
- Create: `backend/tests/test_analyzer.py`

- [ ] **Step 1: Write failing tests for the analyzer**

Create `backend/tests/test_analyzer.py`:

```python
import json
from unittest.mock import MagicMock, patch

import pytest

from analyzer import analyze_image, analyze_text


MOCK_CLAUDE_RESPONSE = json.dumps({
    "foods": [
        {
            "name": "Grilled Chicken Breast",
            "quantity": "1 piece, ~200g",
            "calories": 350,
            "protein_g": 42.0,
            "carbs_g": 0.0,
            "fat_g": 8.5,
        }
    ],
    "confidence": "high",
})

MOCK_EMPTY_RESPONSE = json.dumps({
    "foods": [],
    "confidence": "low",
})


def _mock_client(response_text: str) -> MagicMock:
    client = MagicMock()
    message = MagicMock()
    message.content = [MagicMock(text=response_text)]
    client.messages.create.return_value = message
    return client


def test_analyze_image_returns_foods():
    client = _mock_client(MOCK_CLAUDE_RESPONSE)
    result = analyze_image(client, b"fake-image-bytes", "image/jpeg")
    assert len(result.foods) == 1
    assert result.foods[0].name == "Grilled Chicken Breast"
    assert result.confidence == "high"
    assert result.total_calories == 350


def test_analyze_image_calls_claude_with_image():
    client = _mock_client(MOCK_CLAUDE_RESPONSE)
    analyze_image(client, b"fake-image-bytes", "image/jpeg")
    call_kwargs = client.messages.create.call_args.kwargs
    assert call_kwargs["model"] == "claude-sonnet-4-20250514"
    assert call_kwargs["max_tokens"] == 1024
    user_content = call_kwargs["messages"][0]["content"]
    assert any(block.get("type") == "image" for block in user_content)


def test_analyze_image_empty_result():
    client = _mock_client(MOCK_EMPTY_RESPONSE)
    result = analyze_image(client, b"fake-image-bytes", "image/jpeg")
    assert len(result.foods) == 0
    assert result.total_calories == 0


def test_analyze_text_returns_foods():
    client = _mock_client(MOCK_CLAUDE_RESPONSE)
    result = analyze_text(client, "grilled chicken breast, 200g")
    assert len(result.foods) == 1
    assert result.foods[0].calories == 350


def test_analyze_text_calls_claude_with_text():
    client = _mock_client(MOCK_CLAUDE_RESPONSE)
    analyze_text(client, "1 large apple")
    call_kwargs = client.messages.create.call_args.kwargs
    user_content = call_kwargs["messages"][0]["content"]
    assert isinstance(user_content, str)
    assert "1 large apple" in user_content
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_analyzer.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'analyzer'`

- [ ] **Step 3: Implement the analyzer**

Create `backend/analyzer.py`:

```python
import base64
import json

from anthropic import Anthropic

from models import AnalyzeResponse

SYSTEM_PROMPT = """You are a food nutrition analyzer. When given a food image or text description, identify all foods and estimate their nutritional content.

Respond ONLY with a JSON object in this exact format, no other text:
{
  "foods": [
    {
      "name": "Food Name",
      "quantity": "estimated portion size",
      "calories": 123,
      "protein_g": 12.0,
      "carbs_g": 15.0,
      "fat_g": 5.0
    }
  ],
  "confidence": "high"
}

Rules:
- List every distinct food visible in the image or described in the text
- Estimate portion sizes based on visual cues or the description
- Provide realistic calorie and macro estimates per item
- confidence must be "high", "medium", or "low"
- If no food is detected, return empty foods array with "low" confidence
- All numbers must be non-negative
- calories must be an integer, macros can be floats with one decimal"""


def analyze_image(client: Anthropic, image_bytes: bytes, media_type: str) -> AnalyzeResponse:
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": "Identify all foods in this image and estimate their calories and macronutrients.",
                    },
                ],
            }
        ],
    )
    raw = message.content[0].text
    data = json.loads(raw)
    return AnalyzeResponse(**data)


def analyze_text(client: Anthropic, food_description: str) -> AnalyzeResponse:
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Estimate the calories and macronutrients for: {food_description}",
            }
        ],
    )
    raw = message.content[0].text
    data = json.loads(raw)
    return AnalyzeResponse(**data)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_analyzer.py -v`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/analyzer.py backend/tests/test_analyzer.py
git commit -m "feat: Claude Vision analyzer with image and text analysis"
```

---

## Task 6: FastAPI Routes — Goals

**Files:**
- Create: `backend/main.py`
- Create: `backend/tests/test_routes.py`

- [ ] **Step 1: Write failing tests for goals routes**

Create `backend/tests/test_routes.py`:

```python
import os
import tempfile

import pytest
from httpx import ASGITransport, AsyncClient

from main import app, get_db_conn
from database import get_db, init_db


@pytest.fixture
def db_path():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    yield path
    os.unlink(path)


@pytest.fixture
def test_app(db_path):
    conn = get_db(db_path)
    init_db(conn)

    def override_db():
        return conn

    app.dependency_overrides[get_db_conn] = override_db
    yield app
    app.dependency_overrides.clear()
    conn.close()


@pytest.fixture
async def client(test_app):
    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as c:
        yield c


@pytest.mark.anyio
async def test_get_goals_defaults(client):
    resp = await client.get("/api/goals")
    assert resp.status_code == 200
    data = resp.json()
    assert data["calories"] == 2000
    assert data["protein_g"] == 150


@pytest.mark.anyio
async def test_update_goals(client):
    resp = await client.put("/api/goals", json={
        "calories": 1800,
        "protein_g": 120,
        "carbs_g": 200,
        "fat_g": 50,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["calories"] == 1800

    resp2 = await client.get("/api/goals")
    assert resp2.json()["calories"] == 1800


@pytest.mark.anyio
async def test_update_goals_invalid(client):
    resp = await client.put("/api/goals", json={
        "calories": -100,
        "protein_g": 120,
        "carbs_g": 200,
        "fat_g": 50,
    })
    assert resp.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && pip install anyio pytest-anyio && python -m pytest tests/test_routes.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'main'`

- [ ] **Step 3: Implement FastAPI app with goals routes**

Add `anyio` and `pytest-anyio` to `backend/requirements.txt`:

```
fastapi==0.115.12
uvicorn==0.34.2
anthropic==0.52.0
python-multipart==0.0.20
Pillow==11.2.1
pytest==8.3.5
httpx==0.28.1
anyio==4.9.0
pytest-anyio==0.0.0
```

Note: Check PyPI for latest `pytest-anyio` — if it doesn't exist as a standalone package, use `anyio[trio]` and `pytest` with `@pytest.mark.anyio` (supported by `anyio` itself with the pytest plugin). Alternatively, use `trio` as the backend. If `pytest-anyio` is not available, add `[tool.pytest.ini_options] / anyio_backend = "asyncio"` to a `pyproject.toml` or use `@pytest.mark.asyncio` with `pytest-asyncio` instead. Adjust the test markers accordingly.

Simpler alternative — use `pytest-asyncio`:

Update `backend/requirements.txt`:

```
fastapi==0.115.12
uvicorn==0.34.2
anthropic==0.52.0
python-multipart==0.0.20
Pillow==11.2.1
pytest==8.3.5
pytest-asyncio==0.25.3
httpx==0.28.1
```

Update test markers in `backend/tests/test_routes.py` — replace `@pytest.mark.anyio` with `@pytest.mark.asyncio`.

Create `backend/main.py`:

```python
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import get_db, init_db, get_goals, update_goals
from models import GoalsRequest, GoalsResponse


_db_conn = None


def get_db_conn():
    return _db_conn


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _db_conn
    db_path = os.environ.get("DB_PATH", "caloriessnap.db")
    _db_conn = get_db(db_path)
    init_db(_db_conn)
    yield
    _db_conn.close()


app = FastAPI(title="CaloriesSnap API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/goals", response_model=GoalsResponse)
def read_goals(conn=Depends(get_db_conn)):
    return get_goals(conn)


@app.put("/api/goals", response_model=GoalsResponse)
def set_goals(req: GoalsRequest, conn=Depends(get_db_conn)):
    return update_goals(conn, req.calories, req.protein_g, req.carbs_g, req.fat_g)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pip install pytest-asyncio && python -m pytest tests/test_routes.py -v`
Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_routes.py backend/requirements.txt
git commit -m "feat: FastAPI app with goals endpoints"
```

---

## Task 7: FastAPI Routes — Meals, Analyze, Summary

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/tests/test_routes.py`

- [ ] **Step 1: Write failing tests for meals/analyze/summary routes**

Append to `backend/tests/test_routes.py`:

```python
import json
from unittest.mock import MagicMock, patch


@pytest.mark.asyncio
async def test_create_and_get_meals(client):
    resp = await client.post("/api/meals", json={
        "source": "manual",
        "foods": [
            {"name": "Apple", "quantity": "1 large", "calories": 95, "protein_g": 0.5, "carbs_g": 25.0, "fat_g": 0.3}
        ],
        "notes": "snack",
    })
    assert resp.status_code == 200
    meal = resp.json()
    assert meal["id"] > 0
    assert meal["total_calories"] == 95

    from datetime import date
    today = date.today().isoformat()
    resp2 = await client.get(f"/api/meals?date={today}")
    assert resp2.status_code == 200
    meals = resp2.json()
    assert len(meals) == 1


@pytest.mark.asyncio
async def test_delete_meal(client):
    resp = await client.post("/api/meals", json={
        "source": "manual",
        "foods": [
            {"name": "Apple", "quantity": "1", "calories": 95, "protein_g": 0.5, "carbs_g": 25.0, "fat_g": 0.3}
        ],
    })
    meal_id = resp.json()["id"]

    del_resp = await client.delete(f"/api/meals/{meal_id}")
    assert del_resp.status_code == 200

    del_resp2 = await client.delete(f"/api/meals/{meal_id}")
    assert del_resp2.status_code == 404


@pytest.mark.asyncio
async def test_daily_summary(client):
    await client.post("/api/meals", json={
        "source": "manual",
        "foods": [
            {"name": "Chicken", "quantity": "200g", "calories": 350, "protein_g": 42.0, "carbs_g": 0.0, "fat_g": 8.5}
        ],
    })
    from datetime import date
    today = date.today().isoformat()
    resp = await client.get(f"/api/summary?date={today}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["consumed"]["calories"] == 350
    assert data["meals_count"] == 1
    assert data["remaining"]["calories"] == 2000 - 350


MOCK_ANALYZE_RESPONSE = json.dumps({
    "foods": [
        {"name": "Banana", "quantity": "1 medium", "calories": 105, "protein_g": 1.3, "carbs_g": 27.0, "fat_g": 0.4}
    ],
    "confidence": "high",
})


@pytest.mark.asyncio
async def test_analyze_text(client):
    mock_client = MagicMock()
    message = MagicMock()
    message.content = [MagicMock(text=MOCK_ANALYZE_RESPONSE)]
    mock_client.messages.create.return_value = message

    with patch("main.anthropic_client", mock_client):
        resp = await client.post("/api/analyze", json={"food_description": "1 medium banana"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["foods"]) == 1
    assert data["foods"][0]["name"] == "Banana"
    assert data["total_calories"] == 105
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `cd backend && python -m pytest tests/test_routes.py -v`
Expected: New tests FAIL — `404` for `/api/meals` route.

- [ ] **Step 3: Add meals, analyze, and summary routes to main.py**

Add imports and routes to `backend/main.py`. The full file after changes:

```python
import os
from contextlib import asynccontextmanager
from datetime import date

from anthropic import Anthropic
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from analyzer import analyze_image, analyze_text
from database import (
    create_meal,
    delete_meal,
    get_daily_summary,
    get_db,
    get_goals,
    get_meals_by_date,
    init_db,
    update_goals,
)
from models import (
    AnalyzeResponse,
    GoalsRequest,
    GoalsResponse,
    MealRequest,
    MealResponse,
    SummaryResponse,
    TextAnalyzeRequest,
)

_db_conn = None
anthropic_client = None


def get_db_conn():
    return _db_conn


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _db_conn, anthropic_client
    db_path = os.environ.get("DB_PATH", "caloriessnap.db")
    _db_conn = get_db(db_path)
    init_db(_db_conn)
    anthropic_client = Anthropic()
    yield
    _db_conn.close()


app = FastAPI(title="CaloriesSnap API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/goals", response_model=GoalsResponse)
def read_goals(conn=Depends(get_db_conn)):
    return get_goals(conn)


@app.put("/api/goals", response_model=GoalsResponse)
def set_goals(req: GoalsRequest, conn=Depends(get_db_conn)):
    return update_goals(conn, req.calories, req.protein_g, req.carbs_g, req.fat_g)


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_food(
    file: UploadFile | None = File(None),
    food_description: str | None = None,
    conn=Depends(get_db_conn),
):
    if file:
        image_bytes = await file.read()
        media_type = file.content_type or "image/jpeg"
        return analyze_image(anthropic_client, image_bytes, media_type)
    elif food_description:
        return analyze_text(anthropic_client, food_description)
    else:
        raise HTTPException(status_code=400, detail="Provide either an image file or food_description")


@app.post("/api/analyze_text", response_model=AnalyzeResponse)
def analyze_food_text(req: TextAnalyzeRequest):
    return analyze_text(anthropic_client, req.food_description)


@app.post("/api/meals", response_model=MealResponse)
def create_new_meal(req: MealRequest, conn=Depends(get_db_conn)):
    foods = [f.model_dump() for f in req.foods]
    meal_id = create_meal(
        conn,
        date=date.today().isoformat(),
        source=req.source,
        foods=foods,
        image_path=req.image_path,
        notes=req.notes,
    )
    meals = get_meals_by_date(conn, date.today().isoformat())
    for m in meals:
        if m["id"] == meal_id:
            return m
    raise HTTPException(status_code=500, detail="Failed to retrieve created meal")


@app.get("/api/meals", response_model=list[MealResponse])
def read_meals(date: str, conn=Depends(get_db_conn)):
    return get_meals_by_date(conn, date)


@app.delete("/api/meals/{meal_id}")
def remove_meal(meal_id: int, conn=Depends(get_db_conn)):
    deleted = delete_meal(conn, meal_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Meal not found")
    return {"ok": True}


@app.get("/api/summary", response_model=SummaryResponse)
def read_summary(date: str, conn=Depends(get_db_conn)):
    return get_daily_summary(conn, date)
```

- [ ] **Step 4: Run all backend tests**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All tests PASS (models, database, routes).

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_routes.py
git commit -m "feat: meals, analyze, and summary API routes"
```

---

## Task 8: Mobile Project Scaffold + API Client

**Files:**
- Create: Expo project at `mobile/`
- Create: `mobile/services/api.ts`
- Create: `mobile/services/config.ts`

- [ ] **Step 1: Create Expo project**

Run:
```bash
npx create-expo-app@latest mobile --template blank-typescript
```

Expected: Expo project created in `mobile/` directory.

- [ ] **Step 2: Install dependencies**

Run:
```bash
cd mobile && npx expo install expo-camera expo-image-picker expo-image-manipulator
```

Expected: Packages install successfully.

- [ ] **Step 3: Create config file for API base URL**

Create `mobile/services/config.ts`:

```typescript
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";
```

- [ ] **Step 4: Create API client**

Create `mobile/services/api.ts`:

```typescript
import { API_BASE_URL } from "./config";

export interface FoodItem {
  id?: number;
  name: string;
  quantity: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface AnalyzeResponse {
  foods: FoodItem[];
  confidence: string;
  total_calories: number;
}

export interface Meal {
  id: number;
  date: string;
  time: string;
  source: "photo" | "manual";
  image_path: string | null;
  notes: string | null;
  foods: FoodItem[];
  total_calories: number;
}

export interface Goals {
  id: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  updated_at: string;
}

export interface DailySummary {
  date: string;
  goals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  consumed: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  remaining: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  meals_count: number;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API error ${resp.status}: ${text}`);
  }
  return resp.json();
}

export async function analyzePhoto(imageUri: string): Promise<AnalyzeResponse> {
  const formData = new FormData();
  const filename = imageUri.split("/").pop() || "photo.jpg";
  formData.append("file", {
    uri: imageUri,
    name: filename,
    type: "image/jpeg",
  } as any);

  const resp = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: "POST",
    body: formData,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Analyze error ${resp.status}: ${text}`);
  }
  return resp.json();
}

export async function analyzeText(foodDescription: string): Promise<AnalyzeResponse> {
  return request<AnalyzeResponse>("/api/analyze_text", {
    method: "POST",
    body: JSON.stringify({ food_description: foodDescription }),
  });
}

export async function getMeals(date: string): Promise<Meal[]> {
  return request<Meal[]>(`/api/meals?date=${date}`);
}

export async function createMeal(meal: {
  source: "photo" | "manual";
  image_path?: string;
  foods: FoodItem[];
  notes?: string;
}): Promise<Meal> {
  return request<Meal>("/api/meals", {
    method: "POST",
    body: JSON.stringify(meal),
  });
}

export async function deleteMeal(mealId: number): Promise<void> {
  await request(`/api/meals/${mealId}`, { method: "DELETE" });
}

export async function getGoals(): Promise<Goals> {
  return request<Goals>("/api/goals");
}

export async function updateGoals(goals: {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}): Promise<Goals> {
  return request<Goals>("/api/goals", {
    method: "PUT",
    body: JSON.stringify(goals),
  });
}

export async function getDailySummary(date: string): Promise<DailySummary> {
  return request<DailySummary>(`/api/summary?date=${date}`);
}
```

- [ ] **Step 5: Commit**

```bash
git add mobile/services/config.ts mobile/services/api.ts
git commit -m "feat: Expo project scaffold with typed API client"
```

---

## Task 9: Tab Navigation Layout

**Files:**
- Create: `mobile/app/_layout.tsx`
- Create: `mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Install navigation dependencies**

Run:
```bash
cd mobile && npx expo install expo-router expo-status-bar react-native-safe-area-context react-native-screens
```

- [ ] **Step 2: Create root layout**

Create `mobile/app/_layout.tsx`:

```tsx
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
```

- [ ] **Step 3: Create tab layout**

Create `mobile/app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from "expo-router";
import { Text } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0f0f1a" },
        headerTintColor: "#fff",
        tabBarStyle: { backgroundColor: "#0f0f1a", borderTopColor: "#333" },
        tabBarActiveTintColor: "#4ecdc4",
        tabBarInactiveTintColor: "#888",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="snap"
        options={{
          title: "Snap",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📸</Text>,
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: "Goals",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 4: Create placeholder screens**

Create `mobile/app/(tabs)/index.tsx`:

```tsx
import { View, Text, StyleSheet } from "react-native";

export default function DashboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Dashboard — coming next</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a", justifyContent: "center", alignItems: "center" },
  text: { color: "#fff", fontSize: 18 },
});
```

Create `mobile/app/(tabs)/snap.tsx`:

```tsx
import { View, Text, StyleSheet } from "react-native";

export default function SnapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Snap — coming next</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a", justifyContent: "center", alignItems: "center" },
  text: { color: "#fff", fontSize: 18 },
});
```

Create `mobile/app/(tabs)/goals.tsx`:

```tsx
import { View, Text, StyleSheet } from "react-native";

export default function GoalsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Goals — coming next</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a", justifyContent: "center", alignItems: "center" },
  text: { color: "#fff", fontSize: 18 },
});
```

- [ ] **Step 5: Verify tabs load**

Run: `cd mobile && npx expo start`
Expected: Open in Expo Go on iPhone — 3 tabs visible, tapping each shows placeholder text.

- [ ] **Step 6: Commit**

```bash
git add mobile/app/
git commit -m "feat: tab navigation with 3 placeholder screens"
```

---

## Task 10: Goals Screen

**Files:**
- Modify: `mobile/app/(tabs)/goals.tsx`

- [ ] **Step 1: Implement goals screen**

Replace `mobile/app/(tabs)/goals.tsx`:

```tsx
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { getGoals, updateGoals } from "../../services/api";

export default function GoalsScreen() {
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    try {
      const goals = await getGoals();
      setCalories(String(goals.calories));
      setProtein(String(goals.protein_g));
      setCarbs(String(goals.carbs_g));
      setFat(String(goals.fat_g));
    } catch (e: any) {
      Alert.alert("Error", "Could not load goals: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateGoals({
        calories: parseInt(calories) || 0,
        protein_g: parseInt(protein) || 0,
        carbs_g: parseInt(carbs) || 0,
        fat_g: parseInt(fat) || 0,
      });
      Alert.alert("Saved", "Daily goals updated.");
    } catch (e: any) {
      Alert.alert("Error", "Could not save goals: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#4ecdc4" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Daily Goals</Text>

      <Text style={styles.label}>DAILY CALORIES</Text>
      <TextInput
        style={styles.input}
        value={calories}
        onChangeText={setCalories}
        keyboardType="numeric"
        placeholderTextColor="#666"
        placeholder="kcal"
      />

      <Text style={[styles.label, { color: "#ff6b6b" }]}>PROTEIN</Text>
      <TextInput
        style={styles.input}
        value={protein}
        onChangeText={setProtein}
        keyboardType="numeric"
        placeholderTextColor="#666"
        placeholder="grams"
      />

      <Text style={[styles.label, { color: "#f7dc6f" }]}>CARBS</Text>
      <TextInput
        style={styles.input}
        value={carbs}
        onChangeText={setCarbs}
        keyboardType="numeric"
        placeholderTextColor="#666"
        placeholder="grams"
      />

      <Text style={[styles.label, { color: "#45b7d1" }]}>FAT</Text>
      <TextInput
        style={styles.input}
        value={fat}
        onChangeText={setFat}
        keyboardType="numeric"
        placeholderTextColor="#666"
        placeholder="grams"
      />

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? "Saving..." : "Save Goals"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  content: { padding: 20 },
  title: { fontSize: 22, fontWeight: "bold", color: "#fff", marginBottom: 24 },
  label: { fontSize: 12, color: "#888", marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: "#1e1e36",
    borderRadius: 10,
    padding: 14,
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  button: {
    backgroundColor: "#4ecdc4",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 32,
  },
  buttonText: { color: "#000", fontSize: 16, fontWeight: "bold" },
});
```

- [ ] **Step 2: Test in Expo Go**

Run: `cd mobile && npx expo start`
Expected: Goals tab shows form with 4 fields pre-filled from backend defaults. Editing and saving updates the backend.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/\(tabs\)/goals.tsx
git commit -m "feat: goals settings screen with load and save"
```

---

## Task 11: Dashboard Screen

**Files:**
- Create: `mobile/components/MacroBar.tsx`
- Create: `mobile/components/MealCard.tsx`
- Modify: `mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Create MacroBar component**

Create `mobile/components/MacroBar.tsx`:

```tsx
import { View, Text, StyleSheet } from "react-native";

interface Props {
  label: string;
  current: number;
  goal: number;
  color: string;
  unit?: string;
}

export default function MacroBar({ label, current, goal, color, unit = "g" }: Props) {
  const pct = goal > 0 ? Math.min(current / goal, 1) : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>
        {Math.round(current)}{unit}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.goal}>/ {goal}{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", flex: 1 },
  label: { fontSize: 11, color: "#888", marginBottom: 4 },
  value: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  track: { width: 60, height: 4, backgroundColor: "#333", borderRadius: 2 },
  fill: { height: 4, borderRadius: 2 },
  goal: { fontSize: 10, color: "#666", marginTop: 4 },
});
```

- [ ] **Step 2: Create MealCard component**

Create `mobile/components/MealCard.tsx`:

```tsx
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Meal } from "../services/api";

interface Props {
  meal: Meal;
  onDelete: (id: number) => void;
}

export default function MealCard({ meal, onDelete }: Props) {
  const icon = meal.source === "photo" ? "📷" : "✏️";
  const foodNames = meal.foods.map((f) => f.name).join(", ");

  return (
    <View style={styles.card}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.info}>
        <Text style={styles.time}>
          {new Date(meal.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
        <Text style={styles.foods} numberOfLines={1}>{foodNames}</Text>
      </View>
      <Text style={styles.calories}>{meal.total_calories} kcal</Text>
      <TouchableOpacity onPress={() => onDelete(meal.id)} style={styles.deleteBtn}>
        <Text style={styles.deleteText}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1e1e36",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  icon: { fontSize: 24, width: 36, textAlign: "center" },
  info: { flex: 1 },
  time: { color: "#fff", fontSize: 14, fontWeight: "600" },
  foods: { color: "#888", fontSize: 12, marginTop: 2 },
  calories: { color: "#4ecdc4", fontSize: 14, fontWeight: "bold" },
  deleteBtn: { padding: 4 },
  deleteText: { color: "#666", fontSize: 20 },
});
```

- [ ] **Step 3: Implement dashboard screen**

Replace `mobile/app/(tabs)/index.tsx`:

```tsx
import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import MacroBar from "../../components/MacroBar";
import MealCard from "../../components/MealCard";
import { DailySummary, Meal, deleteMeal, getDailySummary, getMeals } from "../../services/api";

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export default function DashboardScreen() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      const date = todayISO();
      const [s, m] = await Promise.all([getDailySummary(date), getMeals(date)]);
      setSummary(s);
      setMeals(m);
    } catch (e: any) {
      Alert.alert("Error", "Could not load data: " + e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function handleDelete(mealId: number) {
    try {
      await deleteMeal(mealId);
      loadData();
    } catch (e: any) {
      Alert.alert("Error", "Could not delete meal: " + e.message);
    }
  }

  if (loading || !summary) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4ecdc4" size="large" />
      </View>
    );
  }

  const pct = summary.goals.calories > 0
    ? Math.round((summary.consumed.calories / summary.goals.calories) * 100)
    : 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#4ecdc4" />}
    >
      <View style={styles.header}>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </Text>
        <Text style={styles.calorieText}>
          {summary.consumed.calories} / {summary.goals.calories}
        </Text>
        <Text style={styles.remainingText}>
          kcal remaining: {Math.max(summary.remaining.calories, 0)}
        </Text>
      </View>

      <View style={styles.ring}>
        <Text style={styles.pct}>{pct}%</Text>
      </View>

      <View style={styles.macros}>
        <MacroBar label="Protein" current={summary.consumed.protein_g} goal={summary.goals.protein_g} color="#ff6b6b" />
        <MacroBar label="Carbs" current={summary.consumed.carbs_g} goal={summary.goals.carbs_g} color="#f7dc6f" />
        <MacroBar label="Fat" current={summary.consumed.fat_g} goal={summary.goals.fat_g} color="#45b7d1" />
      </View>

      <View style={styles.mealsSection}>
        <Text style={styles.mealsTitle}>Today's Meals</Text>
        {meals.length === 0 ? (
          <Text style={styles.emptyText}>No meals logged yet. Tap Snap to add one!</Text>
        ) : (
          meals.map((meal) => (
            <MealCard key={meal.id} meal={meal} onDelete={handleDelete} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  center: { flex: 1, backgroundColor: "#0f0f1a", justifyContent: "center", alignItems: "center" },
  header: { alignItems: "center", paddingTop: 16, paddingBottom: 8 },
  dateText: { fontSize: 13, color: "#888" },
  calorieText: { fontSize: 28, fontWeight: "bold", color: "#fff", marginTop: 4 },
  remainingText: { fontSize: 13, color: "#4ecdc4", marginTop: 2 },
  ring: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 10,
    borderColor: "#333",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
  },
  pct: { fontSize: 28, fontWeight: "bold", color: "#fff" },
  macros: { flexDirection: "row", paddingHorizontal: 16, marginBottom: 20 },
  mealsSection: { paddingHorizontal: 16, paddingBottom: 32 },
  mealsTitle: { fontSize: 13, color: "#888", marginBottom: 8 },
  emptyText: { color: "#666", fontSize: 14, textAlign: "center", marginTop: 20 },
});
```

- [ ] **Step 4: Test in Expo Go**

Run: `cd mobile && npx expo start`
Expected: Dashboard shows calorie count, percentage, macro bars, and meal list (empty initially). Pull-to-refresh works.

- [ ] **Step 5: Commit**

```bash
git add mobile/components/MacroBar.tsx mobile/components/MealCard.tsx mobile/app/\(tabs\)/index.tsx
git commit -m "feat: dashboard screen with calorie ring, macro bars, meal list"
```

---

## Task 12: Snap Screen — Camera + AI Results

**Files:**
- Create: `mobile/components/FoodItemRow.tsx`
- Modify: `mobile/app/(tabs)/snap.tsx`

- [ ] **Step 1: Create FoodItemRow component**

Create `mobile/components/FoodItemRow.tsx`:

```tsx
import { View, Text, TextInput, StyleSheet } from "react-native";
import { FoodItem } from "../services/api";

interface Props {
  item: FoodItem;
  index: number;
  onUpdate: (index: number, updated: FoodItem) => void;
  editable: boolean;
}

export default function FoodItemRow({ item, index, onUpdate, editable }: Props) {
  function update(field: keyof FoodItem, value: string) {
    const numFields = ["calories", "protein_g", "carbs_g", "fat_g"];
    const parsed = numFields.includes(field) ? parseFloat(value) || 0 : value;
    onUpdate(index, { ...item, [field]: parsed });
  }

  return (
    <View style={styles.row}>
      <View style={styles.topRow}>
        {editable ? (
          <TextInput
            style={styles.nameInput}
            value={item.name}
            onChangeText={(v) => update("name", v)}
          />
        ) : (
          <Text style={styles.name}>{item.name}</Text>
        )}
        <Text style={styles.calories}>{item.calories} kcal</Text>
      </View>
      <Text style={styles.detail}>
        {item.quantity}  •  P: {item.protein_g}g  C: {item.carbs_g}g  F: {item.fat_g}g
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: "#1e1e36", borderRadius: 10, padding: 12, marginBottom: 8 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: "#fff", fontSize: 14, flex: 1 },
  nameInput: { color: "#fff", fontSize: 14, flex: 1, borderBottomWidth: 1, borderBottomColor: "#4ecdc4", paddingBottom: 2 },
  calories: { color: "#fff", fontSize: 14, marginLeft: 8 },
  detail: { color: "#888", fontSize: 12, marginTop: 4 },
});
```

- [ ] **Step 2: Implement snap screen with camera and AI results**

Replace `mobile/app/(tabs)/snap.tsx`:

```tsx
import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import FoodItemRow from "../../components/FoodItemRow";
import {
  FoodItem,
  AnalyzeResponse,
  analyzePhoto,
  analyzeText,
  createMeal,
} from "../../services/api";

type Mode = "camera" | "results" | "manual";

export default function SnapScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("camera");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [confidence, setConfidence] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editable, setEditable] = useState(false);

  // Manual entry state
  const [foodName, setFoodName] = useState("");
  const [manCalories, setManCalories] = useState("");
  const [manProtein, setManProtein] = useState("");
  const [manCarbs, setManCarbs] = useState("");
  const [manFat, setManFat] = useState("");
  const [estimating, setEstimating] = useState(false);

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera permission is required to take photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      setAnalyzing(true);
      try {
        const analysis = await analyzePhoto(uri);
        setFoods(analysis.foods);
        setConfidence(analysis.confidence);
        setMode("results");
      } catch (e: any) {
        Alert.alert("Analysis failed", e.message + "\n\nYou can try again or enter manually.");
      } finally {
        setAnalyzing(false);
      }
    }
  }

  async function handleSaveMeal() {
    setSaving(true);
    try {
      await createMeal({ source: "photo", foods, image_path: imageUri });
      Alert.alert("Saved!", "Meal added to your log.");
      resetState();
      router.navigate("/");
    } catch (e: any) {
      Alert.alert("Error", "Could not save meal: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleEstimate() {
    if (!foodName.trim()) return;
    setEstimating(true);
    try {
      const result = await analyzeText(foodName);
      if (result.foods.length > 0) {
        const f = result.foods[0];
        setManCalories(String(f.calories));
        setManProtein(String(f.protein_g));
        setManCarbs(String(f.carbs_g));
        setManFat(String(f.fat_g));
      }
    } catch (e: any) {
      Alert.alert("Error", "Could not estimate: " + e.message);
    } finally {
      setEstimating(false);
    }
  }

  async function handleSaveManual() {
    if (!foodName.trim()) {
      Alert.alert("Missing", "Enter a food name.");
      return;
    }
    setSaving(true);
    try {
      await createMeal({
        source: "manual",
        foods: [
          {
            name: foodName,
            quantity: "1 serving",
            calories: parseInt(manCalories) || 0,
            protein_g: parseFloat(manProtein) || 0,
            carbs_g: parseFloat(manCarbs) || 0,
            fat_g: parseFloat(manFat) || 0,
          },
        ],
      });
      Alert.alert("Saved!", "Meal added to your log.");
      resetState();
      router.navigate("/");
    } catch (e: any) {
      Alert.alert("Error", "Could not save meal: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  function resetState() {
    setMode("camera");
    setImageUri(null);
    setFoods([]);
    setConfidence("");
    setEditable(false);
    setFoodName("");
    setManCalories("");
    setManProtein("");
    setManCarbs("");
    setManFat("");
  }

  function updateFood(index: number, updated: FoodItem) {
    setFoods((prev) => prev.map((f, i) => (i === index ? updated : f)));
  }

  const totalCalories = foods.reduce((sum, f) => sum + f.calories, 0);

  // Manual entry mode
  if (mode === "manual") {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Add Food Manually</Text>

        <Text style={styles.label}>FOOD NAME</Text>
        <TextInput
          style={styles.input}
          value={foodName}
          onChangeText={setFoodName}
          placeholder="e.g. Apple, Greek Yogurt..."
          placeholderTextColor="#666"
        />

        <Text style={styles.label}>CALORIES</Text>
        <TextInput
          style={styles.input}
          value={manCalories}
          onChangeText={setManCalories}
          keyboardType="numeric"
          placeholder="kcal"
          placeholderTextColor="#666"
        />

        <View style={styles.macroRow}>
          <View style={styles.macroField}>
            <Text style={[styles.label, { color: "#ff6b6b" }]}>PROTEIN</Text>
            <TextInput
              style={styles.input}
              value={manProtein}
              onChangeText={setManProtein}
              keyboardType="numeric"
              placeholder="g"
              placeholderTextColor="#666"
            />
          </View>
          <View style={styles.macroField}>
            <Text style={[styles.label, { color: "#f7dc6f" }]}>CARBS</Text>
            <TextInput
              style={styles.input}
              value={manCarbs}
              onChangeText={setManCarbs}
              keyboardType="numeric"
              placeholder="g"
              placeholderTextColor="#666"
            />
          </View>
          <View style={styles.macroField}>
            <Text style={[styles.label, { color: "#45b7d1" }]}>FAT</Text>
            <TextInput
              style={styles.input}
              value={manFat}
              onChangeText={setManFat}
              keyboardType="numeric"
              placeholder="g"
              placeholderTextColor="#666"
            />
          </View>
        </View>

        <View style={styles.tip}>
          <Text style={styles.tipText}>
            💡 Just type the food name and tap "Estimate" — AI will fill in the numbers
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.estimateBtn}
            onPress={handleEstimate}
            disabled={estimating}
          >
            <Text style={styles.estimateBtnText}>
              {estimating ? "Estimating..." : "🤖 Estimate"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSaveManual}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? "Saving..." : "✓ Save"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => setMode("camera")} style={styles.switchLink}>
          <Text style={styles.switchText}>📸 Use camera instead</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Results mode (after photo analysis)
  if (mode === "results") {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}

        <View style={styles.resultHeader}>
          <Text style={styles.resultTitle}>AI Analysis Result</Text>
          {confidence === "low" && (
            <View style={styles.warningBadge}>
              <Text style={styles.warningText}>Low confidence — please review</Text>
            </View>
          )}
        </View>

        {foods.map((food, i) => (
          <FoodItemRow key={i} item={food} index={i} onUpdate={updateFood} editable={editable} />
        ))}

        <View style={styles.totalBar}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{totalCalories} kcal</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => setEditable(!editable)}
          >
            <Text style={styles.editBtnText}>{editable ? "Done" : "✏️ Edit"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSaveMeal}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? "Saving..." : "✓ Save Meal"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={resetState} style={styles.switchLink}>
          <Text style={styles.switchText}>← Take another photo</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Camera mode (default)
  return (
    <View style={[styles.container, styles.cameraMode]}>
      {analyzing ? (
        <View style={styles.analyzingBox}>
          <ActivityIndicator color="#4ecdc4" size="large" />
          <Text style={styles.analyzingText}>Analyzing your meal...</Text>
        </View>
      ) : (
        <>
          <TouchableOpacity style={styles.captureBtn} onPress={takePhoto}>
            <Text style={styles.captureBtnText}>📸 Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode("manual")}
            style={styles.switchLink}
          >
            <Text style={styles.switchText}>✏️ Type instead</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  content: { padding: 16, paddingBottom: 40 },
  cameraMode: { justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "bold", color: "#fff", marginBottom: 20 },
  label: { fontSize: 12, color: "#888", marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: "#1e1e36",
    borderRadius: 10,
    padding: 12,
    color: "#fff",
    fontSize: 16,
  },
  macroRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  macroField: { flex: 1 },
  tip: {
    backgroundColor: "#1a3a3a",
    borderRadius: 10,
    padding: 12,
    marginTop: 20,
    alignItems: "center",
  },
  tipText: { color: "#4ecdc4", fontSize: 12 },
  actions: { flexDirection: "row", gap: 12, marginTop: 20 },
  estimateBtn: {
    flex: 1,
    backgroundColor: "#333",
    borderWidth: 1,
    borderColor: "#4ecdc4",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  estimateBtnText: { color: "#4ecdc4", fontSize: 14 },
  saveBtn: {
    flex: 1,
    backgroundColor: "#4ecdc4",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  saveBtnText: { color: "#000", fontSize: 14, fontWeight: "bold" },
  editBtn: {
    flex: 1,
    backgroundColor: "#333",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  editBtnText: { color: "#fff", fontSize: 14 },
  switchLink: { marginTop: 20, alignItems: "center" },
  switchText: { color: "#4ecdc4", fontSize: 14 },
  preview: { width: "100%", height: 220, borderRadius: 10, marginBottom: 16 },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  resultTitle: { fontSize: 16, fontWeight: "bold", color: "#fff" },
  warningBadge: { backgroundColor: "#553300", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  warningText: { color: "#f7dc6f", fontSize: 11 },
  totalBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#2a2a4a",
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  totalLabel: { color: "#fff", fontWeight: "bold" },
  totalValue: { color: "#4ecdc4", fontWeight: "bold" },
  captureBtn: {
    backgroundColor: "#4ecdc4",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  captureBtnText: { color: "#000", fontSize: 18, fontWeight: "bold" },
  analyzingBox: { alignItems: "center", gap: 16 },
  analyzingText: { color: "#888", fontSize: 16 },
});
```

- [ ] **Step 3: Test in Expo Go**

Run: `cd mobile && npx expo start`
Expected: Snap tab shows "Take Photo" button and "Type instead" link. Camera captures → sends to backend → shows results with food items. Tapping Edit makes names editable. Save Meal navigates to dashboard. Manual entry mode works with Estimate button.

- [ ] **Step 4: Commit**

```bash
git add mobile/components/FoodItemRow.tsx mobile/app/\(tabs\)/snap.tsx
git commit -m "feat: snap screen with camera, AI results, and manual entry"
```

---

## Task 13: Backend Image Upload Handling

**Files:**
- Modify: `backend/main.py`
- Create: `backend/uploads/.gitkeep`

The `/api/analyze` endpoint already handles the file upload and sends it to Claude, but we also need to persist uploaded images so the meal record can reference them.

- [ ] **Step 1: Create uploads directory**

```bash
mkdir -p backend/uploads
touch backend/uploads/.gitkeep
```

- [ ] **Step 2: Update analyze endpoint to save images**

In `backend/main.py`, update the `analyze_food` function to save the uploaded file:

```python
import shutil
import uuid
from datetime import date, datetime
from pathlib import Path
from io import BytesIO
from PIL import Image as PILImage

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

MAX_IMAGE_DIMENSION = 1024


def resize_image(image_bytes: bytes, max_dim: int = MAX_IMAGE_DIMENSION) -> bytes:
    img = PILImage.open(BytesIO(image_bytes))
    if max(img.size) > max_dim:
        img.thumbnail((max_dim, max_dim))
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_food(
    file: UploadFile | None = File(None),
    food_description: str | None = None,
    conn=Depends(get_db_conn),
):
    if file:
        raw_bytes = await file.read()
        resized = resize_image(raw_bytes)
        filename = f"{date.today().isoformat()}_{uuid.uuid4().hex[:8]}.jpg"
        save_path = UPLOAD_DIR / filename
        save_path.write_bytes(resized)
        media_type = file.content_type or "image/jpeg"
        result = analyze_image(anthropic_client, resized, media_type)
        result.image_path = f"uploads/{filename}"
        return result
    elif food_description:
        return analyze_text(anthropic_client, food_description)
    else:
        raise HTTPException(status_code=400, detail="Provide either an image file or food_description")
```

Also add `image_path` as an optional field to `AnalyzeResponse` in `backend/models.py`:

```python
class AnalyzeResponse(BaseModel):
    foods: list[FoodItem]
    confidence: str = Field(pattern=r"^(high|medium|low)$")
    image_path: Optional[str] = None

    @computed_field
    @property
    def total_calories(self) -> int:
        return sum(f.calories for f in self.foods)
```

- [ ] **Step 3: Add .gitignore for uploads**

Create `backend/.gitignore`:

```
uploads/*.jpg
uploads/*.jpeg
uploads/*.png
!uploads/.gitkeep
caloriessnap.db
__pycache__/
```

- [ ] **Step 4: Run all backend tests**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/models.py backend/uploads/.gitkeep backend/.gitignore
git commit -m "feat: image upload persistence with resize preprocessing"
```

---

## Task 14: End-to-End Dev Setup Verification

**Files:**
- Create: `.gitignore` (project root)
- Modify: `mobile/services/config.ts` (if needed)

- [ ] **Step 1: Create root .gitignore**

Create `.gitignore`:

```
node_modules/
.expo/
.superpowers/
*.db
__pycache__/
backend/uploads/*.jpg
backend/uploads/*.jpeg
backend/uploads/*.png
```

- [ ] **Step 2: Start the backend**

Run:
```bash
cd backend && ANTHROPIC_API_KEY=your-key-here uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Expected: Server starts on `http://0.0.0.0:8000`. Visit `http://localhost:8000/docs` to see Swagger UI with all 7 endpoints.

- [ ] **Step 3: Start ngrok**

Run:
```bash
ngrok http 8000
```

Expected: ngrok shows a forwarding URL like `https://abc123.ngrok-free.app`.

- [ ] **Step 4: Configure mobile app with ngrok URL**

Create `mobile/.env`:

```
EXPO_PUBLIC_API_URL=https://abc123.ngrok-free.app
```

(Replace with actual ngrok URL.)

- [ ] **Step 5: Start Expo and test on iPhone**

Run:
```bash
cd mobile && npx expo start
```

Scan the QR code with the iPhone camera to open in Expo Go. Verify:
1. Dashboard loads with default goals (2000 kcal) and empty meal list
2. Goals tab shows default values, can be updated and saved
3. Snap tab opens camera, takes photo, shows AI results
4. Save Meal adds it to the dashboard
5. Manual entry with Estimate button fills in values from AI
6. Delete meal from dashboard works

- [ ] **Step 6: Commit**

```bash
git add .gitignore
git commit -m "feat: project gitignore and dev setup complete"
```
