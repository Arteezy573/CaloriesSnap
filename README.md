# CaloriesSnap

A personal iPhone app that estimates calories and macros from food photos using AI, with daily intake goal tracking.

## Features

- **Photo Analysis** — Take a photo of your meal, get instant calorie and macro estimates powered by Claude Vision
- **Manual Entry** — Type a food name and let AI estimate the nutrition, or enter values manually
- **Daily Goals** — Set daily targets for calories, protein, carbs, and fat
- **Dashboard** — Track progress with a calorie ring, macro progress bars, and meal history
- **Editable Results** — Review and adjust AI estimates before saving
- **User Authentication** — Email/password registration with JWT tokens, per-user data isolation
- **Invite Code** — Registration requires an invite code to prevent unauthorized usage
- **Rate Limiting** — Daily limit on AI analysis calls to control API costs

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo SDK 54 |
| Backend | Python 3.13 + FastAPI |
| Database | SQLite (WAL mode) |
| AI | Claude Vision API (Anthropic) |
| Auth | JWT (PyJWT) + bcrypt |
| Hosting | Azure App Service (Linux) |
| Storage | Azure Files (persistent SQLite + uploads) |
| CI/CD | GitHub Actions |

## Architecture

```
iPhone (Expo Go / standalone build)
    │
    ▼
Azure App Service (caloriessnap.azurewebsites.net)
    ├── FastAPI + gunicorn
    ├── Claude Vision API
    └── Azure Files (/mnt/data)
        ├── caloriessnap.db
        └── uploads/
```

The mobile app sends requests to the FastAPI backend hosted on Azure App Service. The backend handles authentication, AI calls, and stores data in SQLite. API keys stay on the server. The database and uploaded images are persisted on an Azure Files share that survives deployments and restarts.

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/settings/keys)
- iPhone with [Expo Go](https://expo.dev/go) installed

### Backend Setup (Local Development)

```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
JWT_SECRET=dev-secret-change-in-production
INVITE_CODE=caloriessnap2026
```

Start the server:

```bash
uvicorn main:app --reload
```

The API runs at `http://localhost:8000`. Visit `http://localhost:8000/docs` for the Swagger UI.

### Mobile Setup

```bash
cd mobile
npm install
```

Create `mobile/.env`:

```
EXPO_PUBLIC_API_URL=https://caloriessnap.azurewebsites.net
```

For local development, use ngrok or your local IP instead:

```
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000
```

Start the app:

```bash
npx expo start
```

Scan the QR code with your iPhone camera to open in Expo Go.

### Running Tests

```bash
cd backend
python -m pytest -v
```

## API Endpoints

All endpoints except register and login require a `Bearer` token in the `Authorization` header.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/register` | No | Create account (requires invite code) |
| POST | `/api/login` | No | Log in, get JWT token |
| POST | `/api/analyze` | Yes | Analyze a food photo, optional `food_description` hint (rate limited) |
| POST | `/api/analyze_text` | Yes | Estimate nutrition from text (rate limited) |
| POST | `/api/meals` | Yes | Save a meal |
| GET | `/api/meals?date=YYYY-MM-DD` | Yes | Get meals for a date |
| PUT | `/api/meals/{id}` | Yes | Edit a meal's foods/notes |
| DELETE | `/api/meals/{id}` | Yes | Delete a meal |
| GET | `/api/goals` | Yes | Get daily goals |
| PUT | `/api/goals` | Yes | Update daily goals |
| GET | `/api/summary?date=YYYY-MM-DD` | Yes | Get daily totals vs goals |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Claude API key (required) |
| `JWT_SECRET` | `dev-secret-change-in-production` | Secret for signing JWT tokens |
| `DB_PATH` | `caloriessnap.db` | Path to SQLite database |
| `UPLOAD_DIR` | `uploads` | Directory for uploaded images |
| `INVITE_CODE` | `caloriessnap2026` | Required code for registration |
| `DAILY_ANALYZE_LIMIT` | `20` | Max AI analyses per user per day |

## Deployment

The backend is deployed to Azure App Service via GitHub Actions. Pushing to `master` with changes in `backend/` triggers the pipeline, which runs tests and deploys automatically.

Azure resources:
- **App Service**: B1 Linux plan running Python 3.13 with gunicorn
- **Azure Files**: Mounted at `/mnt/data` for persistent SQLite and uploads

## Project Structure

```
CaloriesSnap/
├── .github/workflows/
│   └── deploy-backend.yml  # CI/CD pipeline
├── backend/
│   ├── main.py             # FastAPI app and routes
│   ├── models.py           # Pydantic request/response models
│   ├── database.py         # SQLite setup and queries
│   ├── analyzer.py         # Claude Vision integration
│   ├── auth.py             # Password hashing, JWT, auth dependency
│   ├── startup.sh          # Gunicorn startup for Azure
│   ├── requirements.txt
│   ├── .env                # Local env vars (not committed)
│   └── tests/              # Backend tests (72 tests)
├── mobile/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login.tsx   # Login screen
│   │   │   └── register.tsx # Registration screen
│   │   ├── (tabs)/
│   │   │   ├── index.tsx   # Dashboard screen
│   │   │   ├── snap.tsx    # Camera + manual entry screen
│   │   │   └── goals.tsx   # Goal settings + logout
│   │   └── _layout.tsx     # Root layout with auth guard
│   ├── components/         # MacroBar, MealCard, FoodItemRow
│   ├── services/
│   │   ├── api.ts          # Typed API client
│   │   └── auth.ts         # Token storage (expo-secure-store)
│   └── .env                # API URL (not committed)
└── docs/                   # Design specs and implementation plans
```
