import { describe, it, expect } from 'vitest'
import { moveShortcuts, weekStrip, addDays, startOfWeek, isoOf } from './move-dates'

// #379 — the quick-picker date math is pure, so it's fully unit-testable. Anchors on fixed
// keys (no `new Date()`), covering: Tomorrow, In 2 days, This weekend (mid-week vs already-weekend),
// Next week (+7 from the SESSION's day), and a Monday-start week strip.

describe('addDays / startOfWeek / isoOf — local-date primitives', () => {
  it('addDays crosses a month boundary', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('startOfWeek is the Monday of that week', () => {
    // 2026-07-10 is a Friday → Monday is 2026-07-06.
    expect(startOfWeek('2026-07-10')).toBe('2026-07-06')
    // A Monday maps to itself.
    expect(startOfWeek('2026-07-06')).toBe('2026-07-06')
    // A Sunday maps back to the prior Monday (Mon-start weeks).
    expect(startOfWeek('2026-07-12')).toBe('2026-07-06')
  })
  it('isoOf uses local components', () => {
    expect(isoOf(new Date('2026-07-10T00:00'))).toBe('2026-07-10')
  })
})

describe('moveShortcuts — one-tap moves', () => {
  // Scenario A: session on Wed Jul 15, today is Wed Jul 8 (mid-week; no collision with the session day).
  it('mid-week: Tomorrow=+1, In 2 days=+2 from TODAY; Next week=+7 from the SESSION', () => {
    const s = moveShortcuts('2026-07-15', '2026-07-08')
    const by = Object.fromEntries(s.map((x) => [x.key, x.date]))
    expect(by.tomorrow).toBe('2026-07-09') // today(Wed 8) + 1
    expect(by.in2).toBe('2026-07-10')      // today(Wed 8) + 2
    expect(by.nextweek).toBe('2026-07-22') // session(Wed 15) + 7
  })
  it('mid-week (Wed 8): This weekend = the coming Saturday (Jul 11)', () => {
    const s = moveShortcuts('2026-07-10', '2026-07-08')
    expect(s.find((x) => x.key === 'weekend')?.date).toBe('2026-07-11')
  })
  it('already the weekend (Sat 11): This weekend jumps to NEXT Saturday (Jul 18)', () => {
    const s = moveShortcuts('2026-07-10', '2026-07-11')
    expect(s.find((x) => x.key === 'weekend')?.date).toBe('2026-07-18')
  })
  it('already the weekend (Sun 12): This weekend jumps to NEXT Saturday (Jul 18)', () => {
    const s = moveShortcuts('2026-07-10', '2026-07-12')
    expect(s.find((x) => x.key === 'weekend')?.date).toBe('2026-07-18')
  })
  it('Friday: This weekend is tomorrow (coming Sat), not next week', () => {
    // Today = Fri Jul 10; coming Saturday is Jul 11.
    const s = moveShortcuts('2026-07-03', '2026-07-10')
    expect(s.find((x) => x.key === 'weekend')?.date).toBe('2026-07-11')
  })
  it('drops a shortcut that lands on the session\'s own day (no-op move)', () => {
    // Session on Jul 9; today Jul 8 → "Tomorrow" == Jul 9 == the session day → dropped.
    const s = moveShortcuts('2026-07-09', '2026-07-08')
    expect(s.find((x) => x.key === 'tomorrow')).toBeUndefined()
    // The others still resolve to other days.
    expect(s.length).toBe(3)
  })
  it('always carries a human label + a resolved date', () => {
    for (const x of moveShortcuts('2026-07-10', '2026-07-08')) {
      expect(x.label).toBeTruthy()
      expect(x.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})

describe('weekStrip — Mon→Sun of the anchor\'s week', () => {
  it('returns 7 keys, Monday first, Sunday last', () => {
    const w = weekStrip('2026-07-10') // Friday
    expect(w).toHaveLength(7)
    expect(w[0]).toBe('2026-07-06') // Mon
    expect(w[6]).toBe('2026-07-12') // Sun
  })
  it('is contiguous (each cell is the previous + 1 day)', () => {
    const w = weekStrip('2026-07-10')
    for (let i = 1; i < w.length; i++) expect(w[i]).toBe(addDays(w[i - 1], 1))
  })
  it('a Sunday anchor still yields that same Mon→Sun week', () => {
    expect(weekStrip('2026-07-12')).toEqual(weekStrip('2026-07-06'))
  })
})
