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


from models import (
    VerifyEmailRequest,
    ResendVerificationRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    RegisterPendingResponse,
    GenericMessageResponse,
)
import pytest
from pydantic import ValidationError


def test_verify_email_normalizes_email():
    req = VerifyEmailRequest(email="  Foo@Bar.COM ", code="123456")
    assert req.email == "foo@bar.com"


def test_verify_email_requires_six_digit_code():
    with pytest.raises(ValidationError):
        VerifyEmailRequest(email="a@b.com", code="123")


def test_reset_password_requires_min_length_password():
    with pytest.raises(ValidationError):
        ResetPasswordRequest(email="a@b.com", code="123456", new_password="123")


def test_register_pending_response_shape():
    r = RegisterPendingResponse(email="a@b.com", verification_required=True)
    assert r.verification_required is True


def test_generic_message_response_shape():
    assert GenericMessageResponse(message="ok").message == "ok"
