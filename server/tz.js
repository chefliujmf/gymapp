/**
 * #5026 — the athlete's LOCAL calendar date (YYYY-MM-DD) for a given instant, in THEIR timezone. Pure + unit-tested.
 * The bug this fixes: the server runs in UTC, so `new Date().toLocaleDateString('en-CA')` (no tz) returned the SERVER's
 * date — a day AHEAD for a Western athlete in the evening (JM in America/Toronto at 20:29 on Jul 14 → server UTC already
 * Jul 15). That made pushPlanToIcu treat the athlete's ACTUAL today as "past" and strip their ride from intervals.
 * ALWAYS compute a "today" against the athlete's `icuTimezone`, never the server's. Falls back to a UTC date if the tz
 * is missing/invalid (better than crashing; only affects users with no timezone yet).
 */
export function localDate(date, tz) {
  try { return date.toLocaleDateString('en-CA', tz ? { timeZone: tz } : undefined) } catch { return date.toISOString().slice(0, 10) }
}
