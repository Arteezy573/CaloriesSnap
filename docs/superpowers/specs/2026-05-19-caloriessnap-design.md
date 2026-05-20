# CaloriesSnap — Design Spec

A personal iPhone app for estimating calories and macros from food photos, with daily intake goal tracking.

## Overview

CaloriesSnap lets you snap a photo of your meal, get an AI-powered calorie and macro estimate, review/edit the results, and track progress against daily goals. You can also manually enter foods. The app is for single-user (personal) use during development, with the backend running locally and exposed via ngrok.

## Architecture

**Approach: Backend-Centric**

```
iPhone (React Native + Expo)
    │
    ├── POST /api/analyze  (photo upload)
    ├── POST /api/meals    (save confirmed meal)
    ├── GET  /api/meals    (fetch meals by date)
    ├── DELETE /api/meals/{id}
    ├── GET  /api/goals
    ├── PUT  /api/goals
    └── GET  /api/summary  (daily totals vs goals)
    │
    ▼
ngrok tunnel (dev)
    │
    ▼
FastAPI backend (local)
    ├── Claude Vision API (food analysis)
    └── SQLite database
```

- The React Native app sends all requests to the FastAPI backend through ngrok
- The backend holds the Anthropic API key, calls Claude Vision, and stores all data in SQLite
- Photos are saved as files on disk; the database stores file paths

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Mobile app  | React Native + Expo               |
| Backend     | Python + FastAPI                   |
| Database    | SQLite                             |
| AI          | Claude Vision API (Anthropic SDK)  |
| Dev tunnel  | ngrok                              |

## Database Schema

### goals

| Column     | Type     | Notes              |
|------------|----------|---------------------|
| id         | INTEGER  | Primary key         |
| calories   | INTEGER  | e.g. 2000           |
| protein_g  | INTEGER  | e.g. 150            |
| carbs_g    | INTEGER  | e.g. 250            |
| fat_g      | INTEGER  | e.g. 65             |
| updated_at | DATETIME |                     |

Single row — update replaces it.

### meals

| Column     | Type     | Notes                          |
|------------|----------|--------------------------------|
| id         | INTEGER  | Primary key                    |
| date       | DATE     | e.g. 2026-05-19               |
| time       | DATETIME | When the meal was logged       |
| source     | TEXT     | "photo" or "manual"            |
| image_path | TEXT     | Nullable, path to saved photo  |
| notes      | TEXT     | Nullable                       |

### food_items

| Column    | Type    | Notes                           |
|-----------|---------|---------------------------------|
| id        | INTEGER | Primary key                     |
| meal_id   | INTEGER | FK → meals.id (cascade delete)  |
| name      | TEXT    | e.g. "Grilled Chicken Breast"   |
| calories  | INTEGER | e.g. 350                        |
| protein_g | REAL    | e.g. 42.0                       |
| carbs_g   | REAL    | e.g. 0.0                        |
| fat_g     | REAL    | e.g. 8.5                        |
| quantity  | TEXT    | e.g. "1 piece, ~200g"           |

A single meal can have multiple food items (one photo may contain several foods).

## API Endpoints

### POST /api/analyze

Analyze food for calorie/macro estimation. Accepts either an image upload (photo mode) or a text description (manual estimation mode). Does NOT save to database — this is a preview step.

**Request (photo):** multipart/form-data with image file

**Request (text estimation):** `application/json` with `{"food_description": "1 large apple"}`

**Response:**
```json
{
  "foods": [
    {
      "name": "Grilled Chicken Breast",
      "quantity": "1 piece, ~200g",
      "calories": 350,
      "protein_g": 42.0,
      "carbs_g": 0.0,
      "fat_g": 8.5
    }
  ],
  "confidence": "high",
  "total_calories": 650
}
```

### POST /api/meals

Save a meal (confirmed AI result or manual entry).

**Request:**
```json
{
  "source": "photo",
  "image_path": "uploads/2026-05-19_123456.jpg",
  "foods": [
    {
      "name": "Grilled Chicken Breast",
      "quantity": "1 piece, ~200g",
      "calories": 350,
      "protein_g": 42.0,
      "carbs_g": 0.0,
      "fat_g": 8.5
    }
  ],
  "notes": ""
}
```

### GET /api/meals?date=YYYY-MM-DD

Returns all meals and their food items for a given date.

### DELETE /api/meals/{id}

Deletes a meal and its food items (cascade).

### GET /api/goals

Returns the current daily goals.

### PUT /api/goals

Updates daily calorie and macro goals.

**Request:**
```json
{
  "calories": 2000,
  "protein_g": 150,
  "carbs_g": 250,
  "fat_g": 65
}
```

### GET /api/summary?date=YYYY-MM-DD

Returns daily totals compared to goals.

**Response:**
```json
{
  "date": "2026-05-19",
  "goals": { "calories": 2000, "protein_g": 150, "carbs_g": 250, "fat_g": 65 },
  "consumed": { "calories": 1240, "protein_g": 85, "carbs_g": 140, "fat_g": 38 },
  "remaining": { "calories": 760, "protein_g": 65, "carbs_g": 110, "fat_g": 27 },
  "meals_count": 3
}
```

## App Screens

### 1. Dashboard (Home tab)

- Date header (today)
- Calorie ring showing consumed / goal with percentage
- Macro progress bars: protein (red), carbs (yellow), fat (blue) with current/goal values
- Scrollable list of today's meals, each showing: source icon (camera or pencil), food summary text, total calories

### 2. Snap (Snap tab)

Default state: camera preview with capture button. Also has a "Type instead" link to switch to manual entry mode.

**After photo capture:**
- Shows the captured photo
- Loading spinner while AI analyzes
- Results view: list of detected food items, each with name, quantity, calories, macros
- All fields are editable (tap to modify)
- Total calories bar at bottom
- "Edit" and "Save Meal" action buttons

**Manual entry mode:**
- Food name text field
- Calories field
- Protein/carbs/fat fields in a row
- "Estimate" button — sends food name to backend, Claude estimates calories/macros and fills fields
- "Save" button

### 3. Goals (Goals tab)

- Editable fields for daily calories, protein, carbs, fat targets
- "Save Goals" button

### Navigation

Bottom tab bar with 3 tabs: Home, Snap, Goals. Color-coded macros (protein=red, carbs=yellow, fat=blue) are consistent across all screens. Dark theme.

## Claude Vision Integration

### Prompt Strategy

The backend sends the food photo to Claude Vision with a system prompt that:
- Instructs Claude to identify all visible foods in the image
- Requests structured JSON output matching a defined schema
- Asks for quantity estimates (weight or common portions)
- Asks for per-item calorie and macro breakdown
- Includes a confidence rating (high/medium/low)

### Response Validation

- Backend validates the Claude response against a Pydantic model
- Malformed responses are caught and the user sees a friendly error with option to retry or enter manually

### Image Preprocessing

- Photos are resized to max 1024px on the long edge before sending to Claude
- Reduces API cost and latency

### Manual Entry Estimation

When the user types a food name and taps "Estimate," the backend sends a text-only prompt to Claude asking for calorie/macro estimates for that food. Same structured JSON response format.

### Error Handling

- **Non-food images:** Claude returns empty foods array with a message; app shows "No food detected"
- **API timeout:** 30-second timeout; app shows loading spinner then "retry or enter manually" on failure
- **Low confidence:** App displays a warning banner encouraging the user to review the estimates
- **Network errors:** App shows offline message with option to retry

## Project Structure

```
CaloriesSnap/
├── backend/
│   ├── main.py              # FastAPI app, routes
│   ├── models.py            # Pydantic models
│   ├── database.py          # SQLite setup, queries
│   ├── analyzer.py          # Claude Vision integration
│   ├── requirements.txt
│   └── uploads/             # Saved food photos
├── mobile/
│   ├── app/                 # Expo Router screens
│   │   ├── (tabs)/
│   │   │   ├── index.tsx    # Dashboard
│   │   │   ├── snap.tsx     # Camera + results
│   │   │   └── goals.tsx    # Goal settings
│   │   └── _layout.tsx      # Tab navigation
│   ├── components/          # Shared components
│   ├── services/
│   │   └── api.ts           # Backend API client
│   ├── package.json
│   └── app.json
└── docs/
```

## Development Setup

1. Backend: `pip install -r requirements.txt && uvicorn main:app --reload`
2. ngrok: `ngrok http 8000` — copy the public URL
3. Mobile: Set ngrok URL in app config, `npx expo start`, scan QR with Expo Go on iPhone
