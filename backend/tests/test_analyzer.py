from unittest.mock import MagicMock

import pytest

from analyzer import SYSTEM_PROMPT, FoodAnalysis, analyze_image, analyze_text
from models import FoodItem


MOCK_ANALYSIS = FoodAnalysis(
    foods=[
        FoodItem(
            name="Grilled Chicken Breast",
            quantity="1 piece, ~200g",
            calories=350,
            protein_g=42.0,
            carbs_g=0.0,
            fat_g=8.5,
        )
    ],
    confidence="high",
)

MOCK_EMPTY_ANALYSIS = FoodAnalysis(foods=[], confidence="low")


def _mock_client(analysis: FoodAnalysis) -> MagicMock:
    client = MagicMock()
    client.messages.parse.return_value = MagicMock(parsed_output=analysis)
    return client


def test_analyze_image_returns_foods():
    client = _mock_client(MOCK_ANALYSIS)
    result = analyze_image(client, b"fake-image-bytes", "image/jpeg")
    assert len(result.foods) == 1
    assert result.foods[0].name == "Grilled Chicken Breast"
    assert result.confidence == "high"
    assert result.total_calories == 350


def test_analyze_image_uses_current_model_and_structured_output():
    client = _mock_client(MOCK_ANALYSIS)
    analyze_image(client, b"fake-image-bytes", "image/jpeg")
    call_kwargs = client.messages.parse.call_args.kwargs
    assert call_kwargs["model"] == "claude-opus-4-8"
    assert call_kwargs["max_tokens"] >= 8192
    assert call_kwargs["output_format"] is FoodAnalysis
    assert call_kwargs["thinking"] == {"type": "adaptive"}
    user_content = call_kwargs["messages"][0]["content"]
    assert any(block.get("type") == "image" for block in user_content)


def test_analyze_image_empty_result():
    client = _mock_client(MOCK_EMPTY_ANALYSIS)
    result = analyze_image(client, b"fake-image-bytes", "image/jpeg")
    assert len(result.foods) == 0
    assert result.total_calories == 0


def test_analyze_text_returns_foods():
    client = _mock_client(MOCK_ANALYSIS)
    result = analyze_text(client, "grilled chicken breast, 200g")
    assert len(result.foods) == 1
    assert result.foods[0].calories == 350


def test_analyze_text_uses_structured_output():
    client = _mock_client(MOCK_ANALYSIS)
    analyze_text(client, "1 large apple")
    call_kwargs = client.messages.parse.call_args.kwargs
    assert call_kwargs["model"] == "claude-opus-4-8"
    assert call_kwargs["output_format"] is FoodAnalysis
    user_content = call_kwargs["messages"][0]["content"]
    assert isinstance(user_content, str)
    assert "1 large apple" in user_content


def test_prompt_decomposes_composite_dishes():
    prompt = SYSTEM_PROMPT.lower()
    assert "composite" in prompt or "mixed" in prompt
    assert "cooking oil" in prompt


def test_food_analysis_rejects_invalid_confidence():
    with pytest.raises(ValueError):
        FoodAnalysis(foods=[], confidence="very high")
