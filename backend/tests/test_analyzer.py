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
