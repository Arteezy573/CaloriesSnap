# Logging & History UX — Design

**Date:** 2026-07-01
**Status:** Approved (design)

Three independent, mobile-only enhancements to how users log and revisit meals. All three
reuse existing backend endpoints — **no backend or schema changes**.

1. **Copy a past meal to today** — re-log a previously logged meal with one tap.
2. **Portion slider on photo results** — scale a whole-dish analysis down before logging
   (e.g. cooked for the family, ate half).
3. **Calendar view** — jump directly to any past day from a color-coded month grid instead
   of stepping day-by-day.

---

## Feature 1 — Copy a past meal to today

### Behavior
- On the Today tab, when viewing a **past day** (`!isToday`), each logged meal row shows a
  **copy icon** alongside the existing trash icon.
- Tapping it re-logs that meal to **today** and shows a toast "Copied to today ✓".
- The user stays on the past day (so multiple meals can be copied in a row).
- On today's view, no copy icon appears (copying today's meal to today is meaningless).

### Copy semantics
The copy is a **faithful visual duplicate**: it preserves `foods`, `notes`, `source`, and
`image_path`. The copied meal gets today's timestamp (set server-side by `create_meal`).
Reusing `image_path` is safe — the uploaded file persists on the server and is referenced
read-only; meal deletion never removes image files.

### Changes
- **`components/MealRow.tsx`**: add optional prop `onCopy?: (meal: Meal) => void`. When
  present, render a `copy-outline` Ionicon (same size/hitSlop treatment as the trash icon)
  immediately left of the delete button. When absent, the row is unchanged.
- **`app/(tabs)/index.tsx`**:
  - Pass `onCopy={copyMealToToday}` to `MealRow` only when `!isToday`; otherwise omit.
  - `copyMealToToday(meal)` calls:
    ```ts
    await createMeal({
      source: meal.source,
      image_path: meal.image_path ?? undefined,
      foods: meal.foods,
      notes: meal.notes ?? undefined,
    });
    showToast("Copied to today ✓");
    ```
  - `createMeal()` already stamps the date as `localDateString()` (today), so no date
    argument is needed.

### API
Reuses `POST /api/meals`. No new endpoint, model, or DB change.

---

## Feature 2 — Portion slider on photo results (0–100%)

### Behavior
- On the **Photo-analysis results** screen in `snap.tsx` (the `hasResults` branch), add a
  **Portion slider** above the total bar. Default **100%**, step **5%**, range 0–100%.
- Dragging scales every analyzed food's calories and macros proportionally. The live total,
  the per-item display, and the "Log meal · N kcal" button all reflect the scaled values.
- Logging saves the **scaled** foods (not the originals).
- Scope: **Photo results only.** The Describe and Saved paths are unchanged.

### Scaling helper
New pure module **`services/portion.ts`**:

```ts
export function scaleFoods(foods: FoodItem[], fraction: number): FoodItem[]
```
- `fraction` in `[0, 1]`.
- Returns a **new array**; each food's `calories` rounded to an integer, `protein_g` /
  `carbs_g` / `fat_g` rounded to 1 decimal. `name`, `quantity`, and `id` pass through
  unchanged.
- Pure and side-effect free; mirrors the `services/weight.ts` helper pattern.

TDD tests in **`services/__tests__/portion.test.ts`**: identity at 1.0, halving at 0.5,
zero at 0.0, rounding behavior, empty array, and that the input array is not mutated.

### Changes
- **Dependency:** add `@react-native-community/slider` (Expo-supported; renders natively on
  iOS/Android and as a range input on the web target used for local testing).
- **`app/(tabs)/snap.tsx`** (Photo results branch only):
  - Add `portionPct` state (default `100`).
  - Compute `scaledFoods = scaleFoods(foods, portionPct / 100)`; drive the total display and
    `createMeal` from `scaledFoods`.
  - Render the slider with a caption, e.g. "You ate 50% · 320 kcal". When `portionPct` is
    100 the caption can read "Whole meal · N kcal".
  - Reset `portionPct` to 100 in `resetState()`.

### API
Reuses `POST /api/meals`. No backend change — scaling is entirely client-side.

---

## Feature 3 — Calendar view (color-by-goal)

### Behavior
- Tapping the **date header** at the top of the Today tab opens a **full-screen calendar
  modal**.
- The modal shows a **month grid**. Each day that has logged meals is **tinted by how its
  total calories compare to the calorie goal**:
  - **On target** (~85–115% of goal) → green (`accentSoft` fill, `accent` text)
  - **Over** (>115%) → amber (`warningSoft` fill, `overGoal` text)
  - **Under** (<85%) → soft blue (new `underSoft` token, paired with existing `fat` blue)
  - **No log** → plain background, muted number
- Month chevrons page back/forward; days **after today are disabled** (can't navigate to the
  future).
- Tapping any day sets the Today view's `selectedDate` to that date and closes the modal.
- A small **legend** (under / on-target / over) sits at the bottom.

### Pure helpers
New module **`services/calendar.ts`**:

```ts
export function buildMonthGrid(year: number, month: number): (string | null)[][]
export function calorieBucket(calories: number, goal: number): "under" | "on" | "over" | "none"
```
- `buildMonthGrid` returns weeks (arrays of 7) of ISO date strings, with `null` for
  leading/trailing blank cells. `month` is 0-indexed to match JS `Date`.
- `calorieBucket`: `"none"` when `calories <= 0`; `"on"` when within 85–115% of `goal`;
  `"under"` / `"over"` otherwise. Guards `goal <= 0` (treat as `"none"`/no comparison).

TDD tests in **`services/__tests__/calendar.test.ts`**: grid shape for a known month
(leading blanks, week count, last day), a month starting on Sunday, February in a leap vs
non-leap year, and each `calorieBucket` boundary.

### Component
New **`components/CalendarModal.tsx`**:
- Props: `{ visible, selectedDate, goalCalories, onSelectDate, onClose }`.
- Owns its visible-month state (initialized from `selectedDate`).
- Fetches `getHistory(monthStart, monthEnd)` whenever the visible month changes; maps date →
  calories for cell coloring via `calorieBucket`.
- Built with the existing design system (`Card`, theme tokens, Ionicons); no calendar
  library.

### Changes
- **`theme.ts`**: add `underSoft` color token (soft blue, paired with the existing `fat`
  `#007AFF`).
- **`app/(tabs)/index.tsx`**:
  - Wrap the date header (`formatDate(selectedDate)` / title) in a `TouchableOpacity` that
    opens the modal.
  - Render `<CalendarModal>` with `goalCalories={summary.goals.calories}` and an
    `onSelectDate` that sets `selectedDate`, triggers `loadData(date)`, and closes.

### API
Reuses `GET /api/history?start=&end=`. No backend change.

---

## Testing

- **Unit (jest):** `scaleFoods` (portion), `buildMonthGrid` + `calorieBucket` (calendar).
- **Visual (run-mobile-web skill):**
  - Copy: view a past day, tap copy, confirm the meal appears on today.
  - Portion: drag the slider on a photo result, confirm total and logged values scale.
  - Calendar: open from the date header, confirm heatmap tints and that tapping a day jumps
    to it.

## Out of scope (YAGNI)
- Editing portion after a meal is logged.
- Portion slider on Describe / Saved / copy paths.
- Streak or exercise overlays inside the calendar.
- Any backend or schema change.
