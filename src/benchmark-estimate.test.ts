import { describe, it, expect } from 'vitest'
import { ftpEstimate, thresholdPaceEstimate, modelEstimate, tteEstimate, maxHrEstimate, honestEstimate, ftpFromHrPower, type Src } from './benchmark-estimate'

// #497 — infer FTP from the HR cost of steady rides (no test needed). JM's example: easy at 200 W ⇒ high FTP.
describe('ftpFromHrPower', () => {
  it("JM's case: rides spanning 150-250 W read a high FTP (~320), not 200", () => {
    const e = ftpFromHrPower([{ watts: 150, hr: 95 }, { watts: 200, hr: 110 }, { watts: 250, hr: 130 }], 185)!
    expect(e).not.toBeNull()
    expect(e.best).toBeGreaterThanOrEqual(315)
    expect(e.best).toBeLessThanOrEqual(335)
    expect(e.lo).toBeLessThan(e.best)
    expect(e.hi).toBeGreaterThan(e.best) // honest band, not a false-precise single number
  })
  it('needs a range of intensities: all points at one HR → null (no slope to fit)', () => {
    expect(ftpFromHrPower([{ watts: 200, hr: 110 }, { watts: 205, hr: 110 }], 185)).toBeNull()
  })
  it('needs ≥2 points and a max HR', () => {
    expect(ftpFromHrPower([{ watts: 200, hr: 110 }], 185)).toBeNull()
    expect(ftpFromHrPower([{ watts: 150, hr: 95 }, { watts: 250, hr: 130 }], null)).toBeNull()
  })
  it('a stronger engine (lower HR at the same powers) reads a higher FTP', () => {
    const weak = ftpFromHrPower([{ watts: 150, hr: 120 }, { watts: 250, hr: 160 }], 185)!
    const strong = ftpFromHrPower([{ watts: 150, hr: 100 }, { watts: 250, hr: 130 }], 185)!
    expect(strong.best).toBeGreaterThan(weak.best)
  })
})

// #497 — the HR-power read shows up as a source in the card (no manual/eFTP needed to get a real number).
describe('ftpEstimate + HR-power', () => {
  it('with only HR-power data, still produces an FTP + surfaces the source', () => {
    const e = ftpEstimate({ eftp: null, hrPower: [{ watts: 150, hr: 95 }, { watts: 200, hr: 110 }, { watts: 250, hr: 130 }], maxHr: 185 })
    expect(e.best).toBeGreaterThanOrEqual(300) // reads high, not 'no data'
    expect(e.sources.find((s) => s.name === 'HR vs power')?.value).toBeGreaterThan(300)
  })
})

// #5007 — the whole point: a stale intervals eFTP that disagrees with CP must NOT read "Strong", and the number
// should lean toward the agreeing sources. A fresh, agreeing set CAN read strong.
describe('ftpEstimate', () => {
  it("JM's case: stale eFTP 240 vs CP 248 → honest, not strong, leans to ~247", () => {
    const e = ftpEstimate({ eftp: 240, eftpAgeDays: 34, cp: 248, best20: 260 })
    expect(e.best).toBeGreaterThanOrEqual(244)
    expect(e.best).toBeLessThanOrEqual(250)
    expect(e.conf.cls).not.toBe('strong')
    expect(e.why).toMatch(/stale/i)
    expect(e.why).toMatch(/CP/)
    expect(e.sources.find((s) => s.name === 'intervals eFTP')?.tag).toBe('stale')
  })
  it('fresh eFTP that agrees with CP + 20-min → strong', () => {
    const e = ftpEstimate({ eftp: 250, eftpAgeDays: 4, cp: 249, best20: 263 })
    expect(e.conf.cls).toBe('strong')
    expect(e.best).toBeGreaterThanOrEqual(248)
    expect(e.best).toBeLessThanOrEqual(252)
  })
  it('no power data → no estimate, not strong', () => {
    const e = ftpEstimate({ eftp: null, cp: null })
    expect(e.best).toBeNull()
    expect(e.conf.cls).not.toBe('strong')
    expect(e.why).toMatch(/effort|set the FTP/i)
  })
  // The value you TRAIN BY anchors the number — easy/stale data must NOT lowball your known FTP (JM: "estimate
  // is bad if it can't see my FTP is 260").
  it('manual 260 + stale eFTP 240 (easy rides) → shows 260, unconfirmed, not lowballed', () => {
    const e = ftpEstimate({ eftp: 240, eftpAgeDays: 34, cp: 248, best20: 200, manual: 260 })
    expect(e.best).toBe(260)
    expect(e.conf.cls).not.toBe('strong')
    expect(e.why).toMatch(/hard|confirm|effort/i)
  })
  it('manual 260 + a FRESH hard eFTP that agrees → confirmed strong', () => {
    const e = ftpEstimate({ eftp: 258, eftpAgeDays: 5, manual: 260 })
    expect(e.best).toBe(260)
    expect(e.conf.cls).toBe('strong')
  })
  it('manual 240 + a FRESH hard eFTP 270 that disagrees → nudges up, re-test', () => {
    const e = ftpEstimate({ eftp: 270, eftpAgeDays: 5, manual: 240 })
    expect(e.best).toBeGreaterThan(245)
    expect(e.best).toBeLessThan(266)
    expect(e.conf.cls).not.toBe('strong')
  })
})

describe('thresholdPaceEstimate (sec/km)', () => {
  it('modeled from CS with NO recent test → not strong', () => {
    const e = thresholdPaceEstimate({ csDerived: 252, csAgeDays: 9, vdot: 255 })
    expect(e.conf.cls).not.toBe('strong')
    expect(e.why).toMatch(/no recent|modeled|firm/i)
  })
  it('a fresh TT that agrees → strong', () => {
    const e = thresholdPaceEstimate({ csDerived: 252, csAgeDays: 5, recentTt: 251, ttAgeDays: 6, vdot: 253 })
    expect(e.conf.cls).toBe('strong')
  })
})

describe('modelEstimate (CP/W′/CS/D′)', () => {
  it('good fit, fresh, enough efforts → strong', () => {
    const e = modelEstimate({ value: 248, r2: 0.98, sampleN: 3, ageDays: 6, unit: 'W', noun: 'CP' })
    expect(e.conf.cls).toBe('strong')
    expect(e.best).toBe(248)
  })
  it('few efforts + stale + poor fit → not strong', () => {
    const e = modelEstimate({ value: 185, r2: 0.9, sampleN: 1, ageDays: 40, unit: 'm', noun: "D′" })
    expect(e.conf.cls).not.toBe('strong')
  })
})

describe('tteEstimate', () => {
  it('observed 34-min hold → strong, real read', () => {
    const e = tteEstimate({ observedSec: 2040, observedAgeDays: 10 })
    expect(e.conf.cls).toBe('strong')
    expect(e.why).toMatch(/held/i)
  })
  it('modeled only (no real hold) → not strong', () => {
    const e = tteEstimate({ modeledSec: 1920 })
    expect(e.conf.cls).not.toBe('strong')
    expect(e.why).toMatch(/modeled|confirm/i)
  })
})

describe('maxHrEstimate (per sport)', () => {
  it('fresh observed peak → strong', () => {
    const e = maxHrEstimate({ observed: 192, observedAgeDays: 11, ceiling: 193, sport: 'running' })
    expect(e.conf.cls).toBe('strong')
    expect(e.why).toMatch(/192/)
  })
  it('only an intervals ceiling → not strong, points at a real effort', () => {
    const e = maxHrEstimate({ observed: null, ceiling: 188 })
    expect(e.conf.cls).not.toBe('strong')
    expect(e.why).toMatch(/ceiling|all-out|effort/i)
  })
})

describe('honestEstimate core', () => {
  it('a stale source is down-weighted so the blend leans to the fresh one', () => {
    const sources: Src[] = [
      { name: 'stale', value: 200, ageDays: 90, kind: 'observed' },
      { name: 'fresh', value: 250, ageDays: 2, kind: 'observed' },
    ]
    const e = honestEstimate(sources, { freshDays: 21 })
    expect(e.best).toBeGreaterThan(225) // pulled toward the fresh 250, not the midpoint 225
  })
  it('empty sources → learning, no value', () => {
    const e = honestEstimate([], { freshDays: 21 })
    expect(e.best).toBeNull()
    expect(e.conf.cls).not.toBe('strong')
  })
})
