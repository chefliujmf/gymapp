import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { lnRMSSD, meanSd, zTo5, score100To5, lerpMap, baselines, freshness, energy, sleep, readiness, MIN_BASELINE_DAYS } from '../server/readiness.js'

// #195 readiness math, grounded in docs/readiness-scores.md (WHOOP deep-dive 2026-06-28).

describe('stats primitives', () => {
  it('lnRMSSD log-transforms (and rejects non-positive)', () => {
    expect(lnRMSSD(50)).toBeCloseTo(Math.log(50), 5)
    expect(lnRMSSD(0)).toBeNull(); expect(lnRMSSD(null)).toBeNull()
  })
  it('zTo5: z=0→3, +1.5σ→5, −1.5σ→1; inverse flips', () => {
    expect(zTo5(0)).toBe(3); expect(zTo5(1.5)).toBe(5); expect(zTo5(-1.5)).toBe(1)
    expect(zTo5(1.5, -1)).toBe(1) // inverse (e.g. RHR up = worse)
  })
  it('score100To5 maps a device 0–100', () => { expect(score100To5(100)).toBe(5); expect(score100To5(60)).toBe(3); expect(score100To5(0)).toBe(1) })
  it('lerpMap interpolates + clamps at ends', () => {
    expect(lerpMap(0.9, [[0.8, 5], [1.0, 4]])).toBeCloseTo(4.5, 5)
    expect(lerpMap(0.5, [[0.8, 5], [1.0, 4]])).toBe(5) // below range → first
    expect(lerpMap(2, [[0.8, 5], [1.0, 4]])).toBe(4) // above → last
  })
})

describe('baselines — cold-start gate', () => {
  const days = (n: number, hrv: number) => Array.from({ length: n }, (_, i) => ({ date: `d${i}`, hrv, restingHR: 55 }))
  it(`returns null baselines below ${MIN_BASELINE_DAYS} valid days`, () => {
    const b = baselines(days(MIN_BASELINE_DAYS - 1, 50))
    expect(b.hrvBaseline).toBeNull(); expect(b.rhrBaseline).toBeNull()
  })
  it('computes mean/sd once enough days exist', () => {
    const b = baselines(days(20, 50))
    expect(b.hrvBaseline.mean).toBeCloseTo(Math.log(50), 5)
    expect(b.nHrv).toBe(20)
  })
})

describe('freshness (ACWR + TSB)', () => {
  it('fresh: low load + positive form → ~5', () => {
    const f = freshness({ ctl: 60, atl: 42, form: 18 }) // ACWR 0.7, TSB +18
    expect(f.score).toBeGreaterThanOrEqual(4.5)
  })
  it('neutral/productive training (Form ~0, ACWR ~1) reads fresh-enough (~4), not a conservative 3', () => {
    const f = freshness({ ctl: 31, atl: 32, form: -1 }) // JM's real balanced day
    expect(f.score).toBeGreaterThanOrEqual(3.7)
  })
  it('fatigued: high acute load + negative form → low', () => {
    const f = freshness({ ctl: 60, atl: 90, form: -30 }) // ACWR 1.5, TSB −30
    expect(f.score).toBeLessThanOrEqual(2)
  })
  it('deep volume block (TSB < −30) overrides down to ≤1.5', () => {
    expect(freshness({ ctl: 60, atl: 100, form: -45 }).score).toBeLessThanOrEqual(1.5)
  })
  it('null when no load data', () => { expect(freshness({})).toBeNull() })

  // #207 personalization: blend the absolute anchor with the athlete's OWN TSB range.
  it('a day that is UNUSUALLY loaded for you reads lower than the absolute anchor', () => {
    const args = { ctl: 50, atl: 60, form: -10 } // ACWR 1.2, TSB -10
    const base = freshness(args).score
    const personal = freshness({ ...args, tsbBaseline: { mean: 5, sd: 5 } }).score // today's −10 is well below your usual +5
    expect(personal).toBeLessThan(base)
  })
  it('a NORMAL-for-you day stays at the (fresh-enough) anchor', () => {
    const args = { ctl: 31, atl: 32, form: -1 }
    const base = freshness(args).score
    const personal = freshness({ ...args, tsbBaseline: { mean: -1, sd: 5 } }).score // today == your usual
    expect(personal).toBeCloseTo(base, 1)
    expect(personal).toBeGreaterThanOrEqual(3.7)
  })
})

describe('energy (lnRMSSD-z + sleep + RHR-z + subjective)', () => {
  const hrvBaseline = meanSd(Array.from({ length: 30 }, () => Math.log(50))) // mean ln50, but sd 0...
  // build a baseline with spread so z-scores are meaningful
  const hist = Array.from({ length: 30 }, (_, i) => ({ hrv: 45 + (i % 10), restingHR: 52 + (i % 6) }))
  const base = baselines(hist)
  it('HRV well above personal baseline + good sleep → high energy', () => {
    const e = energy({ hrv: 70, rhr: 50, sleep: 5, hrvBaseline: base.hrvBaseline, rhrBaseline: base.rhrBaseline })
    expect(e.score).toBeGreaterThanOrEqual(4)
  })
  it('HRV well below baseline → low energy', () => {
    const e = energy({ hrv: 30, rhr: 60, sleep: 2, hrvBaseline: base.hrvBaseline, rhrBaseline: base.rhrBaseline })
    expect(e.score).toBeLessThanOrEqual(2.5)
  })
  it('parasympathetic-saturation guard: high HRV + elevated RHR caps the HRV credit', () => {
    const free = energy({ hrv: 75, rhr: 50, sleep: 4, hrvBaseline: base.hrvBaseline, rhrBaseline: base.rhrBaseline })
    const sat = energy({ hrv: 75, rhr: 70, sleep: 4, hrvBaseline: base.hrvBaseline, rhrBaseline: base.rhrBaseline })
    expect(sat.guard).toBe(true)
    expect(sat.score).toBeLessThan(free.score)
  })
  it('cold start (no HRV baseline) → null so the UI keeps the manual tap', () => {
    expect(energy({ hrv: 50, rhr: 55, sleep: 4, hrvBaseline: null })).toBeNull()
  })
  it('uses the subjective tap as a weighted input', () => {
    expect(hrvBaseline.mean).toBeCloseTo(Math.log(50), 5) // sanity
  })
})

describe('sleep (personal need)', () => {
  it('prefers a device sleep score', () => { expect(sleep({ sleepScore: 80 }).score).toBe(4) })
  it('hours ÷ personal need — JM needs ~9h so 7.7h is mediocre, not "great"', () => {
    const jm = sleep({ sleepHours: 7.7, sleepNeed: 9 })
    const avg = sleep({ sleepHours: 7.7, sleepNeed: 8 })
    expect(jm.score).toBeLessThan(avg.score) // same hours, higher need → lower score
    expect(jm.score).toBeLessThanOrEqual(3.5)
  })
  it('meeting need ≈ 4.5+, null without data', () => {
    expect(sleep({ sleepHours: 9, sleepNeed: 9 }).score).toBeGreaterThanOrEqual(4.5)
    expect(sleep({})).toBeNull()
  })
})

describe('readiness() end-to-end', () => {
  const hist = Array.from({ length: 30 }, (_, i) => ({ date: `d${i}`, hrv: 45 + (i % 10), restingHR: 52 + (i % 6) }))
  it('returns all three scores when data is present', () => {
    const r = readiness(hist, { hrv: 60, restingHR: 50, sleepHours: 8, fitness: 60, fatigue: 50, form: 10 }, { sleepNeed: 9 })
    expect(r.sleep.score).toBeGreaterThan(0)
    expect(r.freshness.score).toBeGreaterThan(0)
    expect(r.energy.score).toBeGreaterThan(0)
    expect(r.baseline.nHrv).toBe(30)
  })
  it('cold start: no history → energy null, but sleep + freshness still compute', () => {
    const r = readiness([], { hrv: 60, restingHR: 50, sleepHours: 8, fitness: 60, fatigue: 50, form: 10 })
    expect(r.energy).toBeNull()
    expect(r.sleep.score).toBeGreaterThan(0)
    expect(r.freshness.score).toBeGreaterThan(0)
  })
})
