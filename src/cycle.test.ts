import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { normalizePhase, phaseFromDay, cycleLoadModifier, cycleReadinessAdjust, cycleContext } from '../server/cycle.js'

// #329 — menstrual-cycle factor for coaching + readiness.
describe('normalizePhase (intervals menstrualPhase text → canonical)', () => {
  it('maps common labels', () => {
    expect(normalizePhase('Period')).toBe('menstrual')
    expect(normalizePhase('follicular')).toBe('follicular')
    expect(normalizePhase('Ovulation')).toBe('ovulatory')
    expect(normalizePhase('luteal')).toBe('luteal')
    expect(normalizePhase('late luteal (PMS)')).toBe('late_luteal')
  })
  it('unknown/empty → null', () => { expect(normalizePhase('')).toBeNull(); expect(normalizePhase('xyz')).toBeNull() })
})

describe('phaseFromDay (28-day default + scaling)', () => {
  it('walks the phases across a 28-day cycle', () => {
    expect(phaseFromDay(1)).toBe('menstrual')
    expect(phaseFromDay(10)).toBe('follicular')
    expect(phaseFromDay(14)).toBe('ovulatory')
    expect(phaseFromDay(20)).toBe('luteal')
    expect(phaseFromDay(27)).toBe('late_luteal')
  })
  it('wraps days beyond the cycle length', () => { expect(phaseFromDay(29)).toBe('menstrual') })
  it('scales ovulation to a longer cycle', () => { expect(phaseFromDay(16, 32)).toBe('follicular') /* ovul ~day 18 in a 32d */ })
})

describe('load modifier — push in follicular, ease late-luteal', () => {
  it('follicular ≥ 1, late-luteal well below 1, ordering holds', () => {
    expect(cycleLoadModifier('follicular')).toBeGreaterThanOrEqual(1)
    expect(cycleLoadModifier('late_luteal')).toBeLessThan(cycleLoadModifier('luteal'))
    expect(cycleLoadModifier('luteal')).toBeLessThanOrEqual(1)
  })
})

describe('readiness adjust — luteal expects higher RHR / lower HRV (don\'t penalise)', () => {
  it('late-luteal shift is the largest', () => {
    expect(cycleReadinessAdjust('late_luteal').rhrBpm).toBeGreaterThan(cycleReadinessAdjust('luteal').rhrBpm)
    expect(cycleReadinessAdjust('follicular')).toEqual({ rhrBpm: 0, hrvPct: 0 })
  })
})

describe('cycleContext', () => {
  it('from an intervals phase string', () => {
    const c = cycleContext({ phase: 'Luteal' })
    expect(c.phase).toBe('luteal'); expect(c.loadModifier).toBe(0.95); expect(c.guidance).toMatch(/luteal/i)
  })
  it('from a cycle day when no phase text', () => {
    expect(cycleContext({ cycleDay: 3 }).phase).toBe('menstrual')
  })
  it('null when nothing known', () => expect(cycleContext({})).toBeNull())
})
