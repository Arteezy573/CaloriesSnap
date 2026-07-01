---
name: run-mobile-web
description: Launch and visually drive the CaloriesSnap Expo mobile app on Windows via its web target. Use when asked to run the app, screenshot it, or confirm a mobile UI change works (no iOS/Android emulator is available here).
---

# Run CaloriesSnap visually (Expo web + Playwright)

There is no iOS/Android emulator on this machine, and the app is React
Native (Expo Router). The only way to *see* the UI is the **web**
target, driven by headless Chromium (Playwright). This skill captures
the exact, verified recipe — backend + web bundle + seeded data + a
scripted login — so you can reach any screen (e.g. the Edit Meal modal)
and screenshot it.

All helper scripts live next to this file. `$SK` below = this skill's
directory. `$REPO` = `C:\project\CaloriesSnap`.

## One-time setup (idempotent; safe to re-run)

The web target needs deps the project doesn't ship, plus a shim for
`expo-secure-store` (which has **no web implementation** and otherwise
crashes the app at the auth check). Everything lands in `node_modules`
(gitignored) — `package.json`/lockfile are never touched.

```bash
bash "$SK/setup-web.sh"          # --no-save web deps + SecureStore localStorage shim
npx playwright install chromium  # if Playwright's browser isn't cached yet
```

`setup-web.sh` installs `react-native-web`, `react-dom`,
`@expo/metro-runtime` with `--no-save`, and idempotently patches
`mobile/node_modules/expo-secure-store/build/SecureStore.js` to fall
back to `localStorage` on web.

Playwright itself: `cd "$SK" && npm i playwright` (or reuse an existing
install). Browsers install to the global `ms-playwright` cache and
persist across runs.

## Launch (two background servers)

```bash
# Backend (FastAPI). Serves the API the web app talks to.
cd "$REPO/backend" && python -m uvicorn main:app --host 127.0.0.1 --port 8000

# Web bundle. CI=1 disables the interactive port prompt; --clear picks
# up the node_modules shim. Port 8081 is often taken — use 8090.
cd "$REPO/mobile" && CI=1 EXPO_PUBLIC_API_URL=http://localhost:8000 \
  npx expo start --web --port 8090 --clear
```

Wait for the port, don't sleep:
```bash
until curl -sf http://localhost:8090 >/dev/null; do sleep 2; done
```
First bundle takes ~10-30s (Metro compiles on first request).

## Seed a logged-in user + data

Registration requires email verification, so seeding via the HTTP API
is painful. Instead `seed.py` writes straight to the DB using the
backend's own modules and calls `set_email_verified` — no email dance.

```bash
python "$SK/seed.py"   # creates demo@test.com / Passw0rd! (verified) + a 3-item meal for today
```

Re-run with `--reset` to wipe that user's meals back to the clean
3-item lunch (useful between test passes):
```bash
python "$SK/seed.py" --reset
```

## Drive it

`driver.mjs` is a Playwright skeleton: it logs in and leaves you a
`page`. Copy it and add your interaction. Login targets:
`getByPlaceholder("Email")` / `getByPlaceholder("Password")` /
`getByText("Log In", {exact:true})`. Use a mobile viewport
`{ width: 390, height: 844 }`. A meal row opens the Edit Meal modal
when you click its title text (e.g. `getByText("Grilled chicken breast")`).

```bash
node "$SK/driver.mjs"   # logs in, screenshots the dashboard
```

Verify DB state directly when a screenshot isn't enough:
```bash
TOK=$(curl -s -X POST http://127.0.0.1:8000/api/login -H "Content-Type: application/json" \
  -d '{"email":"demo@test.com","password":"Passw0rd!"}' | python -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s "http://127.0.0.1:8000/api/meals?date=$(date +%F)" -H "Authorization: Bearer $TOK" | python -m json.tool
```

## Cleanup

```bash
# stop servers by port
for p in 8000 8090; do pid=$(netstat -ano | grep ":$p " | grep LISTENING | awk '{print $5}' | head -1); [ -n "$pid" ] && taskkill //PID $pid //F; done
python "$SK/seed.py" --purge   # delete the demo user + its data from the dev DB
```
The web deps and the SecureStore shim live in gitignored `node_modules`
and are harmless to leave; `git status` should show only your intended
source changes.

## Gotchas that actually bit (don't rediscover)

- **`expo-secure-store` on web** throws `getValueWithKeyAsync is not a
  function` and white-screens the app at `_layout.tsx`'s auth check.
  The shim in `setup-web.sh` is mandatory.
- **`hitSlop` is NOT honored on web.** Icon-only `TouchableOpacity`
  hit areas are just the glyph (~18px). Click the icon's *center*, not
  its slop margin. The Edit Meal trash icons sit at ~`x=337` in a
  390-wide viewport, at each ingredient row's calorie-input `y`.
- **Ionicons render as font glyphs, not `<svg>`** on web — you can't
  select them by tag. Anchor coordinate clicks to a nearby `<input>`'s
  bounding box.
- **RN-web controlled inputs**: use Playwright `fill`/`type`, never
  `el.value=` — React won't see the change.
- **Expo port prompt**: without `CI=1`, `expo start` blocks asking to
  use another port when 8081 is busy. Always set `CI=1` + explicit
  `--port`.
- **Metro is in CI mode (no reload)**: after patching `node_modules`,
  restart the bundler with `--clear`.
- **Assets 403**: uploaded meal images may 403 on web; harmless for UI
  verification.

Generated from a verified run on 2026-06-30 (Edit Meal add/remove
ingredients feature).
