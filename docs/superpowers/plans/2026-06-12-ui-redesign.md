# CaloriesSnap UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the mobile UI as a light Apple Health-style design with a habit layer (streak, ring celebration, onboarding goal wizard, weekly report card), per the approved spec `docs/superpowers/specs/2026-06-11-ui-redesign-design.md`.

**Architecture:** Hand-rolled design system: a single `theme.ts` token file, a small `components/ui/` kit (Card, Button, Input, Segmented, Toast), feature components (CalorieRing, Confetti, StreakBadge, MacroPill, MealRow, WeeklyReportCard), and two pure-logic services (`streak.ts`, `tdee.ts`) with jest tests. Screens are rewritten on top of the kit; backend untouched.

**Tech Stack:** Expo SDK 54 / React Native 0.81, expo-router, react-native-svg (installed), react-native-reanimated + react-native-worklets (new), expo-haptics (new), @react-native-async-storage/async-storage (new), jest-expo (dev).

**Working directory for all commands:** `mobile/` unless stated otherwise. All paths below are relative to repo root.

**Conventions used throughout:**
- Colors/typography always come from `theme.ts` — no hex literals in screens.
- Success feedback = Toast + haptic. Errors = `Alert.alert` stays for now. Destructive confirm = `Alert.alert` two-button.
- Each task ends with a commit.

---

### Task 1: Install dependencies and set up jest

**Files:**
- Modify: `mobile/package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
cd mobile
npx expo install react-native-reanimated react-native-worklets expo-haptics @react-native-async-storage/async-storage
```

Expected: packages added to `package.json` at SDK-54-compatible versions. (babel-preset-expo auto-configures the worklets/reanimated babel plugin — do NOT create a babel.config.js.)

- [ ] **Step 2: Install jest**

```bash
cd mobile
npx expo install --dev jest-expo jest @types/jest
```

- [ ] **Step 3: Add test script and jest preset to `mobile/package.json`**

Add to the `"scripts"` object:

```json
"test": "jest"
```

Add as a new top-level key:

```json
"jest": {
  "preset": "jest-expo"
}
```

- [ ] **Step 4: Verify jest runs (no tests yet)**

```bash
cd mobile
npm test -- --passWithNoTests
```

Expected: `No tests found, exiting with code 0`.

- [ ] **Step 5: Verify the app still boots**

```bash
cd mobile
npx expo start
```

Expected: Metro starts with no errors (Ctrl+C after it loads).

- [ ] **Step 6: Commit**

```bash
git add mobile/package.json mobile/package-lock.json
git commit -m "chore: add reanimated, haptics, async-storage, jest-expo"
```

---

### Task 2: Design tokens — `theme.ts`

**Files:**
- Create: `mobile/theme.ts`

- [ ] **Step 1: Create `mobile/theme.ts`**

```typescript
// Design tokens — iOS system palette, Apple Health-style light theme.
// All screens/components import from here; no hex literals elsewhere.

export const colors = {
  background: "#F2F2F7",
  card: "#FFFFFF",
  separator: "#E5E5EA",
  fill: "#F2F2F7", // inset tiles on white cards

  accent: "#34C759", // green — ring, primary buttons
  accentSoft: "#E8F5E9",
  overGoal: "#FF9500", // amber ring when over goal (never red)

  protein: "#FF3B30",
  carbs: "#FF9500",
  fat: "#007AFF",
  streak: "#FF9500",
  destructive: "#FF3B30",

  text: "#000000",
  textSecondary: "#8E8E93",
  textOnAccent: "#FFFFFF",
};

export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
};

export const radii = {
  s: 8,
  m: 12,
  l: 16,
  pill: 999,
};

export const type = {
  largeTitle: { fontSize: 34, fontWeight: "800" as const, letterSpacing: -0.5, color: colors.text },
  title: { fontSize: 22, fontWeight: "700" as const, color: colors.text },
  headline: { fontSize: 17, fontWeight: "600" as const, color: colors.text },
  body: { fontSize: 17, fontWeight: "400" as const, color: colors.text },
  footnote: { fontSize: 13, color: colors.textSecondary },
  label: {
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 0.6,
    color: colors.textSecondary,
    textTransform: "uppercase" as const,
  },
};

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
};
```

- [ ] **Step 2: Type-check**

```bash
cd mobile
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/theme.ts
git commit -m "feat: add design tokens (iOS light palette, type scale)"
```

---

### Task 3: `services/tdee.ts` (TDD)

**Files:**
- Create: `mobile/services/tdee.ts`
- Test: `mobile/services/__tests__/tdee.test.ts`

- [ ] **Step 1: Write the failing tests — `mobile/services/__tests__/tdee.test.ts`**

```typescript
import { buildPlan } from "../tdee";

describe("buildPlan (Mifflin-St Jeor)", () => {
  const base = {
    sex: "male" as const,
    age: 30,
    heightCm: 180,
    weightKg: 80,
    activity: "moderate" as const,
    direction: "maintain" as const,
    pace: "standard" as const,
  };

  it("computes maintenance for a 30y male, 180cm, 80kg, moderate", () => {
    // BMR = 10*80 + 6.25*180 - 5*30 + 5 = 1780; TDEE = 1780*1.55 = 2759 -> 2760
    expect(buildPlan(base).calories).toBe(2760);
  });

  it("computes female BMR with -161 offset", () => {
    // BMR = 10*60 + 6.25*165 - 5*25 - 161 = 600+1031.25-125-161 = 1345.25
    // TDEE sedentary = 1345.25*1.2 = 1614.3 -> 1610
    const p = buildPlan({ ...base, sex: "female", age: 25, heightCm: 165, weightKg: 60, activity: "sedentary" });
    expect(p.calories).toBe(1610);
  });

  it("subtracts 500 for lose/standard and 250 for lose/relaxed", () => {
    expect(buildPlan({ ...base, direction: "lose", pace: "standard" }).calories).toBe(2260);
    expect(buildPlan({ ...base, direction: "lose", pace: "relaxed" }).calories).toBe(2510);
  });

  it("adds 500 for gain/standard and 250 for gain/relaxed", () => {
    expect(buildPlan({ ...base, direction: "gain", pace: "standard" }).calories).toBe(3260);
    expect(buildPlan({ ...base, direction: "gain", pace: "relaxed" }).calories).toBe(3010);
  });

  it("never goes below 1200 kcal", () => {
    const p = buildPlan({
      sex: "female", age: 60, heightCm: 150, weightKg: 45,
      activity: "sedentary", direction: "lose", pace: "standard",
    });
    expect(p.calories).toBe(1200);
  });

  it("splits macros 30/40/30 (protein/carbs/fat) in grams", () => {
    const p = buildPlan(base); // 2760 kcal
    expect(p.protein_g).toBe(Math.round((2760 * 0.3) / 4)); // 207
    expect(p.carbs_g).toBe(Math.round((2760 * 0.4) / 4)); // 276
    expect(p.fat_g).toBe(Math.round((2760 * 0.3) / 9)); // 92
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd mobile
npm test -- tdee
```

Expected: FAIL — `Cannot find module '../tdee'`.

- [ ] **Step 3: Implement `mobile/services/tdee.ts`**

```typescript
// Mifflin-St Jeor calorie plan. Pure logic — no React imports.

export type Sex = "male" | "female";
export type Activity = "sedentary" | "light" | "moderate" | "active";
export type GoalDirection = "lose" | "maintain" | "gain";
export type Pace = "relaxed" | "standard"; // ±250 / ±500 kcal per day

export interface PlanInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  direction: GoalDirection;
  pace: Pace;
}

export interface Plan {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

const MIN_CALORIES = 1200;

export function buildPlan(input: PlanInput): Plan {
  const { sex, age, heightCm, weightKg, activity, direction, pace } = input;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
  const tdee = bmr * ACTIVITY_FACTOR[activity];

  const delta = pace === "standard" ? 500 : 250;
  let target = tdee;
  if (direction === "lose") target -= delta;
  if (direction === "gain") target += delta;

  const calories = Math.max(MIN_CALORIES, Math.round(target / 10) * 10);

  return {
    calories,
    protein_g: Math.round((calories * 0.3) / 4),
    carbs_g: Math.round((calories * 0.4) / 4),
    fat_g: Math.round((calories * 0.3) / 9),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd mobile
npm test -- tdee
```

Expected: 6 passed.

Note: if the female-BMR or min-clamp expectations are off by one rounding step, recompute by hand and fix the *test* constant only if the implementation faithfully follows the formula above (round target to nearest 10 *after* clamping check order shown). The implementation is the source of truth for rounding: clamp with `Math.max` *around the rounded value* as written.

- [ ] **Step 5: Commit**

```bash
git add mobile/services/tdee.ts mobile/services/__tests__/tdee.test.ts
git commit -m "feat: add Mifflin-St Jeor plan calculator with tests"
```

---

### Task 4: `services/streak.ts` (TDD)

**Files:**
- Create: `mobile/services/streak.ts`
- Test: `mobile/services/__tests__/streak.test.ts`

- [ ] **Step 1: Write the failing tests — `mobile/services/__tests__/streak.test.ts`**

```typescript
import { computeStreak } from "../streak";

function entry(date: string, meals = 1) {
  return { date, meals_count: meals };
}

describe("computeStreak", () => {
  const today = "2026-06-12";

  it("returns zeros for empty history", () => {
    const s = computeStreak([], today);
    expect(s).toEqual({ current: 0, best: 0, todayLogged: false, last7: [false, false, false, false, false, false, false] });
  });

  it("counts a streak ending today", () => {
    const s = computeStreak([entry("2026-06-10"), entry("2026-06-11"), entry("2026-06-12")], today);
    expect(s.current).toBe(3);
    expect(s.todayLogged).toBe(true);
  });

  it("keeps the streak alive when today is not yet logged", () => {
    const s = computeStreak([entry("2026-06-10"), entry("2026-06-11")], today);
    expect(s.current).toBe(2);
    expect(s.todayLogged).toBe(false);
  });

  it("breaks the streak when yesterday and today are both empty", () => {
    const s = computeStreak([entry("2026-06-09"), entry("2026-06-10")], today);
    expect(s.current).toBe(0);
  });

  it("ignores days with zero meals", () => {
    const s = computeStreak([entry("2026-06-11", 0), entry("2026-06-12")], today);
    expect(s.current).toBe(1);
  });

  it("finds the best streak anywhere in history", () => {
    const s = computeStreak(
      [entry("2026-06-01"), entry("2026-06-02"), entry("2026-06-03"), entry("2026-06-04"), entry("2026-06-12")],
      today
    );
    expect(s.best).toBe(4);
    expect(s.current).toBe(1);
  });

  it("computes last7 flags oldest-first ending today", () => {
    const s = computeStreak([entry("2026-06-12"), entry("2026-06-09")], today);
    // 06-06, 06-07, 06-08, 06-09, 06-10, 06-11, 06-12
    expect(s.last7).toEqual([false, false, false, true, false, false, true]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd mobile
npm test -- streak
```

Expected: FAIL — `Cannot find module '../streak'`.

- [ ] **Step 3: Implement `mobile/services/streak.ts`**

```typescript
// Streak computation over /api/history entries. Pure logic — no React imports.

export interface StreakHistoryEntry {
  date: string; // YYYY-MM-DD
  meals_count: number;
}

export interface StreakInfo {
  current: number; // consecutive logged days ending today (or yesterday if today not yet logged)
  best: number;
  todayLogged: boolean;
  last7: boolean[]; // oldest-first, ending today
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function computeStreak(history: StreakHistoryEntry[], today: string): StreakInfo {
  const logged = new Set(history.filter((h) => h.meals_count > 0).map((h) => h.date));

  const todayLogged = logged.has(today);

  // Current streak: walk back from today (if logged) or yesterday.
  let current = 0;
  let cursor = todayLogged ? today : shiftDate(today, -1);
  while (logged.has(cursor)) {
    current += 1;
    cursor = shiftDate(cursor, -1);
  }

  // Best streak: walk each run start.
  let best = 0;
  for (const date of logged) {
    if (logged.has(shiftDate(date, -1))) continue; // not a run start
    let len = 0;
    let c = date;
    while (logged.has(c)) {
      len += 1;
      c = shiftDate(c, 1);
    }
    best = Math.max(best, len);
  }

  const last7: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    last7.push(logged.has(shiftDate(today, -i)));
  }

  return { current, best, todayLogged, last7 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd mobile
npm test
```

Expected: both suites pass (tdee + streak, 13 tests).

- [ ] **Step 5: Commit**

```bash
git add mobile/services/streak.ts mobile/services/__tests__/streak.test.ts
git commit -m "feat: add streak computation with tests"
```

---

### Task 5: UI kit — Card, Button, Input, Segmented

**Files:**
- Create: `mobile/components/ui/Card.tsx`
- Create: `mobile/components/ui/Button.tsx`
- Create: `mobile/components/ui/Input.tsx`
- Create: `mobile/components/ui/Segmented.tsx`

- [ ] **Step 1: Create `mobile/components/ui/Card.tsx`**

```typescript
import { View, StyleSheet, ViewProps } from "react-native";
import { colors, radii, spacing, shadow } from "../../theme";

export default function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.l,
    padding: spacing.l,
    ...shadow.card,
  },
});
```

- [ ] **Step 2: Create `mobile/components/ui/Button.tsx`**

```typescript
import { Text, TouchableOpacity, StyleSheet, ActivityIndicator, ViewStyle } from "react-native";
import { colors, radii, spacing } from "../../theme";

interface Props {
  title: string;
  onPress: () => void;
  variant?: "filled" | "tinted" | "plain" | "destructive";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export default function Button({ title, onPress, variant = "filled", disabled, loading, style }: Props) {
  const isPlain = variant === "plain";
  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === "filled" ? colors.textOnAccent : colors.accent} />
      ) : (
        <Text style={[styles.text, textStyles[variant]]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.m,
    paddingVertical: 14,
    paddingHorizontal: spacing.l,
    alignItems: "center",
    justifyContent: "center",
  },
  filled: { backgroundColor: colors.accent },
  tinted: { backgroundColor: colors.fill },
  plain: { backgroundColor: "transparent", paddingVertical: spacing.s },
  destructive: { backgroundColor: colors.fill },
  disabled: { opacity: 0.5 },
  text: { fontSize: 16, fontWeight: "600" },
});

const textStyles = StyleSheet.create({
  filled: { color: colors.textOnAccent, fontWeight: "700" },
  tinted: { color: colors.accent },
  plain: { color: colors.accent },
  destructive: { color: colors.destructive },
});
```

- [ ] **Step 3: Create `mobile/components/ui/Input.tsx`**

```typescript
import { View, Text, TextInput, StyleSheet, TextInputProps } from "react-native";
import { colors, radii, type } from "../../theme";

interface Props extends TextInputProps {
  label?: string;
}

export default function Input({ label, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.textSecondary}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { ...type.label, marginBottom: 6, marginLeft: 4 },
  input: {
    backgroundColor: colors.card,
    borderRadius: radii.m,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 17,
    color: colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
});
```

- [ ] **Step 4: Create `mobile/components/ui/Segmented.tsx`**

```typescript
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, radii, shadow } from "../../theme";

interface Props {
  options: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}

export default function Segmented({ options, selectedIndex, onChange }: Props) {
  return (
    <View style={styles.track}>
      {options.map((label, i) => (
        <TouchableOpacity
          key={label}
          style={[styles.segment, i === selectedIndex && styles.segmentActive]}
          onPress={() => onChange(i)}
          activeOpacity={0.8}
        >
          <Text style={[styles.text, i === selectedIndex && styles.textActive]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: colors.separator,
    borderRadius: radii.s + 1,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    borderRadius: radii.s - 1,
  },
  segmentActive: { backgroundColor: colors.card, ...shadow.card },
  text: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  textActive: { color: colors.text },
});
```

- [ ] **Step 5: Type-check**

```bash
cd mobile
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add mobile/components/ui/
git commit -m "feat: add UI kit (Card, Button, Input, Segmented)"
```

---

### Task 6: Toast provider + hook

**Files:**
- Create: `mobile/components/ui/Toast.tsx`
- Modify: `mobile/app/_layout.tsx` (wrap with provider — done in Task 9 along with the rest of the layout changes; this task only creates the component)

- [ ] **Step 1: Create `mobile/components/ui/Toast.tsx`**

```typescript
import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";
import { Animated, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, shadow } from "../../theme";

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const showToast = useCallback(
    (msg: string) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setMessage(msg);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() =>
          setMessage(null)
        );
      }, 2200);
    },
    [opacity]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message !== null && (
        <Animated.View pointerEvents="none" style={[styles.toast, { top: insets.top + 8, opacity }]}>
          <Text style={styles.text}>{message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    paddingVertical: 10,
    paddingHorizontal: 18,
    ...shadow.card,
    shadowOpacity: 0.15,
    elevation: 6,
  },
  text: { fontSize: 14, fontWeight: "600", color: colors.text },
});
```

- [ ] **Step 2: Type-check**

```bash
cd mobile
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/components/ui/Toast.tsx
git commit -m "feat: add toast provider for non-blocking success feedback"
```

---

### Task 7: CalorieRing + Confetti

**Files:**
- Create: `mobile/components/CalorieRing.tsx`
- Create: `mobile/components/Confetti.tsx`

- [ ] **Step 1: Create `mobile/components/CalorieRing.tsx`**

Animated SVG arc. Uses reanimated `useAnimatedProps` on `strokeDashoffset`. Full file content:

```typescript
import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, { useSharedValue, useAnimatedProps, withSpring } from "react-native-reanimated";
import { colors } from "../theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  consumed: number;
  goal: number;
  size?: number;
}

export default function CalorieRing({ consumed, goal, size = 150 }: Props) {
  const strokeWidth = 14;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  const over = goal > 0 && consumed > goal;
  const fraction = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const remaining = Math.max(goal - consumed, 0);

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(fraction, { damping: 18, stiffness: 90 });
  }, [fraction, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.separator}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? colors.overGoal : colors.accent}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={styles.big}>{over ? consumed - goal : remaining}</Text>
        <Text style={styles.small}>{over ? "kcal over" : "kcal left"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: "absolute", alignItems: "center" },
  big: { fontSize: 28, fontWeight: "800", color: colors.text },
  small: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
```

- [ ] **Step 2: Create `mobile/components/Confetti.tsx`**

Self-contained celebration burst: 14 colored pieces fly out from the center and fade. Remount (change `key`) to replay.

```typescript
import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { colors } from "../theme";

const PIECE_COLORS = [colors.accent, colors.protein, colors.carbs, colors.fat, colors.streak];
const PIECE_COUNT = 14;

function Piece({ index }: { index: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) });
  }, [t]);

  const angle = (index / PIECE_COUNT) * Math.PI * 2;
  const distance = 70 + (index % 3) * 25;

  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [
      { translateX: Math.cos(angle) * distance * t.value },
      { translateY: Math.sin(angle) * distance * t.value + 50 * t.value * t.value },
      { rotate: `${t.value * 360}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        { backgroundColor: PIECE_COLORS[index % PIECE_COLORS.length] },
        style,
      ]}
    />
  );
}

export default function Confetti() {
  return (
    <View pointerEvents="none" style={styles.overlay}>
      {Array.from({ length: PIECE_COUNT }, (_, i) => (
        <Piece key={i} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  piece: { position: "absolute", width: 8, height: 12, borderRadius: 2 },
});
```

- [ ] **Step 3: Type-check**

```bash
cd mobile
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/components/CalorieRing.tsx mobile/components/Confetti.tsx
git commit -m "feat: add animated calorie ring and confetti celebration"
```

---

### Task 8: Feature components — MacroPill, StreakBadge, MealRow, WeeklyReportCard

**Files:**
- Create: `mobile/components/MacroPill.tsx`
- Create: `mobile/components/StreakBadge.tsx`
- Create: `mobile/components/MealRow.tsx`
- Create: `mobile/components/WeeklyReportCard.tsx`

- [ ] **Step 1: Create `mobile/components/MacroPill.tsx`**

```typescript
import { View, Text, StyleSheet } from "react-native";
import { colors, radii } from "../theme";

interface Props {
  label: string;
  current: number;
  goal: number;
  color: string;
}

export default function MacroPill({ label, current, goal, color }: Props) {
  const pct = goal > 0 ? Math.min(current / goal, 1) : 0;
  return (
    <View style={styles.pill}>
      <Text style={[styles.label, { color }]}>{label.toUpperCase()}</Text>
      <Text style={styles.value}>
        {Math.round(current)}/{goal}g
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flex: 1,
    backgroundColor: colors.fill,
    borderRadius: radii.m - 2,
    padding: 8,
  },
  label: { fontSize: 10, fontWeight: "700" },
  value: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: 2 },
  track: { height: 3, backgroundColor: colors.separator, borderRadius: 2, marginTop: 5 },
  fill: { height: 3, borderRadius: 2 },
});
```

- [ ] **Step 2: Create `mobile/components/StreakBadge.tsx`**

```typescript
import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from "react-native";
import { colors, radii, shadow, type } from "../theme";
import { StreakInfo } from "../services/streak";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

interface Props {
  streak: StreakInfo;
}

export default function StreakBadge({ streak }: Props) {
  const [open, setOpen] = useState(false);

  // Day letters for the last7 window (oldest-first, ending today).
  const todayDow = new Date().getDay();
  const letters = Array.from({ length: 7 }, (_, i) => DAY_LETTERS[(todayDow - 6 + i + 7) % 7]);

  return (
    <>
      <TouchableOpacity style={styles.badge} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={styles.badgeText}>🔥 {streak.current}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>🔥 {streak.current}-day streak</Text>
            <Text style={styles.subtitle}>
              Best: {streak.best} day{streak.best === 1 ? "" : "s"}
              {streak.todayLogged ? " · Today logged ✓" : " · Log a meal to keep it going"}
            </Text>
            <View style={styles.dotsRow}>
              {streak.last7.map((logged, i) => (
                <View key={i} style={styles.dotCol}>
                  <View style={[styles.dot, logged && styles.dotOn]} />
                  <Text style={styles.dotLabel}>{letters[i]}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    ...shadow.card,
  },
  badgeText: { fontSize: 14, fontWeight: "700", color: colors.text },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radii.l,
    padding: 24,
    alignItems: "center",
    alignSelf: "stretch",
  },
  title: { ...type.title },
  subtitle: { ...type.footnote, marginTop: 6 },
  dotsRow: { flexDirection: "row", gap: 12, marginTop: 18 },
  dotCol: { alignItems: "center", gap: 4 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.separator },
  dotOn: { backgroundColor: colors.streak },
  dotLabel: { fontSize: 10, color: colors.textSecondary },
});
```

- [ ] **Step 3: Create `mobile/components/MealRow.tsx`**

```typescript
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../theme";
import { Meal } from "../services/api";

const EMOJI_MAP: [RegExp, string][] = [
  [/salad|lettuce|greens/i, "🥗"],
  [/noodle|ramen|pasta|spaghetti/i, "🍜"],
  [/rice/i, "🍚"],
  [/chicken/i, "🍗"],
  [/beef|steak|pork/i, "🥩"],
  [/fish|salmon|tuna|shrimp/i, "🐟"],
  [/egg/i, "🍳"],
  [/bread|toast|sandwich/i, "🥪"],
  [/burger/i, "🍔"],
  [/pizza/i, "🍕"],
  [/soup|stew|broth/i, "🍲"],
  [/apple|banana|fruit|berry|orange/i, "🍎"],
  [/coffee|latte|espresso/i, "☕"],
  [/yogurt|milk|cheese/i, "🥛"],
  [/tofu/i, "🥡"],
];

export function mealEmoji(meal: Meal): string {
  const names = meal.foods.map((f) => f.name).join(" ");
  for (const [re, emoji] of EMOJI_MAP) {
    if (re.test(names)) return emoji;
  }
  return "🍽️";
}

interface Props {
  meal: Meal;
  isLast: boolean;
  onEdit: (meal: Meal) => void;
  onDelete: (id: number) => void;
}

export default function MealRow({ meal, isLast, onEdit, onDelete }: Props) {
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
      <TouchableOpacity onPress={() => onDelete(meal.id)} style={styles.deleteBtn} hitSlop={8}>
        <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.m - 2,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: { fontSize: 20 },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
  detail: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  kcal: { fontSize: 15, fontWeight: "700", color: colors.text },
  deleteBtn: { paddingLeft: 12, paddingVertical: 4 },
});
```

- [ ] **Step 4: Create `mobile/components/WeeklyReportCard.tsx`**

```typescript
import { View, Text, StyleSheet } from "react-native";
import Card from "./ui/Card";
import { colors, type } from "../theme";
import { HistoryEntry, Goals } from "../services/api";
import { StreakInfo } from "../services/streak";

interface Props {
  week: HistoryEntry[]; // last 7 days, any order
  goals: Goals;
  streak: StreakInfo;
}

export default function WeeklyReportCard({ week, goals, streak }: Props) {
  const daysLogged = week.filter((d) => d.meals_count > 0);
  const avg = daysLogged.length
    ? Math.round(daysLogged.reduce((s, d) => s + d.calories, 0) / daysLogged.length)
    : 0;
  const onTarget = daysLogged.filter((d) => d.calories > 0 && d.calories <= goals.calories).length;
  const best = daysLogged.length
    ? daysLogged.reduce((a, b) => (Math.abs(a.calories - goals.calories) < Math.abs(b.calories - goals.calories) ? a : b))
    : null;
  const bestLabel = best
    ? new Date(best.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })
    : "—";

  return (
    <Card style={styles.card}>
      <Text style={type.label}>THIS WEEK</Text>
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.value}>{avg || "—"}</Text>
          <Text style={styles.caption}>avg kcal{"\n"}goal {goals.calories}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.value}>{onTarget}/7</Text>
          <Text style={styles.caption}>days on{"\n"}target</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.value}>{bestLabel}</Text>
          <Text style={styles.caption}>best{"\n"}day</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.value}>🔥 {streak.current}</Text>
          <Text style={styles.caption}>day{"\n"}streak</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  row: { flexDirection: "row", marginTop: 10 },
  stat: { flex: 1, alignItems: "center" },
  value: { fontSize: 20, fontWeight: "800", color: colors.text },
  caption: { fontSize: 10, color: colors.textSecondary, textAlign: "center", marginTop: 4 },
});
```

- [ ] **Step 5: Type-check, run tests**

```bash
cd mobile
npx tsc --noEmit && npm test
```

Expected: no type errors; 13 tests pass.

- [ ] **Step 6: Commit**

```bash
git add mobile/components/
git commit -m "feat: add MacroPill, StreakBadge, MealRow, WeeklyReportCard"
```

---

### Task 9: Light theme shell — root layout, tab layout, rename Goals→Profile route

**Files:**
- Modify: `mobile/app/_layout.tsx`
- Modify: `mobile/app/(tabs)/_layout.tsx`
- Rename: `mobile/app/(tabs)/goals.tsx` → `mobile/app/(tabs)/profile.tsx` (content rewritten in Task 13; this task only renames + minimal edit so routing works)

- [ ] **Step 1: Rewrite `mobile/app/_layout.tsx`** (light status bar, SafeArea + Toast providers; auth logic unchanged)

```typescript
import { useEffect, useState, useCallback } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getToken, isTokenExpired, setOnAuthStateChange } from "../services/auth";
import { setOnUnauthorized } from "../services/api";
import { ToastProvider } from "../components/ui/Toast";
import { colors } from "../theme";

export const PENDING_ONBOARDING_KEY = "pendingOnboarding";

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  const handleUnauthorized = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    setOnUnauthorized(handleUnauthorized);
    setOnAuthStateChange(setIsAuthenticated);
  }, [handleUnauthorized]);

  useEffect(() => {
    async function checkAuth() {
      const token = await getToken();
      setIsAuthenticated(!!token && !isTokenExpired(token));
      setIsReady(true);
    }
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const inAuth = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuth) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuth) {
      // New registrations go through the goal wizard first.
      AsyncStorage.getItem(PENDING_ONBOARDING_KEY).then((pending) => {
        if (pending) {
          router.replace("/onboarding");
        } else {
          router.replace("/(tabs)");
        }
      });
    }
  }, [isReady, isAuthenticated, segments, router]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
        </Stack>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 2: Rename the goals route**

```bash
cd mobile
git mv "app/(tabs)/goals.tsx" "app/(tabs)/profile.tsx"
```

(Contents rewritten in Task 13. The default export name `GoalsScreen` still works after rename.)

- [ ] **Step 3: Rewrite `mobile/app/(tabs)/_layout.tsx`** (Ionicons, light tab bar, headers off — each screen draws its own large title)

```typescript
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.separator,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="snap"
        options={{
          title: "Snap",
          tabBarIcon: ({ color, size }) => <Ionicons name="camera-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: "Trends",
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 4: Verify the app boots** (screens are still dark — that's expected; only the shell changed)

```bash
cd mobile
npx expo start
```

Expected: app loads, 4 tabs visible with Ionicons named Today/Snap/Trends/Profile. Note: `/onboarding` route doesn't exist yet — that's fine, nothing navigates to it until Task 14 sets the flag.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/
git commit -m "feat: light app shell — toast/safe-area providers, Ionicons tab bar, profile route"
```

---

### Task 10: Dashboard rewrite (`index.tsx`)

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx` (full rewrite)

Behavior preserved: date navigation, pull-to-refresh, edit modal (FoodItemRow), delete with confirm. New: large-title header, StreakBadge, CalorieRing card with MacroPills, MealRow list, first-log-of-day celebration (confetti + haptic + toast), empty state.

- [ ] **Step 1: Rewrite `mobile/app/(tabs)/index.tsx`**

```typescript
import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";
import CalorieRing from "../../components/CalorieRing";
import Confetti from "../../components/Confetti";
import MacroPill from "../../components/MacroPill";
import StreakBadge from "../../components/StreakBadge";
import MealRow from "../../components/MealRow";
import FoodItemRow from "../../components/FoodItemRow";
import {
  DailySummary,
  FoodItem,
  Meal,
  deleteMeal,
  getDailySummary,
  getHistory,
  getMeals,
  updateMeal,
} from "../../services/api";
import { localDateString as toISO } from "../../services/dates";
import { computeStreak, StreakInfo } from "../../services/streak";
import { colors, spacing, type } from "../../theme";

const LAST_CELEBRATED_KEY = "lastCelebratedDate";
const EMPTY_STREAK: StreakInfo = { current: 0, best: 0, todayLogged: false, last7: [false, false, false, false, false, false, false] };

function todayISO(): string {
  return toISO(new Date());
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toISO(d);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    .toUpperCase();
}

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [streak, setStreak] = useState<StreakInfo>(EMPTY_STREAK);
  const [celebrating, setCelebrating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isToday = selectedDate === todayISO();

  async function loadStreak() {
    const today = todayISO();
    try {
      const history = await getHistory(shiftDate(today, -89), today);
      const s = computeStreak(history, today);
      setStreak(s);

      // Celebrate the first log of the day, once.
      if (s.todayLogged) {
        const last = await AsyncStorage.getItem(LAST_CELEBRATED_KEY);
        if (last !== today) {
          await AsyncStorage.setItem(LAST_CELEBRATED_KEY, today);
          setCelebrating(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showToast(`🔥 ${s.current}-day streak!`);
          setTimeout(() => setCelebrating(false), 1100);
        }
      }
    } catch {
      // streak is decorative — never block the dashboard on it
    }
  }

  async function loadData(date?: string) {
    const d = date || selectedDate;
    try {
      const [s, m] = await Promise.all([getDailySummary(d), getMeals(d)]);
      setSummary(s);
      setMeals(m);
      loadStreak();
    } catch (e: any) {
      Alert.alert("Error", "Could not load data: " + e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [selectedDate])
  );

  function changeDay(days: number) {
    const next = shiftDate(selectedDate, days);
    if (days > 0 && isToday) return;
    setSelectedDate(next);
    setLoading(true);
    loadData(next);
  }

  function goToToday() {
    const today = todayISO();
    setSelectedDate(today);
    setLoading(true);
    loadData(today);
  }

  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [editFoods, setEditFoods] = useState<FoodItem[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  function openEdit(meal: Meal) {
    setEditingMeal(meal);
    setEditFoods(meal.foods.map((f) => ({ ...f })));
  }

  function updateEditFood(index: number, updated: FoodItem) {
    setEditFoods((prev) => prev.map((f, i) => (i === index ? updated : f)));
  }

  async function saveEdit() {
    if (!editingMeal) return;
    setSavingEdit(true);
    try {
      await updateMeal(editingMeal.id, { foods: editFoods });
      setEditingMeal(null);
      showToast("Meal updated");
      loadData();
    } catch (e: any) {
      Alert.alert("Error", "Could not update meal: " + e.message);
    } finally {
      setSavingEdit(false);
    }
  }

  function confirmDelete(mealId: number) {
    Alert.alert("Delete meal?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMeal(mealId);
            showToast("Meal deleted");
            loadData();
          } catch (e: any) {
            Alert.alert("Error", "Could not delete meal: " + e.message);
          }
        },
      },
    ]);
  }

  if (loading || !summary) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.s, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
          tintColor={colors.accent}
        />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={type.label}>{formatDate(selectedDate)}</Text>
          <Text style={type.largeTitle}>{isToday ? "Today" : "History"}</Text>
        </View>
        <StreakBadge streak={streak} />
      </View>

      <View style={styles.dateNav}>
        <TouchableOpacity onPress={() => changeDay(-1)} hitSlop={12} style={styles.arrow}>
          <Ionicons name="chevron-back" size={20} color={colors.accent} />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToToday} disabled={isToday}>
          <Text style={styles.dateNavText}>{isToday ? "" : "Back to today"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => changeDay(1)} hitSlop={12} style={styles.arrow} disabled={isToday}>
          <Ionicons name="chevron-forward" size={20} color={isToday ? colors.separator : colors.accent} />
        </TouchableOpacity>
      </View>

      <Card style={styles.ringCard}>
        <CalorieRing consumed={summary.consumed.calories} goal={summary.goals.calories} />
        <Text style={styles.ringCaption}>
          {summary.consumed.calories} eaten · {summary.goals.calories} goal
        </Text>
        <View style={styles.macroRow}>
          <MacroPill label="Protein" current={summary.consumed.protein_g} goal={summary.goals.protein_g} color={colors.protein} />
          <MacroPill label="Carbs" current={summary.consumed.carbs_g} goal={summary.goals.carbs_g} color={colors.carbs} />
          <MacroPill label="Fat" current={summary.consumed.fat_g} goal={summary.goals.fat_g} color={colors.fat} />
        </View>
        {celebrating && <Confetti />}
      </Card>

      <Text style={[type.label, styles.sectionLabel]}>MEALS</Text>
      {meals.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🍽️</Text>
          <Text style={type.headline}>{isToday ? "No meals yet" : "Nothing logged this day"}</Text>
          {isToday && (
            <>
              <Text style={[type.footnote, { textAlign: "center", marginTop: 4 }]}>
                Snap a photo and AI does the math.
              </Text>
              <Button title="Snap your first meal" onPress={() => router.navigate("/snap")} style={{ marginTop: 14, alignSelf: "stretch" }} />
            </>
          )}
        </Card>
      ) : (
        <Card style={styles.mealsCard}>
          {meals.map((meal, i) => (
            <MealRow key={meal.id} meal={meal} isLast={i === meals.length - 1} onEdit={openEdit} onDelete={confirmDelete} />
          ))}
        </Card>
      )}

      <Modal visible={editingMeal !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={type.title}>Edit Meal</Text>
            <ScrollView style={styles.modalScroll}>
              {editFoods.map((food, i) => (
                <FoodItemRow key={i} item={food} index={i} onUpdate={updateEditFood} editable />
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="tinted" onPress={() => setEditingMeal(null)} style={{ flex: 1 }} />
              <Button title="Save" onPress={saveEdit} loading={savingEdit} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: spacing.l,
  },
  dateNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.xs,
  },
  arrow: { padding: spacing.s },
  dateNavText: { fontSize: 13, color: colors.accent, fontWeight: "600" },
  ringCard: { marginHorizontal: spacing.l, alignItems: "center", overflow: "hidden" },
  ringCaption: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.s },
  macroRow: { flexDirection: "row", gap: spacing.s, marginTop: spacing.m, alignSelf: "stretch" },
  sectionLabel: { marginTop: spacing.l, marginBottom: spacing.s, marginLeft: spacing.l + 4 },
  mealsCard: { marginHorizontal: spacing.l, paddingVertical: spacing.xs },
  emptyCard: { marginHorizontal: spacing.l, alignItems: "center", paddingVertical: spacing.xl },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.s },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: spacing.l },
  modalCard: { backgroundColor: colors.card, borderRadius: 16, padding: spacing.l, maxHeight: "80%" },
  modalScroll: { flexGrow: 0, marginTop: spacing.m },
  modalActions: { flexDirection: "row", gap: spacing.m, marginTop: spacing.l },
});
```

- [ ] **Step 2: Run tests + type-check**

```bash
cd mobile
npx tsc --noEmit && npm test
```

Expected: clean.

- [ ] **Step 3: Manual verification in Expo Go**

```bash
cd mobile
npx expo start
```

Check: light dashboard, ring animates on load, streak badge tappable, meals list renders, edit modal opens/saves, delete asks for confirmation, pull-to-refresh works, day arrows work. Log a meal (via old snap screen) → returning to dashboard fires confetti + toast once.

- [ ] **Step 4: Commit**

```bash
git add "mobile/app/(tabs)/index.tsx"
git commit -m "feat: redesign dashboard — ring card, streak badge, celebration, light theme"
```

---

### Task 11: Snap rewrite (`snap.tsx`)

**Files:**
- Modify: `mobile/app/(tabs)/snap.tsx` (full rewrite)

Behavior preserved: photo→analyze→results→save flow, hint re-analyze, editable rows, manual entry with AI estimate, saved meals (search/log/delete), save-for-later. New: segmented Photo/Describe/Saved (replaces hidden text links), large title, light styling, toasts instead of success alerts.

- [ ] **Step 1: Rewrite `mobile/app/(tabs)/snap.tsx`**

```typescript
import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  FlatList,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Segmented from "../../components/ui/Segmented";
import { useToast } from "../../components/ui/Toast";
import FoodItemRow from "../../components/FoodItemRow";
import {
  FoodItem,
  SavedMeal,
  analyzePhoto,
  analyzeText,
  createMeal,
  saveMealForLater,
  getSavedMeals,
  deleteSavedMeal,
} from "../../services/api";
import { colors, radii, spacing, type } from "../../theme";

const SEGMENTS = ["Photo", "Describe", "Saved"];

export default function SnapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [segment, setSegment] = useState(0);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [serverImagePath, setServerImagePath] = useState<string | null>(null);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [hasResults, setHasResults] = useState(false);
  const [confidence, setConfidence] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [hint, setHint] = useState("");
  const [saving, setSaving] = useState(false);
  const [editable, setEditable] = useState(false);

  const [foodName, setFoodName] = useState("");
  const [manCalories, setManCalories] = useState("");
  const [manProtein, setManProtein] = useState("");
  const [manCarbs, setManCarbs] = useState("");
  const [manFat, setManFat] = useState("");
  const [estimating, setEstimating] = useState(false);

  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingSaved, setLoadingSaved] = useState(false);

  function resetState() {
    setImageUri(null);
    setServerImagePath(null);
    setFoods([]);
    setHasResults(false);
    setConfidence("");
    setHint("");
    setEditable(false);
    setFoodName("");
    setManCalories("");
    setManProtein("");
    setManCarbs("");
    setManFat("");
    setSearchQuery("");
    setSavedMeals([]);
    setSegment(0);
  }

  function onChangeSegment(i: number) {
    setSegment(i);
    if (i === 2) loadSaved();
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera permission is required to take photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      setAnalyzing(true);
      try {
        const analysis = await analyzePhoto(uri);
        setFoods(analysis.foods);
        setConfidence(analysis.confidence);
        setServerImagePath(analysis.image_path ?? null);
        setHasResults(true);
      } catch (e: any) {
        Alert.alert("Analysis failed", e.message + "\n\nYou can try again or use Describe.");
      } finally {
        setAnalyzing(false);
      }
    }
  }

  async function handleReanalyze() {
    if (!imageUri) return;
    setAnalyzing(true);
    try {
      const analysis = await analyzePhoto(imageUri, hint.trim() || undefined);
      setFoods(analysis.foods);
      setConfidence(analysis.confidence);
      setServerImagePath(analysis.image_path ?? null);
    } catch (e: any) {
      Alert.alert("Re-analysis failed", e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSaveMeal() {
    setSaving(true);
    try {
      await createMeal({ source: "photo", foods, image_path: serverImagePath ?? undefined });
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

  async function doSaveForLater(name: string, items: FoodItem[]) {
    try {
      await saveMealForLater(name, items);
      showToast("Saved for later ✓");
    } catch (e: any) {
      Alert.alert("Error", "Could not save: " + e.message);
    }
  }

  function handleSaveForLater() {
    const mealName = foods.map((f) => f.name).join(", ");
    Alert.prompt
      ? Alert.prompt(
          "Save for Later",
          "Give this meal a name:",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Save", onPress: (name?: string) => doSaveForLater(name || mealName, foods) },
          ],
          "plain-text",
          mealName
        )
      : doSaveForLater(mealName, foods);
  }

  async function handleEstimate() {
    if (!foodName.trim()) return;
    setEstimating(true);
    try {
      const result = await analyzeText(foodName);
      if (result.foods.length > 0) {
        const f = result.foods[0];
        setManCalories(String(f.calories));
        setManProtein(String(f.protein_g));
        setManCarbs(String(f.carbs_g));
        setManFat(String(f.fat_g));
      }
    } catch (e: any) {
      Alert.alert("Error", "Could not estimate: " + e.message);
    } finally {
      setEstimating(false);
    }
  }

  async function handleSaveManual() {
    if (!foodName.trim()) {
      Alert.alert("Missing", "Enter a food name.");
      return;
    }
    setSaving(true);
    try {
      await createMeal({
        source: "manual",
        foods: [
          {
            name: foodName,
            quantity: "1 serving",
            calories: parseInt(manCalories) || 0,
            protein_g: parseFloat(manProtein) || 0,
            carbs_g: parseFloat(manCarbs) || 0,
            fat_g: parseFloat(manFat) || 0,
          },
        ],
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

  async function loadSaved() {
    setLoadingSaved(true);
    try {
      const meals = await getSavedMeals();
      setSavedMeals(meals);
    } catch (e: any) {
      Alert.alert("Error", "Could not load saved meals: " + e.message);
    } finally {
      setLoadingSaved(false);
    }
  }

  async function searchSaved(query: string) {
    setSearchQuery(query);
    try {
      const meals = await getSavedMeals(query || undefined);
      setSavedMeals(meals);
    } catch {
      // silently fail search
    }
  }

  async function logSavedMeal(meal: SavedMeal) {
    setSaving(true);
    try {
      await createMeal({ source: "manual", foods: meal.foods });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast(`"${meal.name}" logged ✓`);
      resetState();
      router.navigate("/");
    } catch (e: any) {
      Alert.alert("Error", "Could not log meal: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteSaved(meal: SavedMeal) {
    Alert.alert("Delete", `Remove "${meal.name}" from saved meals?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteSavedMeal(meal.id);
            setSavedMeals((prev) => prev.filter((m) => m.id !== meal.id));
          } catch (e: any) {
            Alert.alert("Error", "Could not delete: " + e.message);
          }
        },
      },
    ]);
  }

  function updateFood(index: number, updated: FoodItem) {
    setFoods((prev) => prev.map((f, i) => (i === index ? updated : f)));
  }

  const totalCalories = foods.reduce((sum, f) => sum + f.calories, 0);

  const header = (
    <View style={{ paddingTop: insets.top + spacing.s, paddingHorizontal: spacing.l }}>
      <Text style={type.largeTitle}>Snap</Text>
      <View style={{ marginTop: spacing.m }}>
        <Segmented options={SEGMENTS} selectedIndex={segment} onChange={onChangeSegment} />
      </View>
    </View>
  );

  // --- Saved tab ---
  if (segment === 2) {
    return (
      <View style={styles.container}>
        {header}
        <View style={{ paddingHorizontal: spacing.l, marginTop: spacing.m }}>
          <Input value={searchQuery} onChangeText={searchSaved} placeholder="Search saved meals..." />
        </View>
        {loadingSaved ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : savedMeals.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={type.footnote}>{searchQuery ? "No meals match your search." : "No saved meals yet."}</Text>
          </View>
        ) : (
          <FlatList
            data={savedMeals}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: spacing.l, paddingBottom: 32 }}
            renderItem={({ item }) => (
              <Card style={styles.savedCard}>
                <TouchableOpacity style={styles.savedInfo} onPress={() => logSavedMeal(item)} activeOpacity={0.6}>
                  <Text style={type.headline}>{item.name}</Text>
                  <Text style={styles.savedDetail}>
                    {item.foods.length} item{item.foods.length !== 1 ? "s" : ""} · {item.total_calories} kcal
                  </Text>
                  <Text style={type.footnote} numberOfLines={1}>
                    {item.foods.map((f) => f.name).join(", ")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteSaved(item)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </Card>
            )}
          />
        )}
      </View>
    );
  }

  // --- Describe tab ---
  if (segment === 1) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {header}
        <View style={{ paddingHorizontal: spacing.l, marginTop: spacing.m }}>
          <Input label="Food name" value={foodName} onChangeText={setFoodName} placeholder="e.g. Apple, Greek Yogurt..." />
          <Input label="Calories" value={manCalories} onChangeText={setManCalories} keyboardType="numeric" placeholder="kcal" />
          <View style={styles.macroFieldsRow}>
            <View style={{ flex: 1 }}>
              <Input label="Protein" value={manProtein} onChangeText={setManProtein} keyboardType="numeric" placeholder="g" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Carbs" value={manCarbs} onChangeText={setManCarbs} keyboardType="numeric" placeholder="g" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Fat" value={manFat} onChangeText={setManFat} keyboardType="numeric" placeholder="g" />
            </View>
          </View>
          <Card style={styles.tipCard}>
            <Text style={styles.tipText}>💡 Type the food name, tap Estimate — AI fills in the numbers</Text>
          </Card>
          <View style={styles.actionsRow}>
            <Button title="Estimate" variant="tinted" onPress={handleEstimate} loading={estimating} style={{ flex: 1 }} />
            <Button title="Log meal" onPress={handleSaveManual} loading={saving} style={{ flex: 1 }} />
          </View>
          <Button
            title="Save for later"
            variant="plain"
            onPress={() => {
              if (!foodName.trim()) {
                Alert.alert("Missing", "Enter a food name first.");
                return;
              }
              doSaveForLater(foodName, [
                {
                  name: foodName,
                  quantity: "1 serving",
                  calories: parseInt(manCalories) || 0,
                  protein_g: parseFloat(manProtein) || 0,
                  carbs_g: parseFloat(manCarbs) || 0,
                  fat_g: parseFloat(manFat) || 0,
                },
              ]);
            }}
            style={{ marginTop: spacing.s }}
          />
        </View>
      </ScrollView>
    );
  }

  // --- Photo tab: results state ---
  if (hasResults) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {header}
        <View style={{ paddingHorizontal: spacing.l, marginTop: spacing.m }}>
          <Card>
            {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}
            {confidence === "low" && (
              <View style={styles.warningBadge}>
                <Text style={styles.warningText}>Low confidence — please review</Text>
              </View>
            )}
            {foods.map((food, i) => (
              <FoodItemRow key={i} item={food} index={i} onUpdate={updateFood} editable={editable} />
            ))}
            <View style={styles.totalBar}>
              <Text style={type.headline}>Total</Text>
              <Text style={[type.headline, { color: colors.accent }]}>{totalCalories} kcal</Text>
            </View>
          </Card>

          <View style={{ marginTop: spacing.l }}>
            <Input
              label="Not quite right? Give a hint"
              value={hint}
              onChangeText={setHint}
              placeholder="e.g. mapo tofu with rice, homemade less oil..."
            />
            <Button title="Re-analyze with hint" variant="tinted" onPress={handleReanalyze} loading={analyzing} />
          </View>

          <View style={styles.actionsRow}>
            <Button title={editable ? "Done editing" : "Edit"} variant="tinted" onPress={() => setEditable(!editable)} style={{ flex: 1 }} />
            <Button title={`Log meal · ${totalCalories} kcal`} onPress={handleSaveMeal} loading={saving} style={{ flex: 1.4 }} />
          </View>
          <Button title="Save for later" variant="plain" onPress={handleSaveForLater} style={{ marginTop: spacing.s }} />
          <Button title="Take another photo" variant="plain" onPress={resetState} />
        </View>
      </ScrollView>
    );
  }

  // --- Photo tab: capture state ---
  return (
    <View style={styles.container}>
      {header}
      {analyzing ? (
        <View style={styles.centerBox}>
          {imageUri && <Image source={{ uri: imageUri }} style={styles.analyzingPreview} />}
          <ActivityIndicator color={colors.accent} size="large" style={{ marginTop: spacing.l }} />
          <Text style={[type.footnote, { marginTop: spacing.s }]}>Analyzing your meal...</Text>
        </View>
      ) : (
        <View style={styles.centerBox}>
          <TouchableOpacity style={styles.captureBtn} onPress={takePhoto} activeOpacity={0.8}>
            <Ionicons name="camera" size={44} color={colors.textOnAccent} />
          </TouchableOpacity>
          <Text style={[type.headline, { marginTop: spacing.l }]}>Snap your meal</Text>
          <Text style={[type.footnote, { marginTop: 4 }]}>AI identifies foods & estimates calories</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centerBox: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.l },
  captureBtn: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  preview: { width: "100%", height: 200, borderRadius: radii.m, marginBottom: spacing.m },
  analyzingPreview: { width: 220, height: 160, borderRadius: radii.m },
  warningBadge: {
    backgroundColor: "#FFF4E0",
    borderRadius: radii.pill,
    paddingVertical: 5,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
    marginBottom: spacing.s,
  },
  warningText: { color: colors.overGoal, fontSize: 12, fontWeight: "600" },
  totalBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.m,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    marginTop: spacing.s,
  },
  actionsRow: { flexDirection: "row", gap: spacing.m, marginTop: spacing.l },
  macroFieldsRow: { flexDirection: "row", gap: spacing.s },
  tipCard: { backgroundColor: colors.accentSoft, marginTop: spacing.s, padding: spacing.m },
  tipText: { color: "#2E7D32", fontSize: 13 },
  savedCard: { flexDirection: "row", alignItems: "center", marginBottom: spacing.s, padding: spacing.m },
  savedInfo: { flex: 1 },
  savedDetail: { color: colors.accent, fontSize: 13, marginTop: 2, fontWeight: "600" },
});
```

Note on `FoodItemRow`: it still has dark-theme styles; it gets restyled in Task 15 (it's used by both Dashboard's edit modal and Snap results).

- [ ] **Step 2: Type-check + tests**

```bash
cd mobile
npx tsc --noEmit && npm test
```

- [ ] **Step 3: Manual verification in Expo Go**

Check: segmented control switches Photo/Describe/Saved; photo flow analyze→results→log lands on dashboard with toast + haptic; hint re-analyze; describe estimate+log; saved meals search/log/delete.

- [ ] **Step 4: Commit**

```bash
git add "mobile/app/(tabs)/snap.tsx"
git commit -m "feat: redesign snap screen with segmented Photo/Describe/Saved"
```

---

### Task 12: Trends rewrite (`trends.tsx`)

**Files:**
- Modify: `mobile/app/(tabs)/trends.tsx` (full rewrite)

Keeps MiniChart math; restyles to light cards, adds area fill, adds WeeklyReportCard, uses Segmented for ranges.

- [ ] **Step 1: Rewrite `mobile/app/(tabs)/trends.tsx`**

```typescript
import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, Dimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polyline, Polygon, Line, Circle, Text as SvgText } from "react-native-svg";
import Card from "../../components/ui/Card";
import Segmented from "../../components/ui/Segmented";
import WeeklyReportCard from "../../components/WeeklyReportCard";
import { HistoryEntry, getHistory, getGoals, Goals } from "../../services/api";
import { localDateString } from "../../services/dates";
import { computeStreak, StreakInfo } from "../../services/streak";
import { colors, spacing, type } from "../../theme";

const RANGES = [
  { label: "7D", days: 7 },
  { label: "14D", days: 14 },
  { label: "30D", days: 30 },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateString(d);
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface ChartProps {
  data: { date: string; value: number }[];
  color: string;
  label: string;
  unit: string;
  goalValue?: number;
}

function MiniChart({ data, color, label, unit, goalValue }: ChartProps) {
  if (data.length === 0) return null;

  const screenWidth = Dimensions.get("window").width;
  const chartW = screenWidth - spacing.l * 2 - spacing.l * 2; // screen - margins - card padding
  const chartH = 140;
  const padTop = 20;
  const padBottom = 24;
  const padLeft = 8;
  const padRight = 8;
  const plotW = chartW - padLeft - padRight;
  const plotH = chartH - padTop - padBottom;

  const values = data.map((d) => d.value);
  const allValues = goalValue ? [...values, goalValue] : values;
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => {
    const x = padLeft + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
    const y = padTop + plotH - ((d.value - minVal) / range) * plotH;
    return { x, y, ...d };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const baselineY = padTop + plotH;
  const areaPoints = `${points[0].x},${baselineY} ${polylinePoints} ${points[points.length - 1].x},${baselineY}`;

  const labelCount = Math.min(data.length, 5);
  const labelStep = Math.max(1, Math.floor((data.length - 1) / (labelCount - 1)));
  const labelIndices: number[] = [];
  for (let i = 0; i < data.length; i += labelStep) labelIndices.push(i);
  if (!labelIndices.includes(data.length - 1)) labelIndices.push(data.length - 1);

  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  return (
    <Card style={chartStyles.card}>
      <View style={chartStyles.cardHeader}>
        <Text style={[chartStyles.cardLabel, { color }]}>{label}</Text>
        <Text style={type.footnote}>
          avg {avg}
          {unit}
        </Text>
      </View>
      <Svg width={chartW} height={chartH}>
        <Polygon points={areaPoints} fill={color} opacity={0.12} />
        {goalValue !== undefined && (
          <>
            <Line
              x1={padLeft}
              y1={padTop + plotH - ((goalValue - minVal) / range) * plotH}
              x2={padLeft + plotW}
              y2={padTop + plotH - ((goalValue - minVal) / range) * plotH}
              stroke={colors.textSecondary}
              strokeDasharray="4,4"
              strokeWidth={1}
            />
            <SvgText
              x={padLeft + plotW}
              y={padTop + plotH - ((goalValue - minVal) / range) * plotH - 4}
              fill={colors.textSecondary}
              fontSize={9}
              textAnchor="end"
            >
              Goal: {goalValue}
            </SvgText>
          </>
        )}
        <Polyline points={polylinePoints} fill="none" stroke={color} strokeWidth={2} />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
        ))}
        {labelIndices.map((idx) => (
          <SvgText key={idx} x={points[idx].x} y={chartH - 4} fill={colors.textSecondary} fontSize={9} textAnchor="middle">
            {formatShortDate(data[idx].date)}
          </SvgText>
        ))}
      </Svg>
    </Card>
  );
}

const EMPTY_STREAK: StreakInfo = { current: 0, best: 0, todayLogged: false, last7: [false, false, false, false, false, false, false] };

export default function TrendsScreen() {
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [week, setWeek] = useState<HistoryEntry[]>([]);
  const [streak, setStreak] = useState<StreakInfo>(EMPTY_STREAK);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [loading, setLoading] = useState(true);
  const [rangeIdx, setRangeIdx] = useState(0);

  async function loadData() {
    try {
      const range = RANGES[rangeIdx];
      const end = localDateString();
      const [h, g, w] = await Promise.all([
        getHistory(daysAgo(range.days - 1), end),
        getGoals(),
        getHistory(daysAgo(6), end),
      ]);
      setHistory(h);
      setGoals(g);
      setWeek(w);
      setStreak(computeStreak(w, end));
    } catch (e: any) {
      Alert.alert("Error", "Could not load history: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [rangeIdx])
  );

  if (loading || !goals) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const calData = history.map((h) => ({ date: h.date, value: h.calories }));
  const proteinData = history.map((h) => ({ date: h.date, value: Math.round(h.protein_g) }));
  const carbsData = history.map((h) => ({ date: h.date, value: Math.round(h.carbs_g) }));
  const fatData = history.map((h) => ({ date: h.date, value: Math.round(h.fat_g) }));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.s, paddingHorizontal: spacing.l, paddingBottom: 32 }}
    >
      <Text style={type.largeTitle}>Trends</Text>

      <View style={{ marginTop: spacing.m, marginBottom: spacing.m }}>
        <WeeklyReportCard week={week} goals={goals} streak={streak} />
        <Segmented options={RANGES.map((r) => r.label)} selectedIndex={rangeIdx} onChange={setRangeIdx} />
      </View>

      {history.length === 0 ? (
        <Text style={[type.footnote, { textAlign: "center", marginTop: 40 }]}>
          No data for this period. Start logging meals!
        </Text>
      ) : (
        <>
          <MiniChart data={calData} color={colors.accent} label="Calories" unit=" kcal" goalValue={goals.calories} />
          <MiniChart data={proteinData} color={colors.protein} label="Protein" unit="g" goalValue={goals.protein_g} />
          <MiniChart data={carbsData} color={colors.carbs} label="Carbs" unit="g" goalValue={goals.carbs_g} />
          <MiniChart data={fatData} color={colors.fat} label="Fat" unit="g" goalValue={goals.fat_g} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },
});

const chartStyles = StyleSheet.create({
  card: { marginBottom: spacing.m },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.s },
  cardLabel: { fontSize: 14, fontWeight: "700" },
});
```

- [ ] **Step 2: Type-check + tests**

```bash
cd mobile
npx tsc --noEmit && npm test
```

- [ ] **Step 3: Manual verification:** Trends shows report card, segmented ranges, light area charts.

- [ ] **Step 4: Commit**

```bash
git add "mobile/app/(tabs)/trends.tsx"
git commit -m "feat: redesign trends with weekly report card and light charts"
```

---

### Task 13: Profile screen (`profile.tsx`)

**Files:**
- Modify: `mobile/app/(tabs)/profile.tsx` (full rewrite of the renamed file)

Grouped settings list: Daily Goals (editable inline values + Save), Recalculate my goals (→ onboarding), Log Out. Uses toast for save success.

- [ ] **Step 1: Rewrite `mobile/app/(tabs)/profile.tsx`**

```typescript
import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Alert, ActivityIndicator, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useToast } from "../../components/ui/Toast";
import { getGoals, updateGoals } from "../../services/api";
import { clearToken, notifyAuthChange } from "../../services/auth";
import { colors, spacing, type } from "../../theme";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function handleLogout() {
    await clearToken();
    notifyAuthChange(false);
  }

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    try {
      const goals = await getGoals();
      setCalories(String(goals.calories));
      setProtein(String(goals.protein_g));
      setCarbs(String(goals.carbs_g));
      setFat(String(goals.fat_g));
    } catch (e: any) {
      Alert.alert("Error", "Could not load goals: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateGoals({
        calories: parseInt(calories) || 0,
        protein_g: parseInt(protein) || 0,
        carbs_g: parseInt(carbs) || 0,
        fat_g: parseInt(fat) || 0,
      });
      showToast("Goals updated ✓");
    } catch (e: any) {
      Alert.alert("Error", "Could not save goals: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.s, paddingHorizontal: spacing.l, paddingBottom: 40 }}
    >
      <Text style={type.largeTitle}>Profile</Text>

      <Text style={[type.label, styles.sectionLabel]}>DAILY GOALS</Text>
      <Card>
        <Input label="Calories" value={calories} onChangeText={setCalories} keyboardType="numeric" placeholder="kcal" />
        <Input label="Protein (g)" value={protein} onChangeText={setProtein} keyboardType="numeric" placeholder="grams" />
        <Input label="Carbs (g)" value={carbs} onChangeText={setCarbs} keyboardType="numeric" placeholder="grams" />
        <Input label="Fat (g)" value={fat} onChangeText={setFat} keyboardType="numeric" placeholder="grams" />
        <Button title="Save goals" onPress={handleSave} loading={saving} />
      </Card>

      <Text style={[type.label, styles.sectionLabel]}>PLAN</Text>
      <Card style={{ padding: 0 }}>
        <TouchableOpacity style={styles.row} onPress={() => router.push("/onboarding")} activeOpacity={0.6}>
          <Ionicons name="sparkles-outline" size={20} color={colors.accent} />
          <Text style={styles.rowText}>Recalculate my goals</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </Card>

      <Text style={[type.label, styles.sectionLabel]}>ACCOUNT</Text>
      <Card style={{ padding: 0 }}>
        <TouchableOpacity style={styles.row} onPress={handleLogout} activeOpacity={0.6}>
          <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
          <Text style={[styles.rowText, { color: colors.destructive }]}>Log Out</Text>
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },
  sectionLabel: { marginTop: spacing.xl, marginBottom: spacing.s, marginLeft: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.m, padding: spacing.l },
  rowText: { flex: 1, fontSize: 16, fontWeight: "500", color: colors.text },
});
```

- [ ] **Step 2: Type-check** (`npx tsc --noEmit`) — the `/onboarding` route is created next task; expo-router typed routes are not enabled in this project, so the string route compiles fine.

- [ ] **Step 3: Commit**

```bash
git add "mobile/app/(tabs)/profile.tsx"
git commit -m "feat: redesign profile screen with grouped settings"
```

---

### Task 14: Onboarding wizard + registration hook

**Files:**
- Create: `mobile/app/onboarding.tsx`
- Modify: `mobile/app/(auth)/register.tsx` (set pending-onboarding flag — single edit shown below)

- [ ] **Step 1: Create `mobile/app/onboarding.tsx`**

Quiz-style wizard. Steps: sex → age → height → weight → activity → direction → pace → building (auto-advance ~1.5s) → result. Option steps are tappable cards; numeric steps are a single input. Skippable from every step (Skip = leave goals unchanged).

```typescript
import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { buildPlan, Plan, Sex, Activity, GoalDirection, Pace } from "../services/tdee";
import { updateGoals } from "../services/api";
import { PENDING_ONBOARDING_KEY } from "./_layout";
import { colors, radii, spacing, type } from "../theme";

type Step = "sex" | "age" | "height" | "weight" | "activity" | "direction" | "pace" | "building" | "result";

const STEP_ORDER: Step[] = ["sex", "age", "height", "weight", "activity", "direction", "pace", "building", "result"];

interface OptionDef<T extends string> {
  value: T;
  title: string;
  subtitle?: string;
}

const SEX_OPTIONS: OptionDef<Sex>[] = [
  { value: "male", title: "Male" },
  { value: "female", title: "Female" },
];

const ACTIVITY_OPTIONS: OptionDef<Activity>[] = [
  { value: "sedentary", title: "Sedentary", subtitle: "Desk job, little exercise" },
  { value: "light", title: "Lightly active", subtitle: "Exercise 1–3 days/week" },
  { value: "moderate", title: "Moderately active", subtitle: "Exercise 3–5 days/week" },
  { value: "active", title: "Very active", subtitle: "Exercise 6–7 days/week" },
];

const DIRECTION_OPTIONS: OptionDef<GoalDirection>[] = [
  { value: "lose", title: "Lose weight" },
  { value: "maintain", title: "Maintain" },
  { value: "gain", title: "Gain muscle" },
];

const PACE_OPTIONS: OptionDef<Pace>[] = [
  { value: "relaxed", title: "Relaxed", subtitle: "±250 kcal/day · gentler" },
  { value: "standard", title: "Standard", subtitle: "±500 kcal/day · ~0.5 kg per week" },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stepIdx, setStepIdx] = useState(0);
  const [sex, setSex] = useState<Sex | null>(null);
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState<Activity | null>(null);
  const [direction, setDirection] = useState<GoalDirection | null>(null);
  const [pace, setPace] = useState<Pace | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);

  const step = STEP_ORDER[stepIdx];
  const progress = (stepIdx + 1) / STEP_ORDER.length;

  async function finish() {
    await AsyncStorage.removeItem(PENDING_ONBOARDING_KEY);
    router.replace("/(tabs)");
  }

  function next() {
    setStepIdx((i) => Math.min(i + 1, STEP_ORDER.length - 1));
  }

  function back() {
    setStepIdx((i) => Math.max(i - 1, 0));
  }

  // "building" auto-computes the plan then advances.
  useEffect(() => {
    if (step !== "building") return;
    const timer = setTimeout(() => {
      // Maintain is a valid direction even without a pace choice; default pace standard.
      const computed = buildPlan({
        sex: sex ?? "male",
        age: parseInt(age) || 30,
        heightCm: parseInt(height) || 170,
        weightKg: parseFloat(weight) || 70,
        activity: activity ?? "moderate",
        direction: direction ?? "maintain",
        pace: pace ?? "standard",
      });
      setPlan(computed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      next();
    }, 1500);
    return () => clearTimeout(timer);
  }, [step]);

  async function savePlan() {
    if (!plan) return;
    setSaving(true);
    try {
      await updateGoals(plan);
      await finish();
    } catch (e: any) {
      Alert.alert("Error", "Could not save your plan: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  function OptionList<T extends string>({ options, selected, onSelect }: { options: OptionDef<T>[]; selected: T | null; onSelect: (v: T) => void }) {
    return (
      <View style={{ gap: spacing.m }}>
        {options.map((o) => (
          <TouchableOpacity
            key={o.value}
            style={[styles.option, selected === o.value && styles.optionSelected]}
            onPress={() => {
              onSelect(o.value);
              Haptics.selectionAsync();
              setTimeout(next, 180);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.optionTitle}>{o.title}</Text>
            {o.subtitle ? <Text style={type.footnote}>{o.subtitle}</Text> : null}
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  function NumericStep({ label, value, onChange, placeholder, unit }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; unit: string }) {
    return (
      <View>
        <Input label={`${label} (${unit})`} value={value} onChangeText={onChange} keyboardType="numeric" placeholder={placeholder} autoFocus />
        <Button title="Continue" onPress={next} disabled={!value.trim()} />
      </View>
    );
  }

  const QUESTION_TITLES: Record<Step, string> = {
    sex: "What's your biological sex?",
    age: "How old are you?",
    height: "How tall are you?",
    weight: "What's your current weight?",
    activity: "How active are you?",
    direction: "What's your goal?",
    pace: "How fast do you want to get there?",
    building: "Building your plan…",
    result: "Your personalized plan",
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={{ paddingTop: insets.top + spacing.m, paddingHorizontal: spacing.l, flex: 1 }}>
        <View style={styles.topBar}>
          {stepIdx > 0 && step !== "building" && step !== "result" ? (
            <TouchableOpacity onPress={back} hitSlop={12}>
              <Text style={styles.topBarLink}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          {step !== "result" && (
            <TouchableOpacity onPress={finish} hitSlop={12}>
              <Text style={styles.topBarLink}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <Text style={[type.title, { marginTop: spacing.xl, marginBottom: spacing.xl }]}>{QUESTION_TITLES[step]}</Text>

        {step === "sex" && <OptionList options={SEX_OPTIONS} selected={sex} onSelect={setSex} />}
        {step === "age" && <NumericStep label="Age" value={age} onChange={setAge} placeholder="e.g. 30" unit="years" />}
        {step === "height" && <NumericStep label="Height" value={height} onChange={setHeight} placeholder="e.g. 175" unit="cm" />}
        {step === "weight" && <NumericStep label="Weight" value={weight} onChange={setWeight} placeholder="e.g. 70" unit="kg" />}
        {step === "activity" && <OptionList options={ACTIVITY_OPTIONS} selected={activity} onSelect={setActivity} />}
        {step === "direction" && <OptionList options={DIRECTION_OPTIONS} selected={direction} onSelect={setDirection} />}
        {step === "pace" && <OptionList options={PACE_OPTIONS} selected={pace} onSelect={setPace} />}

        {step === "building" && (
          <View style={styles.buildingBox}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[type.footnote, { marginTop: spacing.l }]}>Crunching the numbers with Mifflin-St Jeor…</Text>
          </View>
        )}

        {step === "result" && plan && (
          <View>
            <Card style={{ alignItems: "center" }}>
              <Text style={styles.planCalories}>{plan.calories}</Text>
              <Text style={type.footnote}>kcal per day</Text>
              <View style={styles.planMacros}>
                <View style={styles.planMacro}>
                  <Text style={[styles.planMacroValue, { color: colors.protein }]}>{plan.protein_g}g</Text>
                  <Text style={type.footnote}>protein</Text>
                </View>
                <View style={styles.planMacro}>
                  <Text style={[styles.planMacroValue, { color: colors.carbs }]}>{plan.carbs_g}g</Text>
                  <Text style={type.footnote}>carbs</Text>
                </View>
                <View style={styles.planMacro}>
                  <Text style={[styles.planMacroValue, { color: colors.fat }]}>{plan.fat_g}g</Text>
                  <Text style={type.footnote}>fat</Text>
                </View>
              </View>
            </Card>
            <Text style={[type.footnote, { textAlign: "center", marginTop: spacing.m }]}>
              You can adjust these anytime in Profile.
            </Text>
            <Button title="Looks good — let's go" onPress={savePlan} loading={saving} style={{ marginTop: spacing.l }} />
            <Button title="Keep my current goals" variant="plain" onPress={finish} style={{ marginTop: spacing.s }} />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.m },
  topBarLink: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  progressTrack: { height: 4, backgroundColor: colors.separator, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: colors.accent, borderRadius: 2 },
  option: {
    backgroundColor: colors.card,
    borderRadius: radii.l,
    padding: spacing.l,
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionSelected: { borderColor: colors.accent },
  optionTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
  buildingBox: { alignItems: "center", marginTop: spacing.xxl },
  planCalories: { fontSize: 44, fontWeight: "800", color: colors.text },
  planMacros: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.l },
  planMacro: { alignItems: "center" },
  planMacroValue: { fontSize: 20, fontWeight: "800" },
});
```

- [ ] **Step 2: Hook registration — edit `mobile/app/(auth)/register.tsx`**

Add imports at the top:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PENDING_ONBOARDING_KEY } from "../_layout";
```

In `handleRegister`, change the success path from:

```typescript
const result = await register(email.trim(), password, inviteCode.trim());
await setToken(result.token);
notifyAuthChange(true);
```

to:

```typescript
const result = await register(email.trim(), password, inviteCode.trim());
await setToken(result.token);
await AsyncStorage.setItem(PENDING_ONBOARDING_KEY, "1");
notifyAuthChange(true);
```

(Root layout from Task 9 reads this flag and routes to `/onboarding`; the wizard's `finish()` clears it.)

- [ ] **Step 3: Type-check + tests**

```bash
cd mobile
npx tsc --noEmit && npm test
```

- [ ] **Step 4: Manual verification:** register a new test account → wizard appears → answer all steps → plan saves → dashboard shows new goals. Profile → "Recalculate my goals" re-opens the wizard. Skip works at every step.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/onboarding.tsx "mobile/app/(auth)/register.tsx"
git commit -m "feat: add quiz-style onboarding goal wizard"
```

---

### Task 15: Auth screens + FoodItemRow restyle

**Files:**
- Modify: `mobile/app/(auth)/login.tsx` (styles only)
- Modify: `mobile/app/(auth)/register.tsx` (styles only)
- Modify: `mobile/components/FoodItemRow.tsx` (styles only)

- [ ] **Step 1: Restyle `mobile/app/(auth)/login.tsx`** — keep all logic/JSX structure; replace `TextInput`s with the kit `Input` and the button with kit `Button`, swap the stylesheet:

```typescript
import { useState } from "react";
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { login } from "../../services/api";
import { setToken, notifyAuthChange } from "../../services/auth";
import { colors, spacing, type } from "../../theme";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert("Error", "Please enter email and password.");
      return;
    }
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      await setToken(result.token);
      notifyAuthChange(true);
    } catch (e: any) {
      const msg = e.message.includes("401") ? "Invalid email or password." : "Login failed. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.content}>
        <Text style={styles.logo}>🥗</Text>
        <Text style={[type.largeTitle, styles.title]}>CaloriesSnap</Text>
        <Text style={[type.footnote, styles.subtitle]}>Log in to your account</Text>

        <Input placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />

        <Button title="Log In" onPress={handleLogin} loading={loading} style={{ marginTop: spacing.s }} />

        <TouchableOpacity onPress={() => router.push("/(auth)/register")} style={{ marginTop: spacing.xl }}>
          <Text style={styles.link}>
            Don't have an account? <Text style={styles.linkBold}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: "center", padding: spacing.xl },
  logo: { fontSize: 56, textAlign: "center", marginBottom: spacing.s },
  title: { textAlign: "center" },
  subtitle: { textAlign: "center", marginTop: 4, marginBottom: spacing.xxl },
  link: { color: colors.textSecondary, textAlign: "center", fontSize: 14 },
  linkBold: { color: colors.accent, fontWeight: "700" },
});
```

- [ ] **Step 2: Restyle `mobile/app/(auth)/register.tsx`** — same treatment (keep the AsyncStorage flag added in Task 14):

```typescript
import { useState } from "react";
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { register } from "../../services/api";
import { setToken, notifyAuthChange } from "../../services/auth";
import { PENDING_ONBOARDING_KEY } from "../_layout";
import { colors, spacing, type } from "../../theme";

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!email.trim() || !password || !confirmPassword || !inviteCode.trim()) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const result = await register(email.trim(), password, inviteCode.trim());
      await setToken(result.token);
      await AsyncStorage.setItem(PENDING_ONBOARDING_KEY, "1");
      notifyAuthChange(true);
    } catch (e: any) {
      const msg = e.message.includes("409")
        ? "An account with this email already exists."
        : e.message.includes("403")
        ? "Invalid invite code."
        : "Registration failed. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.content}>
        <Text style={styles.logo}>🥗</Text>
        <Text style={[type.largeTitle, styles.title]}>CaloriesSnap</Text>
        <Text style={[type.footnote, styles.subtitle]}>Create your account</Text>

        <Input placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <Input placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
        <Input placeholder="Invite Code" value={inviteCode} onChangeText={setInviteCode} autoCapitalize="none" autoCorrect={false} />

        <Button title="Create Account" onPress={handleRegister} loading={loading} style={{ marginTop: spacing.s }} />

        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.xl }}>
          <Text style={styles.link}>
            Already have an account? <Text style={styles.linkBold}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: "center", padding: spacing.xl },
  logo: { fontSize: 56, textAlign: "center", marginBottom: spacing.s },
  title: { textAlign: "center" },
  subtitle: { textAlign: "center", marginTop: 4, marginBottom: spacing.xxl },
  link: { color: colors.textSecondary, textAlign: "center", fontSize: 14 },
  linkBold: { color: colors.accent, fontWeight: "700" },
});
```

- [ ] **Step 3: Restyle `mobile/components/FoodItemRow.tsx`** — logic and JSX unchanged; replace only the StyleSheet at the bottom of the file with:

```typescript
const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.fill,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: colors.text, fontSize: 14, flex: 1, fontWeight: "500" },
  nameInput: { color: colors.text, fontSize: 14, flex: 1, borderBottomWidth: 1, borderBottomColor: colors.accent, paddingBottom: 2 },
  calories: { color: colors.text, fontSize: 14, marginLeft: 8, fontWeight: "600" },
  detail: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  editDetailRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 4 },
  qtyInput: { fontSize: 12, color: colors.textSecondary },
  numInput: {
    color: colors.text,
    fontSize: 13,
    minWidth: 44,
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
    paddingBottom: 2,
    marginLeft: 6,
  },
  unit: { color: colors.textSecondary, fontSize: 12, marginLeft: 6 },
});
```

and add this import at the top of the file:

```typescript
import { colors } from "../theme";
```

- [ ] **Step 4: Type-check + tests**

```bash
cd mobile
npx tsc --noEmit && npm test
```

- [ ] **Step 5: Commit**

```bash
git add "mobile/app/(auth)/" mobile/components/FoodItemRow.tsx
git commit -m "feat: restyle auth screens and food item rows to light theme"
```

---

### Task 16: Cleanup + full verification

**Files:**
- Delete: `mobile/components/MealCard.tsx`
- Delete: `mobile/components/MacroBar.tsx`

- [ ] **Step 1: Confirm no remaining imports of the dead components**

```bash
cd mobile
grep -rn "MealCard\|MacroBar" app/ components/ --include="*.tsx" --include="*.ts"
```

Expected: no matches outside the component files themselves. If a match appears, that screen was missed — fix it before deleting.

- [ ] **Step 2: Delete them**

```bash
git rm mobile/components/MealCard.tsx mobile/components/MacroBar.tsx
```

- [ ] **Step 3: Full check — types, mobile tests, backend tests**

```bash
cd mobile && npx tsc --noEmit && npm test
cd ../backend && python -m pytest -q
```

Expected: tsc clean; 13 mobile tests pass; all 72 backend tests pass.

- [ ] **Step 4: Full manual pass in Expo Go**

Checklist: login → dashboard (light, ring animates, streak badge) → snap photo → analyze → log → confetti+toast on dashboard → edit meal → delete meal → describe-mode log → saved meals → trends (report card + charts) → profile (save goals, recalculate → wizard, log out) → register new account → onboarding wizard → plan saved.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove replaced MealCard/MacroBar components"
```

- [ ] **Step 6: Update README screens/structure section** (optional but recommended): adjust the project-structure listing (`goals.tsx` → `profile.tsx`, new `onboarding.tsx`, new components) and the feature list (streak, onboarding wizard, weekly report). Commit as `docs: update README for UI redesign`.

---

## Self-review notes

- **Spec coverage:** design tokens (T2), kit (T5–6), ring+confetti (T7), feature components (T8), tab shell + Ionicons + profile rename (T9), dashboard + celebration (T10), snap segmented (T11), trends + report card (T12), profile grouped list (T13), onboarding wizard + Mifflin-St Jeor + register hook (T14), auth restyle + FoodItemRow (T15), cleanup + README (T16). Streak service (T4) and tdee (T3) carry the only unit tests, per spec.
- **Deviation from spec:** onboarding lives at `app/onboarding.tsx` (not `app/(auth)/onboarding.tsx`) because the root layout redirects authenticated users out of `(auth)`; the wizard runs *after* registration when the user is already authenticated.
- **Type consistency check:** `StreakInfo {current, best, todayLogged, last7}` used identically in T4/T8/T10/T12; `Plan {calories, protein_g, carbs_g, fat_g}` matches the `updateGoals` payload; `PENDING_ONBOARDING_KEY` exported from `app/_layout.tsx` and imported in T13 (route push only — no key needed there), T14, T15.
- Placeholder scan: clean — every code step contains the complete file or exact edit; commands carry expected output.
