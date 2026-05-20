import os
import shutil
import uuid
from contextlib import asynccontextmanager
from datetime import date
from io import BytesIO
from pathlib import Path

from anthropic import Anthropic
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image as PILImage

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

UPLOAD_DIR = Path("uploads")
MAX_IMAGE_DIMENSION = 1024


def get_db_conn():
    return _db_conn


def resize_image(image_bytes: bytes, max_dim: int = MAX_IMAGE_DIMENSION) -> bytes:
    img = PILImage.open(BytesIO(image_bytes))
    if max(img.size) > max_dim:
        img.thumbnail((max_dim, max_dim))
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _db_conn, anthropic_client
    db_path = os.environ.get("DB_PATH", "caloriessnap.db")
    _db_conn = get_db(db_path)
    init_db(_db_conn)
    anthropic_client = Anthropic()
    UPLOAD_DIR.mkdir(exist_ok=True)
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
