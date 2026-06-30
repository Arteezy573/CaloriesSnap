import { kgToLb, lbToKg, formatWeight, computeWeightTrend } from "../weight";
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
