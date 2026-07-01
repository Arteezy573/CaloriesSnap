#!/usr/bin/env bash
# Prepare the CaloriesSnap mobile app for the Expo web target.
# Idempotent. Touches only gitignored node_modules — never package.json.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MOBILE="$REPO/mobile"
SS="$MOBILE/node_modules/expo-secure-store/build/SecureStore.js"

echo "== installing web deps (--no-save) =="
cd "$MOBILE"
npm install --no-save \
  react-native-web@^0.21.0 \
  react-dom@19.1.0 \
  @expo/metro-runtime@~6.1.1

echo "== shimming expo-secure-store for web (localStorage fallback) =="
if [ ! -f "$SS" ]; then
  echo "WARN: $SS not found (deps not installed?)" >&2
  exit 1
fi
if grep -q "globalThis.localStorage" "$SS"; then
  echo "already shimmed"
else
  # Insert a localStorage fallback before each native call when the
  # native module method is undefined (i.e. on web).
  python - "$SS" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
s = s.replace(
    "    ensureValidKey(key);\n    await ExpoSecureStore.deleteValueWithKeyAsync(key, options);",
    "    ensureValidKey(key);\n    if (!ExpoSecureStore.deleteValueWithKeyAsync) { try { globalThis.localStorage.removeItem(key); } catch {} return; }\n    await ExpoSecureStore.deleteValueWithKeyAsync(key, options);",
)
s = s.replace(
    "    ensureValidKey(key);\n    return await ExpoSecureStore.getValueWithKeyAsync(key, options);",
    "    ensureValidKey(key);\n    if (!ExpoSecureStore.getValueWithKeyAsync) { try { return globalThis.localStorage.getItem(key); } catch { return null; } }\n    return await ExpoSecureStore.getValueWithKeyAsync(key, options);",
)
s = s.replace(
    "    }\n    await ExpoSecureStore.setValueWithKeyAsync(value, key, options);",
    "    }\n    if (!ExpoSecureStore.setValueWithKeyAsync) { try { globalThis.localStorage.setItem(key, value); } catch {} return; }\n    await ExpoSecureStore.setValueWithKeyAsync(value, key, options);",
)
open(p, "w", encoding="utf-8").write(s)
print("shim applied")
PY
fi

echo "== done. Now: start backend + 'expo start --web --port 8090 --clear' =="
