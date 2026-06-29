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
