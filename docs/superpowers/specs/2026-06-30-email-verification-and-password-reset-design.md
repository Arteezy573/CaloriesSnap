# Email Verification & Password Reset — Design

**Date:** 2026-06-30
**Status:** Approved (pending spec review)

## Summary

Add self-service **password reset** and **signup email verification** to CaloriesSnap.
Both features share one foundation: a Resend-backed email service and a single-use,
time-limited 6-digit code mechanism. Signup verification is a **hard gate** — accounts
cannot use the app until their email is verified. Existing users are grandfathered as
already-verified.

## Goals

- Users who forget their password can reset it via a code emailed to them.
- New signups must verify ownership of their email before using the app.
- No plaintext codes stored; codes expire and are single-use with abuse limits.
- Email delivery is abstracted so the provider can be swapped and so the flow is
  fully testable without network access.

## Non-Goals

- Magic links / deep-linking (codes are typed in-app).
- Changing the existing invite-code gate on registration (it stays).
- Multi-factor auth, account lockout policies beyond per-code attempt limits.
- Email change / re-verification of an already-verified address.

## Decisions

| Decision | Choice |
|---|---|
| Email provider | **Resend** (HTTP API), abstracted behind an interface |
| Token format | **6-digit numeric code**, typed in the app |
| Code lifetime | 15 minutes, single-use |
| Code storage | bcrypt hash (never plaintext) |
| Wrong-attempt limit | 5 per code, then invalidated |
| Resend cooldown | 60 seconds |
| Verification policy | **Hard gate** — no app usage until verified |
| Existing users | Grandfathered to `email_verified = 1` |
| Enumeration defense | `forgot-password` always returns generic success |

## Architecture

### 1. Email service (`backend/email_service.py`)

- `EmailSender` interface: `send(to: str, subject: str, body: str) -> None`.
- `ResendEmailSender` — posts to the Resend API using `RESEND_API_KEY` and `EMAIL_FROM`.
- `LoggingEmailSender` — logs the message instead of sending. Used automatically when
  `RESEND_API_KEY` is unset (local dev) and injected as a fake in tests.
- Provided via a FastAPI dependency (`get_email_sender`) so tests can override it and
  read back the code that "would have been sent."

### 2. Code mechanism (`backend/codes.py` + helpers in `database.py`)

Pure/util logic for generating, persisting, and validating codes:

- `generate_code() -> str` — 6 random digits.
- Persist: store bcrypt `code_hash`, `purpose`, `expires_at = now + 15m`, `created_at`.
- Validate: check not expired, not consumed, attempts < 5; on wrong code increment
  `attempts`; on success set `consumed_at`.
- Cooldown: reject a resend if the most recent code for `(user, purpose)` was created
  within 60 seconds.

### 3. Data model

New table `email_codes`:

| column | type | purpose |
|---|---|---|
| `id` | INTEGER PK | |
| `user_id` | INTEGER FK → users(id) | owner |
| `purpose` | TEXT | `'verify'` or `'reset'` |
| `code_hash` | TEXT | bcrypt hash of the 6-digit code |
| `expires_at` | TEXT (ISO) | now + 15 min |
| `attempts` | INTEGER DEFAULT 0 | wrong-attempt counter |
| `consumed_at` | TEXT NULL | set when used (single-use) |
| `created_at` | TEXT (ISO) | for resend-cooldown checks |

New column on `users`:

- `email_verified INTEGER NOT NULL DEFAULT 0`.
- Migration backfills **existing rows to `1`** (grandfathered).

## API Endpoints (`backend/main.py`)

### Signup verification (hard gate)

- `POST /api/register` — validates invite code, creates user with `email_verified=0`,
  generates a `verify` code, emails it. Returns **201** `{email, verification_required: true}`
  with **no auth token** (changed from current behavior).
- `POST /api/verify-email` — `{email, code}`. On success marks `email_verified=1`,
  consumes the code, returns `AuthResponse` (token + user) so the user lands logged in.
- `POST /api/resend-verification` — `{email}`. Re-issues a `verify` code subject to the
  60-second cooldown. Generic success response.
- `POST /api/login` — if user exists, password correct, but `email_verified=0` →
  **403** with `detail = "email_not_verified"` so the client routes to the verify screen.
  Otherwise unchanged.

### Password reset

- `POST /api/forgot-password` — `{email}`. If a **verified** user exists, generate a
  `reset` code and email it. **Always returns 200** with a generic message to prevent
  enumeration.
- `POST /api/reset-password` — `{email, code, new_password}` (`new_password` min length 6).
  Validates the code, updates `password_hash`, consumes the code. Returns generic success;
  client routes to login.

### Models (`backend/models.py`)

New request/response models: `VerifyEmailRequest`, `ResendVerificationRequest`,
`ForgotPasswordRequest`, `ResetPasswordRequest`, `RegisterPendingResponse`,
`GenericMessageResponse`. `new_password` reuses the `min_length=6` rule from `RegisterRequest`.

## Frontend (Expo — `mobile/`)

### API client (`services/api.ts`)

New functions: `verifyEmail(email, code)`, `resendVerification(email)`,
`forgotPassword(email)`, `resetPassword(email, code, newPassword)`.
`register()` return type changes to `{ email: string; verification_required: boolean }`.

### Screens (`app/(auth)/`)

- **`verify-email.tsx`** *(new)* — 6-digit code input + "Resend code" with a cooldown
  countdown. On success stores the token and enters the app. Reached after register and
  after a login that returns `email_not_verified`.
- **`forgot-password.tsx`** *(new)* — email input → `forgotPassword`, then navigates to
  the reset screen with a generic "check your email" message.
- **`reset-password.tsx`** *(new)* — code + new-password inputs → `resetPassword`, then
  routes back to login with a success message.
- **`login.tsx`** *(edit)* — add a "Forgot password?" link; handle `403 email_not_verified`
  by routing to `verify-email`.
- **`register.tsx`** *(edit)* — after successful register, route to `verify-email` instead
  of logging straight in.

All screens reuse the existing `components/ui` kit (`Input`, `Button`) and `theme.ts`
tokens, consistent with the shipped design system.

## Configuration

New env vars (alongside `JWT_SECRET`, `INVITE_CODE`):

- `RESEND_API_KEY` — when unset, the backend falls back to `LoggingEmailSender`.
- `EMAIL_FROM` — verified sender address for Resend.

## Testing (TDD, backend-first)

- **`backend/tests/test_email_codes.py`** *(new)* — code generation, hashing, expiry,
  attempt-limit invalidation, single-use, resend cooldown.
- **`backend/tests/test_auth.py`** *(extend)* — register-now-unverified (no token),
  verify-email happy/expired/wrong-code, login-blocked-when-unverified, forgot/reset
  happy path, generic response, and enumeration (unknown email still 200) paths.
  Tests inject `LoggingEmailSender` (or a capturing fake) and read the generated code
  through the service.
- **Frontend** — manual verification of the new/edited screens, matching the project's
  current backend-focused test footprint.

## Risks / Notes

- 6-digit space is small (1M); mitigated by 15-min expiry, single-use, and the 5-attempt
  limit per code.
- `login` returning `email_not_verified` reveals that an email exists+unverified; this is
  consistent with the existing `409 email already registered` on register, and acceptable
  for an invite-only app.
- Resend requires a verified sender domain in production; until configured, dev uses the
  logging sender.
