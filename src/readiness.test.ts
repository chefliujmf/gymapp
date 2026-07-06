import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { lnRMSSD, meanSd, zTo5, score100To5, lerpMap, baselines, freshness, energy, sleep, readiness, MIN_BASELINE_DAYS, calibrationOffset, learnedOffsets, applyOffset, MIN_CALIBRATION_DAYS, projectForm, projectFormSeries, forecastFreshness, estimateVo2max as estimateVo2maxSrv, bestVo2maxEstimate, hrRatioVo2max } from '../server/readiness.js'

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

describe('#365 forecast = MORNING readiness (exclude the target day’s own session)', () => {
  const state = { ctl: 55, atl: 55 } // balanced, Form ~0 today
  it('a fresh athlete going INTO a day (no load before it) stays fresh — not "wrecked"', () => {
    const f = forecastFreshness(state, []) // no intervening planned load → morning readiness ≈ today
    expect(f.form).toBeCloseTo(0, 0)
    expect(f.freshness).toBeGreaterThanOrEqual(3.7)
  })
  it("(why we exclude it) including that day's own hard session WOULD crash Form → false 'wrecked'", () => {
    const withOwnSession = forecastFreshness(state, [260]) // the OLD behaviour: projects post-session fatigue
    const goingIn = forecastFreshness(state, []) // the FIX: morning readiness
    expect(withOwnSession.form).toBeLessThan(-20)
    expect(withOwnSession.freshness!).toBeLessThan(goingIn.freshness! - 1.2) // dramatically lower — that was the false "wrecked"
  })
  it('accumulates the fatigue of the days BEFORE the target', () => {
    const twoHardDaysBefore = forecastFreshness(state, [200, 200])
    expect(twoHardDaysBefore.form).toBeLessThan(forecastFreshness(state, [200]).form)
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
  // #315 — a NEW athlete (HRV present, no 14-day personal baseline yet) gets a PROVISIONAL Energy
  // from population norms instead of a blank; it flags provisional so the UI says "building".
  it('new athlete with HRV but no baseline → provisional score (not null)', () => {
    const e = energy({ hrv: 50, rhr: 55, sleep: 4, hrvBaseline: null })
    expect(e).not.toBeNull()
    expect(e!.provisional).toBe(true)
    expect(e!.score).toBeGreaterThanOrEqual(1)
    expect(e!.score).toBeLessThanOrEqual(5)
  })
  it('no HRV at all → null so the UI keeps the manual tap', () => {
    expect(energy({ hrv: null, rhr: 55, sleep: 4, hrvBaseline: null })).toBeNull()
  })
  it('readiness() surfaces needDays while provisional (#315/#319)', () => {
    const r = readiness([{ date: '2026-07-01', hrv: null, restingHR: 59 }], { hrv: 46, restingHR: 59, sleepHours: 8, ctl: 11, atl: 12 }, { sleepNeed: 8 })
    expect(r.energy?.provisional).toBe(true)
    expect(r.energy?.needDays).toBeGreaterThan(0)
  })
  it('uses the subjective tap as a weighted input', () => {
    expect(hrvBaseline.mean).toBeCloseTo(Math.log(50), 5) // sanity
  })
})

describe('sleep (personal need)', () => {
  it('prefers a device sleep score', () => { expect(sleep({ sleepScore: 80 }).score).toBe(4) })
  it('#159 — a tracker score STILL carries sleepHours + sleepNeed (so the "why" can show hours vs need)', () => {
    const s = sleep({ sleepScore: 75, sleepHours: 6.2, sleepNeed: 8 })
    expect(s.sleepScore).toBe(75)
    expect(s.sleepHours).toBe(6.2)
    expect(s.sleepNeed).toBe(8)
  })
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
  it('cold start with HRV: energy is PROVISIONAL (not blank), sleep + freshness compute (#315)', () => {
    const r = readiness([], { hrv: 60, restingHR: 50, sleepHours: 8, fitness: 60, fatigue: 50, form: 10 })
    expect(r.energy).not.toBeNull()
    expect(r.energy.provisional).toBe(true)
    expect(r.energy.needDays).toBeGreaterThan(0)
    expect(r.sleep.score).toBeGreaterThan(0)
    expect(r.freshness.score).toBeGreaterThan(0)
  })
})

// #207 Phase 2b — learn a personal calibration from systematic overrides (gradual drift).
describe('calibrationOffset (gradual drift)', () => {
  it('no offset until MIN_CALIBRATION_DAYS of signal', () => {
    expect(calibrationOffset([1, 1, 1, 1])).toBe(0) // only 4 days
    expect(MIN_CALIBRATION_DAYS).toBe(5)
  })
  it('consistent +1 overrides → a positive (but damped) offset', () => {
    const off = calibrationOffset([1, 1, 1, 1, 1]) // 5 days, +1 each
    expect(off).toBeGreaterThan(0)
    expect(off).toBeLessThanOrEqual(1)
  })
  it('grows with evidence then caps at ±1', () => {
    const few = calibrationOffset(Array(5).fill(1))
    const many = calibrationOffset(Array(20).fill(2))
    expect(many).toBeGreaterThan(few)
    expect(many).toBe(1) // capped
    expect(calibrationOffset(Array(20).fill(-2))).toBe(-1)
  })
  it('agreement (deltas ~0) → no drift', () => {
    expect(calibrationOffset([0, 0, 1, -1, 0, 0])).toBe(0)
  })
  it('ignores a tiny systematic bias (<0.2)', () => {
    expect(calibrationOffset(Array(10).fill(0.1))).toBe(0)
  })
  it('a single off day cannot swing it', () => {
    expect(calibrationOffset([0, 0, 0, 0, 3])).toBe(0) // mean 0.6 × conf 0.5 = 0.3, but one outlier among agreement
  })
})

describe('learnedOffsets (per dimension, freshness = 6 − soreness)', () => {
  const mk = (auto: any, energy?: number, sleep?: number, soreness?: number) => ({ auto, energy, sleep, soreness })
  it('learns each dimension independently', () => {
    // user consistently feels FRESHER than computed (sets freshness high → soreness low)
    const checkins = Array.from({ length: 8 }, () => mk({ energy: 3, sleep: 3, freshness: 3 }, 3, 3, 1)) // user freshness = 6−1 = 5, +2 vs auto 3
    const off = learnedOffsets(checkins)
    expect(off.freshness).toBeGreaterThan(0)
    expect(off.energy).toBe(0) // energy matched
    expect(off.sleep).toBe(0)
  })
  it('skips check-ins without a stored auto value', () => {
    expect(learnedOffsets([{ energy: 5 }, { energy: 1 }])).toEqual({ energy: 0, sleep: 0, freshness: 0 })
  })
})

describe('readiness() applies the learned calibration', () => {
  const hist = Array.from({ length: 30 }, (_, i) => ({ date: `d${i}`, hrv: 45 + (i % 10), restingHR: 52 + (i % 6) }))
  it('nudges the energy score toward what the athlete reports, keeps the raw', () => {
    // 10 days where the athlete rated energy 2 points above the model
    const checkins = Array.from({ length: 10 }, () => ({ auto: { energy: 2 }, energy: 4 }))
    const plain = readiness(hist, { hrv: 60, restingHR: 50, sleepHours: 8, fitness: 60, fatigue: 50, form: 10 })
    const cal = readiness(hist, { hrv: 60, restingHR: 50, sleepHours: 8, fitness: 60, fatigue: 50, form: 10 }, { checkins })
    expect(cal.calibration.energy).toBeGreaterThan(0)
    expect(cal.energy.score).toBeGreaterThan(plain.energy.score)
    expect(cal.energy.raw).toBe(plain.energy.score) // raw preserved
  })
  it('no check-in history → no calibration, scores unchanged', () => {
    const r = readiness(hist, { hrv: 60, restingHR: 50, sleepHours: 8, fitness: 60, fatigue: 50, form: 10 })
    expect(r.calibration).toEqual({ energy: 0, sleep: 0, freshness: 0 })
  })
})

// #223 — forecast a future day's freshness from planned load.
describe('projectForm (CTL/ATL projection)', () => {
  it('no planned load → rest days raise Form (fatigue decays faster than fitness)', () => {
    const p = projectForm({ ctl: 50, atl: 60 }, [0, 0, 0]) // 3 rest days
    expect(p.form).toBeGreaterThan(50 - 60) // Form rises from −10
    expect(p.atl).toBeLessThan(60)
  })
  it('a hard day drops Form (ATL jumps)', () => {
    const rest = projectForm({ ctl: 50, atl: 50 }, [0])
    const hard = projectForm({ ctl: 50, atl: 50 }, [120])
    expect(hard.form).toBeLessThan(rest.form)
  })
  it('empty plan → unchanged', () => {
    expect(projectForm({ ctl: 50, atl: 45 }, [])).toEqual({ ctl: 50, atl: 45, form: 5 })
  })
})

describe('projectFormSeries (#248 per-day projection)', () => {
  it('one entry per planned day, Form = CTL−ATL', () => {
    const s = projectFormSeries({ ctl: 50, atl: 50 }, [0, 0, 100])
    expect(s).toHaveLength(3)
    expect(s[0].form).toBeCloseTo(s[0].ctl - s[0].atl, 5)
    expect(s[2].atl).toBeGreaterThan(s[1].atl) // the 100-TSS day raises ATL
  })
  it('rest days raise Form over time', () => {
    const s = projectFormSeries({ ctl: 50, atl: 60 }, [0, 0, 0, 0])
    expect(s[3].form).toBeGreaterThan(s[0].form)
  })
})

describe('forecastFreshness', () => {
  it('returns an expected freshness 1–5 from projected Form', () => {
    const f = forecastFreshness({ ctl: 50, atl: 50 }, [0, 0]) // tapering → fresher
    expect(f.freshness).toBeGreaterThanOrEqual(1)
    expect(f.freshness).toBeLessThanOrEqual(5)
    expect(f.form).toBeGreaterThan(0)
  })
  it('a big planned block forecasts LOWER freshness than rest', () => {
    const rest = forecastFreshness({ ctl: 50, atl: 50 }, [0, 0, 0])
    const block = forecastFreshness({ ctl: 50, atl: 50 }, [110, 110, 110])
    expect(block.freshness).toBeLessThan(rest.freshness)
  })
})

// #207 Part 4 — the server VO₂max estimate the coach reads must match the client one.
describe('estimateVo2max (server, parity with client)', () => {
  it('cycling Coggan', () => expect(estimateVo2maxSrv({ ftp: 260, weightKg: 76 }).value).toBeCloseTo(10.8 * 260 / 76 + 7, 1))
  it('takes the higher of cycling vs VDOT', () => expect(estimateVo2maxSrv({ ftp: 260, weightKg: 76, vdot: 50 }).value).toBe(50))
  it('null without inputs', () => expect(estimateVo2maxSrv({})).toBeNull())
})

// #236 — server-side best VO₂max (coach's "computed"), matches the client submax.
describe('bestVo2maxEstimate (server)', () => {
  it('HR-ratio (185/55) beats a slow VDOT (41) → ~50.5 from HR', () => {
    const e = bestVo2maxEstimate({ vdot: 41, hrMax: 185, hrRest: 55 })
    expect(e!.value).toBeGreaterThan(49)
    expect(e!.source).toMatch(/HR/)
  })
  it('hrRatioVo2max matches the client formula', () => {
    expect(hrRatioVo2max(185, 55)).toBeCloseTo(15.3 * 185 / 55, 1)
  })
  it('null with nothing', () => expect(bestVo2maxEstimate({})).toBeNull())
})

describe('applyOffset', () => {
  it('clamps to 1–5 and no-ops on 0/null', () => {
    expect(applyOffset(4.5, 1)).toBe(5)
    expect(applyOffset(1.2, -1)).toBe(1)
    expect(applyOffset(3, 0)).toBe(3)
    expect(applyOffset(null, 1)).toBeNull()
  })
})
