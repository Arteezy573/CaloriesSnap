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
