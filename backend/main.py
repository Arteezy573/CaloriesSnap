import os
from contextlib import asynccontextmanager

from anthropic import Anthropic
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import get_db, init_db, get_goals, update_goals
from models import GoalsRequest, GoalsResponse


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
