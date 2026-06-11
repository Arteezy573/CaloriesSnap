# CaloriesSnap UI Redesign — Design Spec

**Date:** 2026-06-11
**Status:** Approved direction; pending implementation plan
**Scope:** Mobile app only (`mobile/`). No backend changes.

## Goal

Replace the current dark hobby-project UI with an Apple Health-style light design that looks like a paid product, and add a habit layer (streak, celebrations, onboarding wizard, weekly report) that drives retention. Informed by a teardown of Cal AI (top competitor): light minimal dashboard, investment-building quiz onboarding, streak-centric gamification.

## Decisions made

| Question | Decision |
|---|---|
| Scope | Visual reskin of all screens + engagement features (not a navigation rethink) |
| Visual direction | Light "Apple Health" style (gray bg, white cards), not dark "Apple Fitness" |
| Engagement features | Streak, ring celebration, onboarding goal wizard, weekly report card |
| Implementation | Hand-rolled design system (no UI library); Ionicons; reanimated + haptics |
| Deferred | Badges/Milestones tab, barcode scanning, paywall step, push notifications, streak-restore IAP |

## Design system

**Colors** (iOS system palette):
- Background `#F2F2F7`, cards `#FFFFFF`, separators `#E5E5EA`
- Accent / calorie ring: green `#34C759`; over-goal ring state: amber `#FF9500` (never red)
- Macros: protein `#FF3B30`, carbs `#FF9500`, fat `#007AFF`
- Text: primary `#000000`, secondary `#8E8E93`
- Streak flame: `#FF9500`

**Typography** (system font — SF Pro on iOS): Large Title 34/800, Title 22/700, Headline 17/600, Body 17/400, Footnote 13 gray, Section label 11 caps gray.

**Component kit** (`components/ui/` + feature components):
- `Card` — white, 16px radius, subtle shadow
- `Button` — filled (green), tinted (gray), plain (text); 12px radius
- `Input` — iOS grouped-form style on white cards
- `Segmented` — iOS segmented control
- `Toast` — non-blocking success feedback (replaces success `Alert.alert`)
- `CalorieRing` — real animated SVG arc (spring ~800ms), center shows kcal remaining; amber when over goal; celebration overlay (confetti)
- `MacroPill` — per-macro tile: label, current/goal, thin progress bar
- `StreakBadge` — 🔥 + count pill; tap → sheet with current/best streak + 7-day dot row
- `MealRow` — meal entry: emoji avatar (picked by simple keyword→emoji map with 🍽️ fallback), name, time · item count, kcal; replaces MealCard
- `WeeklyReportCard` — Trends summary card

**Dependencies added:** `react-native-reanimated`, `expo-haptics`, `@react-native-async-storage/async-storage`, `jest-expo` (dev). Already present: `react-native-svg`, `@expo/vector-icons` (via expo).

## Screens

**Tabs** (Ionicons, light tab bar): Today / Snap / Trends / Profile.

### Today (dashboard, `index.tsx`)
- Header: caps date label + "Today" large title; StreakBadge right-aligned
- Day navigation: keep prev/next arrows + tap-date-for-today
- Ring card: CalorieRing (kcal left in center, eaten · goal below) + 3 MacroPills
- "MEALS" section: MealRows in one card, tap to edit (existing modal flow restyled), delete via button on the row (destructive Alert kept; swipe-to-delete is a nice-to-have, not required)
- Empty state: friendly illustration text + "Snap your first meal" button → Snap tab

### Snap (`snap.tsx`)
- Large title + Segmented control: **Photo / Describe / Saved** (Barcode slot reserved in design, not rendered in v1); replaces buried text links
- Photo mode: big green circular capture button, subtitle "AI identifies foods & estimates calories"
- Analyzing state: photo preview + shimmer + status text
- Result sheet: photo preview, food rows (inline editable), low-confidence banner, total bar, "Fix with hint" (tinted) + "Log meal · N kcal" (filled), Save-for-later link
- Describe mode: current manual entry restyled (name + Estimate button + macro fields)
- Saved mode: search field + saved meal rows, tap to log

### Trends (`trends.tsx`)
- WeeklyReportCard on top: avg kcal vs goal, days-on-target /7, best day, current streak
- Existing charts restyled: white cards, smooth filled-area lines, light gridlines, segmented 7D/14D/30D

### Profile (renames Goals tab, `goals.tsx` → `profile.tsx`)
- Grouped iOS settings list: Daily Goals (tap to edit values), "Recalculate my goals" (re-runs wizard), Log Out (red)
- Layout leaves room for Account/Subscription rows (future work)

### Onboarding wizard (`app/(auth)/onboarding.tsx`)
- ~8 quiz-style steps, one question per screen, progress bar, skippable at every step:
  sex → age → height → weight → activity level → goal direction (lose/maintain/gain) → pace → "Building your plan…" (~1.5s) → plan result (calories + macros)
- Calculation: Mifflin-St Jeor BMR × activity factor ± pace adjustment; macro split 30/40/30 protein/carbs/fat (default)
- "Looks good" → `PUT /api/goals`; shown once after registration (AsyncStorage flag); re-runnable from Profile
- Structured so a paywall step can slot in before the plan result later

### Auth (`login.tsx`, `register.tsx`)
- Same light system: large title, white grouped inputs, green filled button

## Engagement mechanics

- **Streak:** pure function in `services/streak.ts` over `GET /api/history` (last 90 days): consecutive days with `meals_count > 0` ending today or yesterday (no break shown before first log of the day). Cached in AsyncStorage for instant render; refreshed on dashboard focus. Also computes best streak and todayLogged.
- **Celebration:** on first log of the day (streak extended): success haptic + confetti burst over ring + "🔥 N-day streak!" toast. Other logs: ring spring animation + light haptic.
- **Weekly report:** presentation over existing history data; no new endpoints.

## Error handling

- Success feedback → Toast + haptic (no blocking alerts)
- Load/save failures → inline error banner on the affected card with Retry; destructive confirmations keep native Alert
- 401 handling (clearToken → login redirect) unchanged

## Testing

- Backend untouched; existing 72 tests must keep passing
- Add `jest-expo`; unit tests for `services/streak.ts` (empty history, gap days, today-not-yet-logged, long streaks) and `services/tdee.ts` (known BMR/TDEE values, pace bounds)
- UI verified manually in Expo Go (iPhone)

## Out of scope / future work (from Cal AI teardown)

- Badges / Milestones "trophy room" tab
- Barcode + nutrition-label scanning (needs backend)
- Paywall step in onboarding (depends on IAP work)
- Push notification meal reminders
- $0.99 streak-restore IAP
