import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { localDate } from '../server/tz.js'

// #5026 — "today" must be the ATHLETE's local date, not the server's UTC date. JM (America/Toronto) at 20:29 on Jul 14
// is still Jul 14, but the UTC server is already Jul 15 — which used to make his actual-today ride look "past".
describe('localDate (athlete-local calendar date)', () => {
  it("JM's evening: 2026-07-15T00:29Z is still Jul 14 in America/Toronto", () => {
    expect(localDate(new Date('2026-07-15T00:29:00Z'), 'America/Toronto')).toBe('2026-07-14')
  })
  it('same instant is already Jul 15 in UTC (the server bug)', () => {
    expect(localDate(new Date('2026-07-15T00:29:00Z'), 'UTC')).toBe('2026-07-15')
  })
  it('daytime Toronto matches the UTC day', () => {
    expect(localDate(new Date('2026-07-15T16:00:00Z'), 'America/Toronto')).toBe('2026-07-15')
  })
  it('a Pacific athlete late evening is still the prior day', () => {
    expect(localDate(new Date('2026-07-15T05:00:00Z'), 'America/Los_Angeles')).toBe('2026-07-14')
  })
  it('an ahead-of-UTC zone can be the NEXT day', () => {
    expect(localDate(new Date('2026-07-14T20:00:00Z'), 'Asia/Tokyo')).toBe('2026-07-15')
  })
  it('no timezone → falls back to the UTC date (never throws)', () => {
    expect(localDate(new Date('2026-07-15T00:29:00Z'), undefined)).toMatch(/^2026-07-1[45]$/)
  })
  it('invalid timezone → falls back, does not throw', () => {
    expect(() => localDate(new Date('2026-07-15T00:29:00Z'), 'Not/AZone')).not.toThrow()
  })
})
