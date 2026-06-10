import os
import uuid
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()
from datetime import date
from io import BytesIO
from pathlib import Path

import anyio.to_thread
from anthropic import Anthropic
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image as PILImage

from analyzer import analyze_image, analyze_text
from auth import get_current_user, hash_password, verify_password, create_token
from database import (
    count_api_calls_today,
    create_meal,
    create_saved_meal,
    create_user,
    delete_meal,
    delete_saved_meal,
    get_daily_summary,
    get_db,
    get_goals,
    get_history,
    get_meals_by_date,
    get_saved_meals,
    get_user_by_email,
    init_db,
    record_api_call,
    update_goals,
)
from models import (
    AnalyzeResponse,
    AuthResponse,
    GoalsRequest,
    GoalsResponse,
    HistoryEntry,
    LoginRequest,
    MealRequest,
    MealResponse,
    RegisterRequest,
    SaveMealRequest,
    SavedMealResponse,
    SummaryResponse,
    TextAnalyzeRequest,
)

_db_conn = None
anthropic_client = None

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "uploads"))
MAX_IMAGE_DIMENSION = 1568
INVITE_CODE = os.environ.get("INVITE_CODE", "caloriessnap2026")
DAILY_ANALYZE_LIMIT = int(os.environ.get("DAILY_ANALYZE_LIMIT", "20"))


def get_db_conn():
    return _db_conn


def resize_image(image_bytes: bytes, max_dim: int = MAX_IMAGE_DIMENSION) -> bytes:
    img = PILImage.open(BytesIO(image_bytes))
    if img.mode != "RGB":
        img = img.convert("RGB")
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


@app.post("/api/register", response_model=AuthResponse, status_code=201)
def register(req: RegisterRequest, conn=Depends(get_db_conn)):
    if req.invite_code != INVITE_CODE:
        raise HTTPException(status_code=403, detail="Invalid invite code")
    password_hash = hash_password(req.password)
    user_id = create_user(conn, email=req.email, password_hash=password_hash)
    if user_id is None:
        raise HTTPException(status_code=409, detail="Email already registered")
    token = create_token(user_id=user_id, email=req.email)
    return {"token": token, "user": {"id": user_id, "email": req.email}}


@app.post("/api/login", response_model=AuthResponse)
def login(req: LoginRequest, conn=Depends(get_db_conn)):
    user = get_user_by_email(conn, req.email)
    if user is None or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user_id=user["id"], email=user["email"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"]}}


@app.get("/api/goals", response_model=GoalsResponse)
def read_goals(conn=Depends(get_db_conn), user=Depends(get_current_user)):
    return get_goals(conn, user["id"])


@app.put("/api/goals", response_model=GoalsResponse)
def set_goals(req: GoalsRequest, conn=Depends(get_db_conn), user=Depends(get_current_user)):
    return update_goals(conn, user["id"], req.calories, req.protein_g, req.carbs_g, req.fat_g)


def check_rate_limit(conn, user_id: int):
    if count_api_calls_today(conn, user_id) >= DAILY_ANALYZE_LIMIT:
        raise HTTPException(status_code=429, detail=f"Daily limit of {DAILY_ANALYZE_LIMIT} analyses reached")


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_food(
    file: UploadFile | None = File(None),
    food_description: str | None = Form(None),
    conn=Depends(get_db_conn),
    user=Depends(get_current_user),
):
    check_rate_limit(conn, user["id"])
    if file:
        raw_bytes = await file.read()
        resized = resize_image(raw_bytes)
        filename = f"{date.today().isoformat()}_{uuid.uuid4().hex[:8]}.jpg"
        save_path = UPLOAD_DIR / filename
        save_path.write_bytes(resized)
        # resize_image always re-encodes to JPEG, regardless of the upload type.
        # The Anthropic client is synchronous — run it in a thread so the
        # multi-second AI call doesn't block the event loop.
        result = await anyio.to_thread.run_sync(
            lambda: analyze_image(anthropic_client, resized, "image/jpeg", hint=food_description)
        )
        result.image_path = f"uploads/{filename}"
        record_api_call(conn, user["id"], "analyze")
        return result
    elif food_description:
        result = analyze_text(anthropic_client, food_description)
        record_api_call(conn, user["id"], "analyze")
        return result
    else:
        raise HTTPException(status_code=400, detail="Provide either an image file or food_description")


@app.post("/api/analyze_text", response_model=AnalyzeResponse)
def analyze_food_text(req: TextAnalyzeRequest, conn=Depends(get_db_conn), user=Depends(get_current_user)):
    check_rate_limit(conn, user["id"])
    result = analyze_text(anthropic_client, req.food_description)
    record_api_call(conn, user["id"], "analyze_text")
    return result


@app.post("/api/meals", response_model=MealResponse)
def create_new_meal(req: MealRequest, conn=Depends(get_db_conn), user=Depends(get_current_user)):
    meal_date = req.date or date.today().isoformat()
    foods = [f.model_dump() for f in req.foods]
    meal_id = create_meal(
        conn,
        user_id=user["id"],
        date=meal_date,
        source=req.source,
        foods=foods,
        image_path=req.image_path,
        notes=req.notes,
    )
    meals = get_meals_by_date(conn, user["id"], meal_date)
    for m in meals:
        if m["id"] == meal_id:
            return m
    raise HTTPException(status_code=500, detail="Failed to retrieve created meal")


@app.get("/api/meals", response_model=list[MealResponse])
def read_meals(date: str, conn=Depends(get_db_conn), user=Depends(get_current_user)):
    return get_meals_by_date(conn, user["id"], date)


@app.delete("/api/meals/{meal_id}")
def remove_meal(meal_id: int, conn=Depends(get_db_conn), user=Depends(get_current_user)):
    deleted = delete_meal(conn, user["id"], meal_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Meal not found")
    return {"ok": True}


@app.get("/api/summary", response_model=SummaryResponse)
def read_summary(date: str, conn=Depends(get_db_conn), user=Depends(get_current_user)):
    return get_daily_summary(conn, user["id"], date)


@app.get("/api/history", response_model=list[HistoryEntry])
def read_history(start: str, end: str, conn=Depends(get_db_conn), user=Depends(get_current_user)):
    return get_history(conn, user["id"], start, end)


@app.post("/api/saved-meals", response_model=SavedMealResponse, status_code=201)
def save_meal_for_later(req: SaveMealRequest, conn=Depends(get_db_conn), user=Depends(get_current_user)):
    foods = [f.model_dump() for f in req.foods]
    saved_id = create_saved_meal(conn, user["id"], req.name, foods)
    saved = get_saved_meals(conn, user["id"])
    for s in saved:
        if s["id"] == saved_id:
            return s
    raise HTTPException(status_code=500, detail="Failed to retrieve saved meal")


@app.get("/api/saved-meals", response_model=list[SavedMealResponse])
def list_saved_meals(q: str | None = None, conn=Depends(get_db_conn), user=Depends(get_current_user)):
    return get_saved_meals(conn, user["id"], q)


@app.delete("/api/saved-meals/{saved_meal_id}")
def remove_saved_meal(saved_meal_id: int, conn=Depends(get_db_conn), user=Depends(get_current_user)):
    deleted = delete_saved_meal(conn, user["id"], saved_meal_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Saved meal not found")
    return {"ok": True}
