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
