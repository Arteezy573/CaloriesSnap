# Logging & History UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three mobile-only features to CaloriesSnap — copy a past meal to today, a portion slider on photo results, and a color-coded calendar to jump to any day.

**Architecture:** All three reuse existing backend endpoints (`POST /api/meals`, `GET /api/history`) — no backend or schema change. Logic that can be pure (portion scaling, calendar grid + goal buckets) lives in `services/` modules with jest tests; UI lives in components/screens using the existing `theme.ts` tokens and `components/ui/` kit.

**Tech Stack:** Expo / React Native, TypeScript, expo-router, react-native-svg, jest (`jest-expo` preset). New dependency: `@react-native-community/slider`.

## Global Constraints

- No hex literals outside `theme.ts` — extend tokens there and import them.
- No backend or DB schema changes; features are entirely client-side.
- Pure helpers go in `services/*.ts` with tests in `services/__tests__/*.test.ts`, mirroring the existing `weight.ts` / `weight.test.ts` pattern.
- Run jest from the `mobile/` directory. Test command form: `npx jest services/__tests__/<file>.test.ts`.
- `createMeal()` always stamps the meal date as today (`localDateString()`); do not add a date argument.
- Design system: light Apple-Health style. Use `Card`, `Button`, `Segmented`, `useToast`, Ionicons, and `colors`/`spacing`/`radii`/`type` from `theme.ts`.

---

### Task 1: Copy a past meal to today

Feature 1. Adds a copy action to meal rows on past days that re-logs the meal to today. Pure UI wiring over the existing `createMeal()`; no new helper.

**Files:**
- Modify: `mobile/components/MealRow.tsx`
- Modify: `mobile/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `createMeal(meal: { source: "photo" | "manual"; image_path?: string; foods: FoodItem[]; notes?: string }) => Promise<Meal>` from `services/api.ts`; `Meal` type; `useToast()`.
- Produces: `MealRow` gains optional prop `onCopy?: (meal: Meal) => void`.

- [ ] **Step 1: Add the `onCopy` prop to `MealRow`**

In `mobile/components/MealRow.tsx`, extend the `Props` interface and render a copy icon before the delete button. Replace the `Props` interface and the return block:

```tsx
interface Props {
  meal: Meal;
  isLast: boolean;
  onEdit: (meal: Meal) => void;
  onDelete: (id: number) => void;
  onCopy?: (meal: Meal) => void;
}

export default function MealRow({ meal, isLast, onEdit, onDelete, onCopy }: Props) {
  const title = meal.foods[0]?.name ?? "Meal";
  const time = new Date(meal.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <TouchableOpacity style={styles.main} onPress={() => onEdit(meal)} activeOpacity={0.6}>
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>{mealEmoji(meal)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.detail}>
            {time} · {meal.foods.length} item{meal.foods.length === 1 ? "" : "s"}
          </Text>
        </View>
        <Text style={styles.kcal}>{meal.total_calories}</Text>
      </TouchableOpacity>
      {onCopy && (
        <TouchableOpacity onPress={() => onCopy(meal)} style={styles.actionBtn} hitSlop={8}>
          <Ionicons name="copy-outline" size={18} color={colors.accent} />
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={() => onDelete(meal.id)} style={styles.actionBtn} hitSlop={8}>
        <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 2: Rename the delete-button style to a shared action style**

In the `StyleSheet.create` block at the bottom of `mobile/components/MealRow.tsx`, replace the `deleteBtn` entry with:

```tsx
  actionBtn: { paddingLeft: 12, paddingVertical: 4 },
```

(The JSX in Step 1 already references `styles.actionBtn` for both icons.)

- [ ] **Step 3: Add `copyMealToToday` and wire `onCopy` in the dashboard**

In `mobile/app/(tabs)/index.tsx`, add `createMeal` to the import from `../../services/api` (the block that currently imports `deleteMeal, getDailySummary, ...`). Then add this handler next to `confirmDelete`:

```tsx
  async function copyMealToToday(meal: Meal) {
    try {
      await createMeal({
        source: meal.source,
        image_path: meal.image_path ?? undefined,
        foods: meal.foods,
        notes: meal.notes ?? undefined,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast("Copied to today ✓");
    } catch (e: any) {
      Alert.alert("Error", "Could not copy meal: " + e.message);
    }
  }
```

- [ ] **Step 4: Pass `onCopy` only on past days**

In `mobile/app/(tabs)/index.tsx`, update the `MealRow` render inside `mealsCard` to pass `onCopy` only when viewing a past day:

```tsx
          {meals.map((meal, i) => (
            <MealRow
              key={meal.id}
              meal={meal}
              isLast={i === meals.length - 1}
              onEdit={openEdit}
              onDelete={confirmDelete}
              onCopy={isToday ? undefined : copyMealToToday}
            />
          ))}
```

- [ ] **Step 5: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Visual verification (run-mobile-web skill)**

Launch the app, log a meal today, navigate back one day (chevron) to a day that has a meal, confirm a green copy icon appears on the row, tap it, return to today, confirm the meal now appears under today's MEALS with today's time. Confirm today's own rows show no copy icon.

- [ ] **Step 7: Commit**

```bash
git add mobile/components/MealRow.tsx "mobile/app/(tabs)/index.tsx"
git commit -m "feat: copy a past meal to today from the day view"
```

---

### Task 2: `scaleFoods` portion helper (pure + tested)

Feature 2 core. Pure function that scales a foods array by a fraction. TDD.

**Files:**
- Create: `mobile/services/portion.ts`
- Test: `mobile/services/__tests__/portion.test.ts`

**Interfaces:**
- Consumes: `FoodItem` from `services/api.ts`.
- Produces: `scaleFoods(foods: FoodItem[], fraction: number): FoodItem[]`.

- [ ] **Step 1: Write the failing test**

Create `mobile/services/__tests__/portion.test.ts`:

```ts
import { scaleFoods } from "../portion";
import { FoodItem } from "../api";

function food(overrides: Partial<FoodItem> = {}): FoodItem {
  return { name: "Rice", quantity: "1 cup", calories: 200, protein_g: 4.4, carbs_g: 44.6, fat_g: 0.4, ...overrides };
}

describe("scaleFoods", () => {
  it("returns identical values at fraction 1", () => {
    expect(scaleFoods([food()], 1)[0]).toEqual(food());
  });

  it("halves calories and macros at 0.5", () => {
    const out = scaleFoods([food({ calories: 200, protein_g: 4.4, carbs_g: 44.6, fat_g: 0.4 })], 0.5);
    expect(out[0].calories).toBe(100);
    expect(out[0].protein_g).toBe(2.2);
    expect(out[0].carbs_g).toBe(22.3);
    expect(out[0].fat_g).toBe(0.2);
  });

  it("zeroes everything at 0", () => {
    const out = scaleFoods([food()], 0);
    expect(out[0].calories).toBe(0);
    expect(out[0].protein_g).toBe(0);
    expect(out[0].carbs_g).toBe(0);
    expect(out[0].fat_g).toBe(0);
  });

  it("rounds calories to integer and macros to one decimal", () => {
    const out = scaleFoods([food({ calories: 201, protein_g: 4.44, carbs_g: 44.66, fat_g: 0.44 })], 0.5);
    expect(out[0].calories).toBe(101); // 100.5 -> 101
    expect(out[0].protein_g).toBe(2.2); // 2.22 -> 2.2
    expect(out[0].carbs_g).toBe(22.3); // 22.33 -> 22.3
    expect(out[0].fat_g).toBe(0.2); // 0.22 -> 0.2
  });

  it("preserves name and quantity", () => {
    const out = scaleFoods([food({ name: "Tofu", quantity: "200 g" })], 0.5);
    expect(out[0].name).toBe("Tofu");
    expect(out[0].quantity).toBe("200 g");
  });

  it("does not mutate the input array", () => {
    const input = [food({ calories: 200 })];
    scaleFoods(input, 0.5);
    expect(input[0].calories).toBe(200);
  });

  it("handles an empty array", () => {
    expect(scaleFoods([], 0.5)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile && npx jest services/__tests__/portion.test.ts`
Expected: FAIL — cannot find module `../portion`.

- [ ] **Step 3: Write the implementation**

Create `mobile/services/portion.ts`:

```ts
// Portion scaling for logging only part of a dish (e.g. cooked for the family, ate half).
// Pure: returns a new array, never mutates input. Backend stores concrete per-food values,
// so we scale client-side before createMeal rather than persisting a percentage.
import { FoodItem } from "./api";

export function scaleFoods(foods: FoodItem[], fraction: number): FoodItem[] {
  return foods.map((f) => ({
    ...f,
    calories: Math.round(f.calories * fraction),
    protein_g: Math.round(f.protein_g * fraction * 10) / 10,
    carbs_g: Math.round(f.carbs_g * fraction * 10) / 10,
    fat_g: Math.round(f.fat_g * fraction * 10) / 10,
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd mobile && npx jest services/__tests__/portion.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add mobile/services/portion.ts mobile/services/__tests__/portion.test.ts
git commit -m "feat: add scaleFoods portion helper with tests"
```

---

### Task 3: Portion slider on the photo-results screen

Feature 2 UI. Adds the slider dependency and wires it into `snap.tsx`'s photo-results branch, driving the displayed total and the logged foods through `scaleFoods`.

**Files:**
- Modify: `mobile/package.json` (via install)
- Modify: `mobile/app/(tabs)/snap.tsx`

**Interfaces:**
- Consumes: `scaleFoods(foods, fraction)` from Task 2; `Slider` default export from `@react-native-community/slider`.

- [ ] **Step 1: Install the slider dependency**

Run: `cd mobile && npx expo install @react-native-community/slider`
Expected: adds `@react-native-community/slider` to `package.json` dependencies.

- [ ] **Step 2: Import the slider and the helper in `snap.tsx`**

In `mobile/app/(tabs)/snap.tsx`, add these imports near the top (after the existing React Native imports):

```tsx
import Slider from "@react-native-community/slider";
import { scaleFoods } from "../../services/portion";
```

- [ ] **Step 3: Add portion state and reset it**

In `SnapScreen`, add state next to the other `useState` hooks:

```tsx
  const [portionPct, setPortionPct] = useState(100);
```

In `resetState()`, add:

```tsx
    setPortionPct(100);
```

- [ ] **Step 4: Derive scaled foods and total in the photo-results branch**

In the `if (hasResults)` branch of `snap.tsx`, replace the existing `totalCalories` usage by computing scaled values at the top of that branch (just inside it, before the `return`):

```tsx
  if (hasResults) {
    const scaledFoods = scaleFoods(foods, portionPct / 100);
    const scaledTotal = scaledFoods.reduce((sum, f) => sum + f.calories, 0);
    return (
```

Then **delete** the now-unused module-level line `const totalCalories = foods.reduce((sum, f) => sum + f.calories, 0);` (it was only used by the photo-results branch, which now uses `scaledTotal`). No other branch references it. Update the FoodItemRow list, the total bar, and the Log button in this branch to use `scaledFoods` / `scaledTotal`:

```tsx
            {scaledFoods.map((food, i) => (
              <FoodItemRow key={i} item={food} index={i} onUpdate={updateFood} editable={editable} />
            ))}
            <View style={styles.totalBar}>
              <Text style={type.headline}>Total</Text>
              <Text style={[type.headline, { color: colors.accent }]}>{scaledTotal} kcal</Text>
            </View>
```

and the log button:

```tsx
            <Button title={`Log meal · ${scaledTotal} kcal`} onPress={handleSaveMeal} loading={saving} style={{ flex: 1.4 }} />
```

- [ ] **Step 5: Render the portion slider above the total bar**

Still in the `hasResults` branch, insert the slider inside the `<Card>`, immediately before the `<View style={styles.totalBar}>`:

```tsx
            <View style={styles.portionRow}>
              <Text style={type.label}>PORTION YOU ATE</Text>
              <Text style={styles.portionPct}>{portionPct}%</Text>
            </View>
            <Slider
              minimumValue={0}
              maximumValue={100}
              step={5}
              value={portionPct}
              onValueChange={setPortionPct}
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.separator}
              thumbTintColor={colors.accent}
            />
            <Text style={styles.portionCaption}>
              {portionPct === 100 ? "Whole meal" : `You ate ${portionPct}%`} · {scaledTotal} kcal
            </Text>
```

- [ ] **Step 6: Make `handleSaveMeal` log the scaled foods**

In `snap.tsx`, `handleSaveMeal` currently sends `foods`. Change the `createMeal` call to scale first:

```tsx
  async function handleSaveMeal() {
    setSaving(true);
    try {
      await createMeal({
        source: "photo",
        foods: scaleFoods(foods, portionPct / 100),
        image_path: serverImagePath ?? undefined,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast("Meal logged ✓");
      resetState();
      router.navigate("/");
    } catch (e: any) {
      Alert.alert("Error", "Could not save meal: " + e.message);
    } finally {
      setSaving(false);
    }
  }
```

- [ ] **Step 7: Add the portion styles**

In the `StyleSheet.create` block at the bottom of `snap.tsx`, add:

```tsx
  portionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.m },
  portionPct: { fontSize: 15, fontWeight: "700", color: colors.accent },
  portionCaption: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs },
```

- [ ] **Step 8: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Visual verification (run-mobile-web skill)**

Launch the app, take/select a photo, wait for analysis. Confirm the Portion slider shows 100% and "Whole meal · N kcal". Drag to 50%; confirm each food row, the Total, the caption, and the "Log meal · N kcal" button all halve. Log it, go to Today, confirm the logged meal reflects the scaled calories.

- [ ] **Step 10: Commit**

```bash
git add mobile/package.json mobile/package-lock.json "mobile/app/(tabs)/snap.tsx"
git commit -m "feat: portion slider scales photo-analysis meals before logging"
```

---

### Task 4: Calendar pure helpers (`buildMonthGrid`, `calorieBucket`)

Feature 3 core. Two pure functions: month-grid layout and goal-proximity bucketing. TDD.

**Files:**
- Create: `mobile/services/calendar.ts`
- Test: `mobile/services/__tests__/calendar.test.ts`

**Interfaces:**
- Produces:
  - `buildMonthGrid(year: number, month: number): (string | null)[][]` — `month` is 0-indexed (JS `Date` convention); cells are ISO `"YYYY-MM-DD"` strings or `null`.
  - `type CalorieBucket = "under" | "on" | "over" | "none"`
  - `calorieBucket(calories: number, goal: number): CalorieBucket`

- [ ] **Step 1: Write the failing test**

Create `mobile/services/__tests__/calendar.test.ts` (weekday facts verified against JS `Date`: Jul 1 2026 is a Wednesday, Feb 1 2026 is a Sunday, Feb 2024 is a leap February):

```ts
import { buildMonthGrid, calorieBucket } from "../calendar";

describe("buildMonthGrid", () => {
  it("places the first day in the correct weekday column", () => {
    // July 2026: the 1st is a Wednesday (getDay 3)
    const weeks = buildMonthGrid(2026, 6);
    expect(weeks[0][0]).toBeNull(); // Sunday cell is blank
    expect(weeks[0][3]).toBe("2026-07-01");
  });

  it("covers every day of the month in order", () => {
    const flat = buildMonthGrid(2026, 6).flat().filter((c) => c !== null); // July: 31 days
    expect(flat.length).toBe(31);
    expect(flat[0]).toBe("2026-07-01");
    expect(flat[30]).toBe("2026-07-31");
  });

  it("returns rows of exactly 7 cells", () => {
    for (const week of buildMonthGrid(2026, 6)) expect(week.length).toBe(7);
  });

  it("handles a month starting on Sunday (Feb 2026)", () => {
    const weeks = buildMonthGrid(2026, 1);
    expect(weeks[0][0]).toBe("2026-02-01");
  });

  it("handles leap-year February (2024 has 29 days)", () => {
    const days = buildMonthGrid(2024, 1).flat().filter((c) => c !== null);
    expect(days.length).toBe(29);
    expect(days[28]).toBe("2024-02-29");
  });

  it("handles non-leap February (2026 has 28 days)", () => {
    const days = buildMonthGrid(2026, 1).flat().filter((c) => c !== null);
    expect(days.length).toBe(28);
  });
});

describe("calorieBucket", () => {
  it("returns 'none' for zero calories", () => {
    expect(calorieBucket(0, 2000)).toBe("none");
  });
  it("returns 'none' for a non-positive goal", () => {
    expect(calorieBucket(1500, 0)).toBe("none");
  });
  it("returns 'under' below 85% of goal", () => {
    expect(calorieBucket(1600, 2000)).toBe("under"); // ratio 0.80
  });
  it("returns 'on' at the lower boundary of 85%", () => {
    expect(calorieBucket(1700, 2000)).toBe("on"); // ratio 0.85
  });
  it("returns 'on' at the upper boundary of 115%", () => {
    expect(calorieBucket(2300, 2000)).toBe("on"); // ratio 1.15
  });
  it("returns 'over' above 115% of goal", () => {
    expect(calorieBucket(2400, 2000)).toBe("over"); // ratio 1.20
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile && npx jest services/__tests__/calendar.test.ts`
Expected: FAIL — cannot find module `../calendar`.

- [ ] **Step 3: Write the implementation**

Create `mobile/services/calendar.ts`:

```ts
// Pure calendar helpers for the month-grid view. No date library — local Date only.

// Weeks (rows of 7) covering `month` (0-indexed, JS convention) of `year`.
// Each cell is an ISO date string "YYYY-MM-DD", or null for leading/trailing blanks.
export function buildMonthGrid(year: number, month: number): (string | null)[][] {
  const startWeekday = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  const mm = String(month + 1).padStart(2, "0");
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${year}-${mm}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export type CalorieBucket = "under" | "on" | "over" | "none";

// Classifies a day's calories vs. the goal for heatmap coloring.
// "on" = within 85–115% of goal; below is "under", above is "over".
export function calorieBucket(calories: number, goal: number): CalorieBucket {
  if (calories <= 0 || goal <= 0) return "none";
  const ratio = calories / goal;
  if (ratio < 0.85) return "under";
  if (ratio > 1.15) return "over";
  return "on";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd mobile && npx jest services/__tests__/calendar.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add mobile/services/calendar.ts mobile/services/__tests__/calendar.test.ts
git commit -m "feat: add calendar grid + calorie-bucket helpers with tests"
```

---

### Task 5: `underSoft` theme token + `CalendarModal` component

Feature 3 UI. Adds one color token and a self-contained calendar modal that fetches month history and colors each day by goal proximity.

**Files:**
- Modify: `mobile/theme.ts`
- Create: `mobile/components/CalendarModal.tsx`

**Interfaces:**
- Consumes: `buildMonthGrid`, `calorieBucket`, `CalorieBucket` from `services/calendar.ts`; `getHistory(start, end)` and `HistoryEntry` from `services/api.ts`; `localDateString` from `services/dates.ts`; `Card` from `components/ui/Card`; theme tokens.
- Produces: default-exported `CalendarModal` with props `{ visible: boolean; selectedDate: string; goalCalories: number; onSelectDate: (date: string) => void; onClose: () => void }`.

- [ ] **Step 1: Add the `underSoft` token**

In `mobile/theme.ts`, add to the `colors` object (after `fat: "#007AFF",`):

```ts
  underSoft: "#E3F0FF", // soft blue — under-goal days in the calendar heatmap (pairs with `fat`)
```

- [ ] **Step 2: Create the `CalendarModal` component**

Create `mobile/components/CalendarModal.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Card from "./ui/Card";
import { getHistory, HistoryEntry } from "../services/api";
import { localDateString } from "../services/dates";
import { buildMonthGrid, calorieBucket, CalorieBucket } from "../services/calendar";
import { colors, radii, spacing, type } from "../theme";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const BUCKET_FILL: Record<CalorieBucket, string> = {
  under: colors.underSoft,
  on: colors.accentSoft,
  over: colors.warningSoft,
  none: "transparent",
};

const BUCKET_TEXT: Record<CalorieBucket, string> = {
  under: colors.fat,
  on: colors.accent,
  over: colors.overGoal,
  none: colors.text,
};

interface Props {
  visible: boolean;
  selectedDate: string;
  goalCalories: number;
  onSelectDate: (date: string) => void;
  onClose: () => void;
}

export default function CalendarModal({ visible, selectedDate, goalCalories, onSelectDate, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const today = localDateString();
  // Visible month, initialized from the selected date.
  const [year, setYear] = useState(() => Number(selectedDate.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(selectedDate.slice(5, 7)) - 1); // 0-indexed
  const [calByDate, setCalByDate] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Re-sync to the selected date each time the modal opens.
  useEffect(() => {
    if (visible) {
      setYear(Number(selectedDate.slice(0, 4)));
      setMonth(Number(selectedDate.slice(5, 7)) - 1);
    }
  }, [visible, selectedDate]);

  // Fetch this month's history whenever the visible month changes while open.
  useEffect(() => {
    if (!visible) return;
    const grid = buildMonthGrid(year, month);
    const flat = grid.flat().filter((c): c is string => c !== null);
    const start = flat[0];
    const end = flat[flat.length - 1];
    setLoading(true);
    getHistory(start, end)
      .then((entries: HistoryEntry[]) => {
        const map: Record<string, number> = {};
        for (const e of entries) map[e.date] = e.calories;
        setCalByDate(map);
      })
      .catch(() => setCalByDate({}))
      .finally(() => setLoading(false));
  }, [visible, year, month]);

  function shiftMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  const weeks = buildMonthGrid(year, month);
  const canGoForward = new Date(year, month, 1) < new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + spacing.s }]}>
        <View style={styles.header}>
          <Text style={type.title}>Calendar</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={12} style={styles.arrow}>
            <Ionicons name="chevron-back" size={22} color={colors.accent} />
          </TouchableOpacity>
          <Text style={type.headline}>{MONTH_NAMES[month]} {year}</Text>
          <TouchableOpacity onPress={() => canGoForward && shiftMonth(1)} hitSlop={12} style={styles.arrow} disabled={!canGoForward}>
            <Ionicons name="chevron-forward" size={22} color={canGoForward ? colors.accent : colors.separator} />
          </TouchableOpacity>
        </View>

        <Card style={styles.gridCard}>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} style={styles.weekdayLabel}>{d}</Text>
            ))}
          </View>
          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ paddingVertical: spacing.xl }} />
          ) : (
            weeks.map((week, wi) => (
              <View key={wi} style={styles.weekRow}>
                {week.map((cell, ci) => {
                  if (cell === null) return <View key={ci} style={styles.dayCell} />;
                  const isFuture = cell > today;
                  const bucket = calorieBucket(calByDate[cell] ?? 0, goalCalories);
                  const isSelected = cell === selectedDate;
                  return (
                    <TouchableOpacity
                      key={ci}
                      style={styles.dayCell}
                      disabled={isFuture}
                      onPress={() => onSelectDate(cell)}
                      activeOpacity={0.6}
                    >
                      <View
                        style={[
                          styles.dayInner,
                          { backgroundColor: BUCKET_FILL[bucket] },
                          isSelected && styles.daySelected,
                        ]}
                      >
                        <Text style={[styles.dayNum, { color: isFuture ? colors.separator : BUCKET_TEXT[bucket] }]}>
                          {Number(cell.slice(8, 10))}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}
        </Card>

        <View style={styles.legend}>
          <LegendDot color={colors.underSoft} label="Under" />
          <LegendDot color={colors.accentSoft} label="On target" />
          <LegendDot color={colors.warningSoft} label="Over" />
        </View>
      </View>
    </Modal>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={type.footnote}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.l },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  monthNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.l },
  arrow: { padding: spacing.s },
  gridCard: { marginTop: spacing.m, paddingVertical: spacing.m },
  weekRow: { flexDirection: "row" },
  weekdayLabel: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: colors.textSecondary, marginBottom: spacing.s },
  dayCell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", padding: 2 },
  dayInner: { width: "100%", height: "100%", borderRadius: radii.s, alignItems: "center", justifyContent: "center" },
  daySelected: { borderWidth: 2, borderColor: colors.accent },
  dayNum: { fontSize: 15, fontWeight: "600" },
  legend: { flexDirection: "row", justifyContent: "center", gap: spacing.l, marginTop: spacing.l },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 4 },
});
```

- [ ] **Step 3: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/theme.ts mobile/components/CalendarModal.tsx
git commit -m "feat: add CalendarModal with goal-proximity heatmap"
```

---

### Task 6: Wire the calendar into the Today tab

Feature 3 wiring. The date header opens the calendar; picking a day jumps the dashboard there.

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `CalendarModal` from `../../components/CalendarModal` (Task 5); existing `selectedDate`, `loadData`, `summary` state.

- [ ] **Step 1: Import `CalendarModal` and add open state**

In `mobile/app/(tabs)/index.tsx`, add the import with the other component imports:

```tsx
import CalendarModal from "../../components/CalendarModal";
```

Add state near the other `useState` hooks:

```tsx
  const [calendarOpen, setCalendarOpen] = useState(false);
```

- [ ] **Step 2: Make the date header open the calendar**

In `index.tsx`, wrap the header title block in a `TouchableOpacity`. Replace the existing `<View>` wrapping the `type.label` date and `type.largeTitle`:

```tsx
        <TouchableOpacity onPress={() => setCalendarOpen(true)} activeOpacity={0.6}>
          <Text style={type.label}>{formatDate(selectedDate)}</Text>
          <View style={styles.titleRow}>
            <Text style={type.largeTitle}>{isToday ? "Today" : "History"}</Text>
            <Ionicons name="calendar-outline" size={20} color={colors.accent} style={{ marginLeft: 8 }} />
          </View>
        </TouchableOpacity>
```

Add the `titleRow` style to the `StyleSheet.create` block:

```tsx
  titleRow: { flexDirection: "row", alignItems: "center" },
```

- [ ] **Step 3: Render `CalendarModal`**

In `index.tsx`, add the modal just before the closing `</ScrollView>` (next to the edit `Modal`):

```tsx
      <CalendarModal
        visible={calendarOpen}
        selectedDate={selectedDate}
        goalCalories={summary.goals.calories}
        onClose={() => setCalendarOpen(false)}
        onSelectDate={(date) => {
          setCalendarOpen(false);
          setSelectedDate(date);
          setLoading(true);
          loadData(date);
        }}
      />
```

- [ ] **Step 4: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Visual verification (run-mobile-web skill)**

Launch the app. On Today, tap the date header; confirm the calendar modal opens on the current month with today outlined. Confirm days with logged meals are tinted (green on-target, blue under, amber over) and empty days are plain. Page back a month with the chevron; confirm the forward chevron is disabled on the current month. Tap a past day with data; confirm the modal closes and the dashboard shows that day. Confirm future days are not tappable.

- [ ] **Step 6: Commit**

```bash
git add "mobile/app/(tabs)/index.tsx"
git commit -m "feat: open calendar from Today date header to jump to any day"
```

---

## Notes for the implementer

- Run all jest and `tsc` commands from the `mobile/` directory.
- The three features are independent; tasks are ordered Feature 1 (Task 1), Feature 2 (Tasks 2–3), Feature 3 (Tasks 4–6). They can be reviewed/merged in that grouping.
- Do not touch the backend — every feature reuses `POST /api/meals` or `GET /api/history`.
- Keep all colors in `theme.ts`; the only new token is `underSoft`.
