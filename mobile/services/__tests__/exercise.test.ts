import {
  estimateCaloriesBurned,
  sumCaloriesBurned,
  EXERCISE_PRESETS,
  presetByName,
} from "../exercise";
import { Exercise } from "../api";

function ex(id: number, calories_burned: number): Exercise {
  return {
    id,
    date: "2026-06-29",
    name: "Run",
    duration_min: 30,
    calories_burned,
    created_at: "2026-06-29T08:00:00",
  };
}

describe("estimateCaloriesBurned", () => {
  it("applies the MET formula (MET * 3.5 * kg / 200 * minutes)", () => {
    // 8 MET, 70 kg, 30 min -> 8*3.5*70/200 = 9.8 cal/min * 30 = 294
    expect(estimateCaloriesBurned(8, 30, 70)).toBe(294);
  });

  it("scales with body weight", () => {
    // heavier person burns more for the same activity
    expect(estimateCaloriesBurned(8, 30, 90)).toBeGreaterThan(
      estimateCaloriesBurned(8, 30, 70)
    );
  });

  it("returns 0 for zero duration", () => {
    expect(estimateCaloriesBurned(8, 0, 70)).toBe(0);
  });

  it("rounds to a whole number of calories", () => {
    expect(Number.isInteger(estimateCaloriesBurned(6.3, 25, 73.4))).toBe(true);
  });
});

describe("sumCaloriesBurned", () => {
  it("returns 0 for no exercises", () => {
    expect(sumCaloriesBurned([])).toBe(0);
  });

  it("sums calories across exercises", () => {
    expect(sumCaloriesBurned([ex(1, 200), ex(2, 150)])).toBe(350);
  });
});

describe("EXERCISE_PRESETS", () => {
  it("exposes a non-empty list with name, emoji and met", () => {
    expect(EXERCISE_PRESETS.length).toBeGreaterThan(0);
    for (const p of EXERCISE_PRESETS) {
      expect(typeof p.name).toBe("string");
      expect(typeof p.emoji).toBe("string");
      expect(p.met).toBeGreaterThan(0);
    }
  });

  it("looks up a preset by name", () => {
    const first = EXERCISE_PRESETS[0];
    expect(presetByName(first.name)).toEqual(first);
    expect(presetByName("nonexistent-activity")).toBeUndefined();
  });
});
