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

// Below this many kg from the goal we consider it reached (scale noise tolerance).
const GOAL_REACHED_THRESHOLD_KG = 0.1;

export interface GoalProjection {
  goalKg: number;
  remainingKg: number; // signed: goalKg - currentKg
  reached: boolean; // current weight is at (or past) the goal
  onTrack: boolean; // the recent trend is moving toward the goal
  weeksToGoal: number | null; // weeks until goal at the current rate
  etaDate: string | null; // projected calendar date the goal is hit (YYYY-MM-DD)
}

// Projects when the goal weight will be reached from the current weight at the
// recent weekly rate. fromDate anchors the eta calendar date (defaults to today).
export function projectGoalWeight(
  currentKg: number,
  goalKg: number,
  ratePerWeekKg: number | null,
  fromDate: string = new Date().toISOString().slice(0, 10),
): GoalProjection {
  const remainingKg = goalKg - currentKg;

  if (Math.abs(remainingKg) <= GOAL_REACHED_THRESHOLD_KG) {
    return { goalKg, remainingKg, reached: true, onTrack: true, weeksToGoal: 0, etaDate: fromDate };
  }

  // On track only when the rate carries weight in the same direction as the gap.
  const onTrack = ratePerWeekKg != null && ratePerWeekKg !== 0 && Math.sign(ratePerWeekKg) === Math.sign(remainingKg);
  if (!onTrack || ratePerWeekKg == null) {
    return { goalKg, remainingKg, reached: false, onTrack: false, weeksToGoal: null, etaDate: null };
  }

  const weeksToGoal = remainingKg / ratePerWeekKg; // same sign / same sign -> positive
  const eta = new Date(fromDate + "T12:00:00");
  eta.setDate(eta.getDate() + Math.round(weeksToGoal * 7));
  const etaDate = eta.toISOString().slice(0, 10);

  return { goalKg, remainingKg, reached: false, onTrack: true, weeksToGoal, etaDate };
}
