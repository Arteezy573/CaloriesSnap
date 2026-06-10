// Local-timezone date string (YYYY-MM-DD). Date.toISOString() returns the UTC
// date, which is off by one day near midnight for any non-UTC timezone.
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
