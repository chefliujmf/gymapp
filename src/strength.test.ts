import { describe, it, expect } from 'vitest'
import { e1rm, e1rmRpe, e1rmConfidence } from './strength'

// #497 — RPE-adjusted e1RM (gym analog of "estimate from the effort you actually gave"). Science: docs/e1rm.md.
describe('e1rmRpe', () => {
  it('no RPE → identical to the plain e1rm (backward compatible)', () => {
    expect(e1rmRpe(100, 5)).toBeCloseTo(e1rm(100, 5), 6)
    expect(e1rmRpe(100, 5, null)).toBeCloseTo(e1rm(100, 5), 6)
  })
  it('RPE 10 (to failure) → same as plain; RPE < 10 (reps in reserve) → HIGHER 1RM', () => {
    expect(e1rmRpe(100, 5, 10)).toBeCloseTo(e1rm(100, 5), 6)
    expect(e1rmRpe(100, 5, 8)).toBeGreaterThan(e1rm(100, 5)) // 2 in reserve ⇒ true 1RM is higher
    expect(e1rmRpe(100, 5, 8)).toBeGreaterThan(e1rmRpe(100, 5, 9)) // more reserve ⇒ higher
  })
  it('a single rep at RPE 8 implies more than 1 rep (RIR) → above the bar weight', () => {
    expect(e1rmRpe(100, 1, 10)).toBe(100) // a true 1RM
    expect(e1rmRpe(100, 1, 8)).toBeGreaterThan(100)
  })
  it('guards: zero weight/reps → 0', () => {
    expect(e1rmRpe(0, 5, 8)).toBe(0)
    expect(e1rmRpe(100, 0, 8)).toBe(0)
  })
})

// #497 — honest confidence: an e1RM is only as trustworthy as the effort behind it.
describe('e1rmConfidence', () => {
  it('a heavy low-rep set reads strong; a high-rep set reads rough', () => {
    const heavy = e1rmConfidence({ reps: 3, rpe: 9 })
    const light = e1rmConfidence({ reps: 15, rpe: 6 })
    expect(heavy.pct).toBeGreaterThan(light.pct)
    expect(heavy.cls).toBe('strong')
    expect(light.cls).toBe('learn')
    expect(light.label).toMatch(/rough/i)
  })
  it('missing RPE is penalised (we had to assume near-failure)', () => {
    expect(e1rmConfidence({ reps: 5, rpe: 9 }).pct).toBeGreaterThan(e1rmConfidence({ reps: 5 }).pct)
  })
  it('a stale max is a weaker claim on today\'s strength', () => {
    expect(e1rmConfidence({ reps: 3, rpe: 9, ageDays: 5 }).pct).toBeGreaterThan(e1rmConfidence({ reps: 3, rpe: 9, ageDays: 90 }).pct)
  })
  it('pct stays within [30, 95]', () => {
    for (const t of [{ reps: 1, rpe: 10 }, { reps: 30 }, { reps: 20, ageDays: 200 }]) {
      const c = e1rmConfidence(t)
      expect(c.pct).toBeGreaterThanOrEqual(30)
      expect(c.pct).toBeLessThanOrEqual(95)
    }
  })
})
