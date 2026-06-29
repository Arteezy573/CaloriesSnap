// Streak computation over /api/history entries. Pure logic — no React imports.

export interface StreakHistoryEntry {
  date: string; // YYYY-MM-DD
  meals_count: number;
}

export interface StreakInfo {
  current: number; // consecutive logged days ending today (or yesterday if today not yet logged)
  best: number;
  todayLogged: boolean;
  last7: boolean[]; // oldest-first, ending today
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function computeStreak(history: StreakHistoryEntry[], today: string): StreakInfo {
  const logged = new Set(history.filter((h) => h.meals_count > 0).map((h) => h.date));

  const todayLogged = logged.has(today);

  // Current streak: walk back from today (if logged) or yesterday.
  let current = 0;
  let cursor = todayLogged ? today : shiftDate(today, -1);
  while (logged.has(cursor)) {
    current += 1;
    cursor = shiftDate(cursor, -1);
  }

  // Best streak: walk each run start.
  let best = 0;
  for (const date of logged) {
    if (logged.has(shiftDate(date, -1))) continue; // not a run start
    let len = 0;
    let c = date;
    while (logged.has(c)) {
      len += 1;
      c = shiftDate(c, 1);
    }
    best = Math.max(best, len);
  }

  const last7: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    last7.push(logged.has(shiftDate(today, -i)));
  }

  return { current, best, todayLogged, last7 };
}
