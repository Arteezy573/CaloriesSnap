import { kgToLb, lbToKg, formatWeight, computeWeightTrend, projectGoalWeight } from "../weight";
import { WeightLog } from "../api";

function log(date: string, weight_kg: number): WeightLog {
  return { id: 1, date, weight_kg, note: null, created_at: `${date}T08:00:00` };
}

describe("kg/lb conversion", () => {
  it("converts kg to lb", () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 2);
  });

  it("converts lb to kg", () => {
    expect(lbToKg(220.462)).toBeCloseTo(100, 2);
  });

  it("round-trips kg -> lb -> kg", () => {
    expect(lbToKg(kgToLb(73.4))).toBeCloseTo(73.4, 5);
  });
});

describe("formatWeight", () => {
  it("formats kg with one decimal", () => {
    expect(formatWeight(80.25, "kg")).toBe("80.3 kg");
  });

  it("formats lb with one decimal, converting from kg", () => {
    expect(formatWeight(100, "lb")).toBe("220.5 lb");
  });
});

describe("computeWeightTrend", () => {
  it("returns null latest for no logs", () => {
    const t = computeWeightTrend([]);
    expect(t.latest).toBeNull();
    expect(t.change).toBeNull();
    expect(t.ratePerWeek).toBeNull();
  });

  it("reports latest with no change for a single log", () => {
    const t = computeWeightTrend([log("2026-06-20", 80)]);
    expect(t.latest).toBe(80);
    expect(t.change).toBeNull();
    expect(t.ratePerWeek).toBeNull();
  });

  it("computes net change between first and last chronological logs", () => {
    // unordered input to prove it sorts by date
    const t = computeWeightTrend([
      log("2026-06-22", 79),
      log("2026-06-15", 81),
    ]);
    expect(t.latest).toBe(79);
    expect(t.change).toBeCloseTo(-2, 5);
  });

  it("computes weekly rate from span in days", () => {
    // 14 days span, -2kg total -> -1kg/week
    const t = computeWeightTrend([
      log("2026-06-01", 82),
      log("2026-06-15", 80),
    ]);
    expect(t.ratePerWeek).toBeCloseTo(-1, 5);
  });
});

describe("projectGoalWeight", () => {
  it("marks the goal reached when within 0.1 kg, with today's eta", () => {
    const p = projectGoalWeight(75.05, 75, -0.5, "2026-06-20");
    expect(p.reached).toBe(true);
    expect(p.onTrack).toBe(true);
    expect(p.weeksToGoal).toBe(0);
    expect(p.etaDate).toBe("2026-06-20");
  });

  it("projects an eta when losing toward a lower goal", () => {
    // 5 kg to lose at -0.5 kg/week -> 10 weeks -> 70 days out
    const p = projectGoalWeight(80, 75, -0.5, "2026-06-20");
    expect(p.remainingKg).toBeCloseTo(-5, 5);
    expect(p.onTrack).toBe(true);
    expect(p.weeksToGoal).toBeCloseTo(10, 5);
    expect(p.etaDate).toBe("2026-08-29");
  });

  it("projects an eta when gaining toward a higher goal", () => {
    // 5 kg to gain at +0.25 kg/week -> 20 weeks
    const p = projectGoalWeight(60, 65, 0.25, "2026-06-20");
    expect(p.onTrack).toBe(true);
    expect(p.weeksToGoal).toBeCloseTo(20, 5);
  });

  it("is not on track when the rate moves away from the goal", () => {
    // needs to lose but is gaining
    const p = projectGoalWeight(80, 75, 0.5, "2026-06-20");
    expect(p.onTrack).toBe(false);
    expect(p.weeksToGoal).toBeNull();
    expect(p.etaDate).toBeNull();
  });

  it("is not on track when weight is flat (zero rate)", () => {
    const p = projectGoalWeight(80, 75, 0, "2026-06-20");
    expect(p.onTrack).toBe(false);
    expect(p.weeksToGoal).toBeNull();
    expect(p.etaDate).toBeNull();
  });

  it("returns null projection when the rate is unknown", () => {
    const p = projectGoalWeight(80, 75, null, "2026-06-20");
    expect(p.onTrack).toBe(false);
    expect(p.weeksToGoal).toBeNull();
    expect(p.etaDate).toBeNull();
  });
});
