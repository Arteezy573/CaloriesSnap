// Pure calendar helpers for the month-grid view. No date library — local Date only.

// Weeks (rows of 7) covering `month` (0-indexed, JS convention) of `year`.
// Each cell is an ISO date string "YYYY-MM-DD", or null for leading/trailing blanks.
export function buildMonthGrid(year: number, month: number): (string | null)[][] {
  const startWeekday = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  const mm = String(month + 1).padStart(2, "0");
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${year}-${mm}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export type CalorieBucket = "under" | "on" | "over" | "none";

// Classifies a day's calories vs. the goal for heatmap coloring.
// "on" = within 85–115% of goal; below is "under", above is "over".
export function calorieBucket(calories: number, goal: number): CalorieBucket {
  if (calories <= 0 || goal <= 0) return "none";
  const ratio = calories / goal;
  if (ratio < 0.85) return "under";
  if (ratio > 1.15) return "over";
  return "on";
}
