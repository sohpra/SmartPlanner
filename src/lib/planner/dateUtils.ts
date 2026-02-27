// ─────────────────────────────────────────────────────────────────────────────
// dateUtils.ts — Timezone-safe date helpers
// Extracted from revisionEngine so neither engine imports from the other.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strips time component from any ISO or space-separated datetime string.
 * '2026-02-23T00:00:00Z' → '2026-02-23'
 * '2026-02-23 00:00:00'  → '2026-02-23'
 */
export function toDateOnly(dateStr: string): string {
  if (!dateStr) return "";
  
  // Create date object and force it to be treated as local to avoid UTC shifts
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.split("T")[0].split(" ")[0];
  
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Adds N days to a date string, returning a YYYY-MM-DD string.
 * Uses local date constructor to avoid UTC midnight rollover issues.
 */
export function addDays(dateStr: string, days: number): string {
  const base = toDateOnly(dateStr);
  const [year, month, day] = base.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Returns the signed number of calendar days from `from` to `to`.
 * Positive = `to` is in the future. Negative = `to` is in the past.
 */
export function daysBetween(from: string, to: string): number {
  const a = new Date(toDateOnly(from) + "T00:00:00");
  const b = new Date(toDateOnly(to) + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Returns an array of YYYY-MM-DD strings starting from `startDate`
 * for `numDays` days.
 */
export function buildDateWindow(startDate: string, numDays: number): string[] {
  return Array.from({ length: numDays }, (_, i) => addDays(startDate, i));
}
