import base64
from typing import Literal

from anthropic import Anthropic
from pydantic import BaseModel

from models import AnalyzeResponse, FoodItem

MODEL = "claude-opus-4-8"
MAX_TOKENS = 16000

SYSTEM_PROMPT = """You are a food nutrition analyzer. When given a food image or text description, identify all foods and estimate their nutritional content.

Rules:
- List every distinct food visible in the image or described in the text
- For composite or mixed dishes (stir-fries, braises, curries, fried rice, noodle soups, dumplings, casseroles), identify the dish by name first, then list each major component as its own item — e.g. "Mapo Tofu" becomes tofu, ground pork, and chili oil sauce
- Always include cooking oil, butter, or sauces as a separate item when the cooking method implies them (stir-fried, deep-fried, braised, dressed) — restaurant dishes typically use 1-2 tablespoons of oil
- Be cuisine-aware: recognize dishes from Chinese, Japanese, Korean, Southeast Asian, Indian, Mexican, and Western cuisines by name, and use typical recipes for that cuisine to infer hidden ingredients (sugar in red-braised dishes, coconut milk in curries)
- Estimate portion sizes from visual cues (plate size, utensils, container) or the description
- Provide realistic calorie and macro estimates per item
- confidence is "high" when foods and portions are clearly identifiable, "medium" when the dish is recognizable but portions or ingredients are uncertain, "low" when guessing
- If no food is detected, return an empty foods array with "low" confidence"""


class FoodAnalysis(BaseModel):
    foods: list[FoodItem]
    confidence: Literal["high", "medium", "low"]


def _to_response(analysis: FoodAnalysis) -> AnalyzeResponse:
    return AnalyzeResponse(foods=analysis.foods, confidence=analysis.confidence)


def analyze_image(
    client: Anthropic, image_bytes: bytes, media_type: str, hint: str | None = None
) -> AnalyzeResponse:
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    instruction = "Identify all foods in this image and estimate their calories and macronutrients."
    if hint:
        instruction += (
            f'\n\nUser hint about this meal: "{hint}". '
            "Use it to identify the dish and its typical ingredients."
        )
    response = client.messages.parse(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        thinking={"type": "adaptive"},
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
                        "text": instruction,
                    },
                ],
            }
        ],
        output_format=FoodAnalysis,
    )
    return _to_response(response.parsed_output)


def analyze_text(client: Anthropic, food_description: str) -> AnalyzeResponse:
    response = client.messages.parse(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        thinking={"type": "adaptive"},
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Estimate the calories and macronutrients for: {food_description}",
            }
        ],
        output_format=FoodAnalysis,
    )
    return _to_response(response.parsed_output)
