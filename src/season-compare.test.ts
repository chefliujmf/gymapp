import { describe, it, expect } from 'vitest'
import { bestAt, paceOkay, seasonDelta, seasonSpecs, daysSinceJan1, POWER_DURATIONS, PACE_DISTANCES } from './season-compare'

describe('season-compare pure helpers (#407)', () => {
  it('bestAt returns the value at the first sample ≥ target, null past the curve', () => {
    const secs = [5, 60, 300, 1200, 3600]
    const watts = [900, 450, 320, 250, 210]
    expect(bestAt(secs, watts, 5)).toBe(900)
    expect(bestAt(secs, watts, 300)).toBe(320)
    expect(bestAt(secs, watts, 200)).toBe(320) // between 60 and 300 → the 300 (≥) point
    expect(bestAt(secs, watts, 7200)).toBeNull() // curve doesn't reach 2 h
    expect(bestAt([], [], 5)).toBeNull()
  })
  it('paceOkay rejects intervals garbage (too fast) + absurdly slow', () => {
    expect(paceOkay(240)).toBe(true) // 4:00/km
    expect(paceOkay(5)).toBe(false) // 0:05/km — bad GPS (the #400 bug)
    expect(paceOkay(800)).toBe(false) // 13:20/km — not a real best
    expect(paceOkay(null)).toBe(false)
  })
  it('seasonDelta: power higher-is-better, pace lower-is-better', () => {
    expect(seasonDelta(837, 1079, true)).toBe(-242) // this-season 5s below all-time PR
    expect(seasonDelta(310, 310, true)).toBe(0)
    // pace: this 297 s/km vs all-time 279 → this is 18 s/km SLOWER → negative (worse)
    expect(seasonDelta(297, 279, false)).toBe(-18)
    expect(seasonDelta(279, 297, false)).toBe(18) // this faster → positive (better)
    expect(seasonDelta(null, 300, true)).toBeNull()
  })
  it('seasonSpecs uses YTD for This season + fixed windows for the rest', () => {
    const s = seasonSpecs(188)
    expect(s.map((x) => x.key)).toEqual(['this', 'last', 's2', 'all'])
    expect(s[0].days).toBe(188)
    expect(s.find((x) => x.key === 'last')!.days).toBe(365)
    expect(s.find((x) => x.key === 'all')!.days).toBe(10000)
  })
  it('daysSinceJan1 is 1 on Jan 1 and grows through the year', () => {
    expect(daysSinceJan1(new Date(2026, 0, 1))).toBe(1)
    expect(daysSinceJan1(new Date(2026, 6, 7))).toBeGreaterThan(180) // ~Jul 7
  })
  it('exposes the standard buckets', () => {
    expect(POWER_DURATIONS[0]).toEqual({ secs: 5, label: '5s' })
    expect(POWER_DURATIONS.some((d) => d.secs === 28800)).toBe(true) // 8h
    expect(PACE_DISTANCES.map((d) => d.label)).toContain('half')
  })
})
