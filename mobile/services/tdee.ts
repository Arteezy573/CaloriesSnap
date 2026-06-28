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
