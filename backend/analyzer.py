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
