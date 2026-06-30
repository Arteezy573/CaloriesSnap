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
    image_path: Optional[str] = None

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
    goal_weight_kg: Optional[float] = Field(default=None, gt=0)


class GoalsResponse(BaseModel):
    id: int
    calories: int
    protein_g: int
    carbs_g: int
    fat_g: int
    goal_weight_kg: Optional[float] = None
    updated_at: str


class MealRequest(BaseModel):
    source: str
    image_path: Optional[str] = None
    foods: list[FoodItem]
    notes: Optional[str] = None
    date: Optional[str] = None

    @field_validator("source")
    @classmethod
    def validate_source(cls, v: str) -> str:
        if v not in ("photo", "manual"):
            raise ValueError("source must be 'photo' or 'manual'")
        return v


class MealUpdateRequest(BaseModel):
    foods: list[FoodItem] = Field(min_length=1)
    notes: Optional[str] = None


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
    calories_burned: int = 0
    exercise_count: int = 0
    meals_count: int


class SaveMealRequest(BaseModel):
    name: str = Field(min_length=1)
    foods: list[FoodItem]


class SavedMealResponse(BaseModel):
    id: int
    name: str
    foods: list[FoodItemResponse]
    total_calories: int
    created_at: str


class HistoryEntry(BaseModel):
    date: str
    calories: int
    protein_g: float
    carbs_g: float
    fat_g: float
    meals_count: int


class WeightLogRequest(BaseModel):
    date: str = Field(min_length=1)
    weight_kg: float = Field(gt=0)
    note: Optional[str] = None


class WeightLogResponse(BaseModel):
    id: int
    date: str
    weight_kg: float
    note: Optional[str] = None
    created_at: str


class ExerciseRequest(BaseModel):
    date: str = Field(min_length=1)
    name: str = Field(min_length=1)
    duration_min: int = Field(ge=0)
    calories_burned: int = Field(ge=0)


class ExerciseResponse(BaseModel):
    id: int
    date: str
    name: str
    duration_min: int
    calories_burned: int
    created_at: str


class RegisterRequest(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=6)
    invite_code: str = Field(min_length=1)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email format")
        return v.lower().strip()


class LoginRequest(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=1)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return v.lower().strip()


class UserResponse(BaseModel):
    id: int
    email: str


class AuthResponse(BaseModel):
    token: str
    user: UserResponse
