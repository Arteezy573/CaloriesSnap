import { buildMonthGrid, calorieBucket } from "../calendar";

describe("buildMonthGrid", () => {
  it("places the first day in the correct weekday column", () => {
    // July 2026: the 1st is a Wednesday (getDay 3)
    const weeks = buildMonthGrid(2026, 6);
    expect(weeks[0][0]).toBeNull(); // Sunday cell is blank
    expect(weeks[0][3]).toBe("2026-07-01");
  });

  it("covers every day of the month in order", () => {
    const flat = buildMonthGrid(2026, 6).flat().filter((c) => c !== null); // July: 31 days
    expect(flat.length).toBe(31);
    expect(flat[0]).toBe("2026-07-01");
    expect(flat[30]).toBe("2026-07-31");
  });

  it("returns rows of exactly 7 cells", () => {
    for (const week of buildMonthGrid(2026, 6)) expect(week.length).toBe(7);
  });

  it("handles a month starting on Sunday (Feb 2026)", () => {
    const weeks = buildMonthGrid(2026, 1);
    expect(weeks[0][0]).toBe("2026-02-01");
  });

  it("handles leap-year February (2024 has 29 days)", () => {
    const days = buildMonthGrid(2024, 1).flat().filter((c) => c !== null);
    expect(days.length).toBe(29);
    expect(days[28]).toBe("2024-02-29");
  });

  it("handles non-leap February (2026 has 28 days)", () => {
    const days = buildMonthGrid(2026, 1).flat().filter((c) => c !== null);
    expect(days.length).toBe(28);
  });
});

describe("calorieBucket", () => {
  it("returns 'none' for zero calories", () => {
    expect(calorieBucket(0, 2000)).toBe("none");
  });
  it("returns 'none' for a non-positive goal", () => {
    expect(calorieBucket(1500, 0)).toBe("none");
  });
  it("returns 'under' below 85% of goal", () => {
    expect(calorieBucket(1600, 2000)).toBe("under"); // ratio 0.80
  });
  it("returns 'on' at the lower boundary of 85%", () => {
    expect(calorieBucket(1700, 2000)).toBe("on"); // ratio 0.85
  });
  it("returns 'on' at the upper boundary of 115%", () => {
    expect(calorieBucket(2300, 2000)).toBe("on"); // ratio 1.15
  });
  it("returns 'over' above 115% of goal", () => {
    expect(calorieBucket(2400, 2000)).toBe("over"); // ratio 1.20
  });
});
