# User Authentication & Data Isolation

## Overview

Add email+password authentication so each user has their own meals, goals, and data. JWT-based stateless auth. Minimal scope: register, login, logout, data isolation. No profile editing, password reset, or social login.

## Backend Changes

### New: Users Table

```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);
```

### Modified: Meals Table

Add `user_id` column:

```sql
CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('photo', 'manual')),
    image_path TEXT,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Modified: Goals Table

Replace single-row design with per-user rows:

```sql
CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    calories INTEGER NOT NULL DEFAULT 2000,
    protein_g INTEGER NOT NULL DEFAULT 150,
    carbs_g INTEGER NOT NULL DEFAULT 250,
    fat_g INTEGER NOT NULL DEFAULT 65,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### New API Endpoints

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/register` | `{email, password}` | `{token, user: {id, email}}` |
| POST | `/api/login` | `{email, password}` | `{token, user: {id, email}}` |

- Register: validate email format, check uniqueness (409 if duplicate), hash password with bcrypt, create user, return JWT.
- Login: find user by email, verify password (401 on mismatch with generic error), return JWT.

### JWT Details

- Package: `PyJWT`
- Payload: `{user_id: int, email: str, exp: datetime}` with 30-day expiry
- Signing: HS256 with a `JWT_SECRET` from environment (generate a default for dev)
- Header format: `Authorization: Bearer <token>`

### Auth Dependency

New `get_current_user()` FastAPI dependency:
- Extracts Bearer token from Authorization header
- Decodes and validates JWT
- Returns user dict `{id, email}`
- Raises 401 if missing, expired, or invalid

### Modified Existing Endpoints

All existing endpoints gain `user = Depends(get_current_user)`:
- `POST /api/meals` — sets `user_id` from authenticated user
- `GET /api/meals` — filters by `user_id`
- `DELETE /api/meals/{id}` — verifies meal belongs to user
- `GET /api/goals` — returns goals for user (creates default row if none)
- `PUT /api/goals` — upserts goals for user
- `GET /api/summary` — scoped to user
- `POST /api/analyze` and `POST /api/analyze_text` — no data access, but still require auth

### Password Hashing

- Package: `bcrypt`
- Hash on register, verify on login

### New Dependencies

- `PyJWT`
- `bcrypt`

## Mobile Changes

### New Dependency

- `expo-secure-store` — encrypted native storage for JWT token

### New Files

- `app/(auth)/login.tsx` — email + password fields, login button, link to register
- `app/(auth)/register.tsx` — email + password + confirm password fields, register button, link to login
- `services/auth.ts` — token storage/retrieval/clearing via SecureStore

### Navigation Guard

In `app/_layout.tsx`:
- On mount, check SecureStore for a stored JWT
- If valid token → render `(tabs)` layout
- If no token or expired → render `(auth)` layout
- Use Expo Router redirect pattern

### API Client Changes (`services/api.ts`)

- Import token getter from `services/auth.ts`
- Attach `Authorization: Bearer <token>` header to all requests
- Add `register(email, password)` and `login(email, password)` functions
- On 401 response from any call, clear stored token and redirect to login

### Logout

- Button in the Goals tab (or header)
- Clears SecureStore token
- Navigates to login screen

## Edge Cases

- Duplicate email on register: 409 Conflict, message "Email already registered"
- Invalid credentials on login: 401, message "Invalid email or password"
- Expired/invalid token: 401 from any endpoint, mobile clears token and redirects to login
- No password reset: out of scope. User registers a new account if they forget.

## Migration Strategy

No production users exist yet. Drop and recreate tables with new schema on backend startup (or just delete the SQLite file and let init recreate it).

## What Does Not Change

- AI analyzer logic (`analyzer.py`)
- Image upload/resize handling
- Food items table (inherits user scoping through meals FK)
- Dashboard, Snap, Goals screen UI (just requires auth gate to access)
- CORS configuration
