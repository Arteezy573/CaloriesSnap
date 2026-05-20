# CaloriesSnap

A personal iPhone app that estimates calories and macros from food photos using AI, with daily intake goal tracking.

## Features

- **Photo Analysis** — Take a photo of your meal, get instant calorie and macro estimates powered by Claude Vision
- **Manual Entry** — Type a food name and let AI estimate the nutrition, or enter values manually
- **Daily Goals** — Set daily targets for calories, protein, carbs, and fat
- **Dashboard** — Track progress with a calorie ring, macro progress bars, and meal history
- **Editable Results** — Review and adjust AI estimates before saving

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo |
| Backend | Python + FastAPI |
| Database | SQLite |
| AI | Claude Vision API (Anthropic) |
| Dev Tunnel | ngrok |

## Architecture

```
iPhone (Expo Go)
    │
    ▼
ngrok tunnel
    │
    ▼
FastAPI backend (local)
    ├── Claude Vision API
    └── SQLite database
```

The app sends requests to a local FastAPI server exposed via ngrok. The backend handles all AI calls and stores data in SQLite. API keys stay on the server.

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/settings/keys)
- [ngrok](https://ngrok.com/) account (free tier works)
- iPhone with [Expo Go](https://expo.dev/go) installed

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env` with your API key:

```
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

Start the server:

```bash
uvicorn main:app --reload
```

The API runs at `http://localhost:8000`. Visit `http://localhost:8000/docs` for the Swagger UI.

### ngrok Setup

```bash
ngrok http 8000
```

Copy the forwarding URL (e.g. `https://abc123.ngrok-free.app`).

### Mobile Setup

```bash
cd mobile
npm install
```

Create `mobile/.env` with your ngrok URL:

```
EXPO_PUBLIC_API_URL=https://abc123.ngrok-free.app
```

Start the app:

```bash
npx expo start
```

Scan the QR code with your iPhone camera to open in Expo Go.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/analyze` | Analyze a food photo for calories/macros |
| POST | `/api/analyze_text` | Estimate nutrition from a text description |
| POST | `/api/meals` | Save a meal |
| GET | `/api/meals?date=YYYY-MM-DD` | Get meals for a date |
| DELETE | `/api/meals/{id}` | Delete a meal |
| GET | `/api/goals` | Get daily goals |
| PUT | `/api/goals` | Update daily goals |
| GET | `/api/summary?date=YYYY-MM-DD` | Get daily totals vs goals |

## Project Structure

```
CaloriesSnap/
├── backend/
│   ├── main.py            # FastAPI app and routes
│   ├── models.py          # Pydantic request/response models
│   ├── database.py        # SQLite setup and queries
│   ├── analyzer.py        # Claude Vision integration
│   ├── requirements.txt
│   ├── .env               # API key (not committed)
│   └── tests/             # Backend tests (30 tests)
├── mobile/
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── index.tsx  # Dashboard screen
│   │   │   ├── snap.tsx   # Camera + manual entry screen
│   │   │   └── goals.tsx  # Goal settings screen
│   │   └── _layout.tsx    # Root layout
│   ├── components/        # MacroBar, MealCard, FoodItemRow
│   ├── services/
│   │   └── api.ts         # Typed API client
│   └── .env               # ngrok URL (not committed)
└── docs/                  # Design spec and implementation plan
```
