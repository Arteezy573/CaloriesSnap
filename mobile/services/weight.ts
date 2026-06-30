// Body-weight helpers. Backend stores weight canonically in kg; unit display
// (kg/lb) is a client-side concern, so all conversion/formatting lives here.
import { WeightLog } from "./api";

export type WeightUnit = "kg" | "lb";

const LB_PER_KG = 2.2046226218;

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  const value = unit === "lb" ? kgToLb(kg) : kg;
  return `${value.toFixed(1)} ${unit}`;
}

export interface WeightTrend {
  latest: number | null; // most recent weight in kg
  change: number | null; // net change (kg) across the period, latest - earliest
  ratePerWeek: number | null; // average kg/week over the period
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeWeightTrend(logs: WeightLog[]): WeightTrend {
  if (logs.length === 0) {
    return { latest: null, change: null, ratePerWeek: null };
  }

  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const latest = last.weight_kg;

  if (sorted.length === 1) {
    return { latest, change: null, ratePerWeek: null };
  }

  const change = last.weight_kg - first.weight_kg;
  const spanDays = (new Date(last.date + "T12:00:00").getTime() - new Date(first.date + "T12:00:00").getTime()) / MS_PER_DAY;
  const ratePerWeek = spanDays > 0 ? (change / spanDays) * 7 : null;

  return { latest, change, ratePerWeek };
}
