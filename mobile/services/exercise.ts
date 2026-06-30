// Exercise (calories-out) helpers. The backend stores calories_burned as given;
// estimating burn from an activity + duration is a client-side convenience so
// users don't have to guess. Estimates use the standard MET formula.
import { Exercise } from "./api";

export interface ExercisePreset {
  name: string;
  emoji: string;
  met: number; // metabolic equivalent of task (moderate intensity)
}

// A small, broadly-useful set covering the most common logged activities.
// MET values are moderate-intensity references from the Compendium of Physical Activities.
export const EXERCISE_PRESETS: ExercisePreset[] = [
  { name: "Walking", emoji: "🚶", met: 3.5 },
  { name: "Running", emoji: "🏃", met: 9.8 },
  { name: "Cycling", emoji: "🚴", met: 7.5 },
  { name: "Swimming", emoji: "🏊", met: 7.0 },
  { name: "Strength", emoji: "🏋️", met: 5.0 },
  { name: "Yoga", emoji: "🧘", met: 3.0 },
  { name: "HIIT", emoji: "🤸", met: 8.0 },
  { name: "Hiking", emoji: "🥾", met: 6.0 },
];

export function presetByName(name: string): ExercisePreset | undefined {
  return EXERCISE_PRESETS.find((p) => p.name === name);
}

// Calories burned = MET × 3.5 × bodyWeightKg / 200 × minutes (kcal/min × minutes).
export function estimateCaloriesBurned(
  met: number,
  durationMin: number,
  bodyWeightKg: number
): number {
  const perMin = (met * 3.5 * bodyWeightKg) / 200;
  return Math.round(perMin * durationMin);
}

export function sumCaloriesBurned(exercises: Exercise[]): number {
  return exercises.reduce((acc, e) => acc + e.calories_burned, 0);
}
