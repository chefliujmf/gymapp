// #379 — pure date math for the "quick picker" (move a planned session to another day).
// Kept side-effect-free + unit-tested (src/move-dates.test.ts). All math is LOCAL-date based
// (YYYY-MM-DD keys), mirroring src/date.ts `localISO` + Calendar.tsx's addDays/startOfWeek, so
// it never rolls a day in the evening the way toISOString() (UTC) does.

/** Local-date key YYYY-MM-DD from a Date's LOCAL components (same as src/date.ts). */
export const isoOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Parse a YYYY-MM-DD key as a LOCAL midnight Date (the `T00:00` suffix keeps it local). */
const parse = (iso: string): Date => new Date(iso + 'T00:00')

/** Add `n` days to a YYYY-MM-DD key, returning a new key (local math). */
export const addDays = (iso: string, n: number): string => { const d = parse(iso); d.setDate(d.getDate() + n); return isoOf(d) }

/** Mon-of-the-week for a key (Monday-start, matching Calendar.tsx). */
export const startOfWeek = (iso: string): string => { const d = parse(iso); return addDays(iso, -((d.getDay() + 6) % 7)) }

/** JS getDay(): 0=Sun … 6=Sat. */
const dow = (iso: string): number => parse(iso).getDay()

export interface MoveShortcut { key: string; label: string; date: string }

/**
 * The one-tap "quick" moves shown at the top of the picker.
 *  - Tomorrow      = fromISO's day is irrelevant; it's TODAY + 1 (what "tomorrow" means to a user).
 *  - In 2 days     = TODAY + 2.
 *  - This weekend  = the COMING Saturday. If today already IS the weekend (Sat/Sun), jump to NEXT Saturday
 *                    (this weekend is effectively spent — offer the next free one).
 *  - Next week     = the session's OWN weekday, +7 (same slot, one week later).
 * `todayISO` anchors the relative ones; `fromISO` (the session's current day) anchors "Next week".
 * Shortcuts that resolve to the session's current day are dropped (moving nowhere is a no-op).
 */
export function moveShortcuts(fromISO: string, todayISO: string): MoveShortcut[] {
  const tomorrow = addDays(todayISO, 1)
  const in2 = addDays(todayISO, 2)
  // Coming Saturday: days until Sat(6). Mon→5 … Fri→1, Sat→0, Sun→6. If today IS Saturday the
  // weekend's spent, so bump to NEXT Saturday (+7). Sunday's `untilSat` (6) already points at the
  // NEXT Saturday, which is exactly the "next free weekend" we want — no bump needed.
  const td = dow(todayISO)
  const untilSat = (6 - td + 7) % 7
  const thisWeekend = addDays(todayISO, untilSat === 0 ? 7 : untilSat)
  const nextWeek = addDays(fromISO, 7)
  const all: MoveShortcut[] = [
    { key: 'tomorrow', label: 'Tomorrow', date: tomorrow },
    { key: 'in2', label: 'In 2 days', date: in2 },
    { key: 'weekend', label: 'This weekend', date: thisWeekend },
    { key: 'nextweek', label: 'Next week', date: nextWeek },
  ]
  // Drop any shortcut that lands on the day it already sits on (no-op move).
  return all.filter((s) => s.date !== fromISO)
}

/** The 7 day-keys (Mon→Sun) of the week containing `anchorISO`. */
export function weekStrip(anchorISO: string): string[] {
  const mon = startOfWeek(anchorISO)
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i))
}
