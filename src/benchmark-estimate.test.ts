import { describe, it, expect } from 'vitest'
import { ftpEstimate, thresholdPaceEstimate, modelEstimate, tteEstimate, maxHrEstimate, honestEstimate, ftpFromHrPower, thresholdPaceFromHrPace, maxHrFromAge, type Src } from './benchmark-estimate'

// #501 — age-based max HR is a FALLBACK: it fills a data-less athlete but must NOT drag a real observed peak down.
describe('maxHrFromAge + fallback', () => {
  it('Tanaka: 208 − 0.7·age', () => { expect(maxHrFromAge(40)).toBe(180); expect(maxHrFromAge(30)).toBe(187) })
  it('#508 Gulati for females: 206 − 0.88·age (lower than the male formula)', () => {
    expect(maxHrFromAge(40, 'female')).toBe(171) // 206 − 35.2
    expect(maxHrFromAge(40, 'female')!).toBeLessThan(maxHrFromAge(40, 'male')!)
  })
  it('rejects nonsense ages', () => { expect(maxHrFromAge(null)).toBeNull(); expect(maxHrFromAge(4)).toBeNull(); expect(maxHrFromAge(120)).toBeNull() })
  it('no observed + no ceiling → uses the age estimate', () => {
    const e = maxHrEstimate({ observed: null, ceiling: null, age: 40 })
    expect(e.best).toBe(180)
    expect(e.why).toMatch(/age/i)
  })
  it('a real observed peak is NOT dragged down by the age formula', () => {
    const e = maxHrEstimate({ observed: 195, observedAgeDays: 30, ceiling: null, age: 40 }) // age would say 180
    expect(e.best).toBe(195)
    expect(e.sources.find((s) => s.name === 'age estimate')).toBeUndefined()
  })
})

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

// #497 running analog — infer threshold pace from the HR cost of steady runs (no hard test needed).
describe('thresholdPaceFromHrPace', () => {
  it('steady runs → a sensible threshold pace (~4:30/km), pace falling as HR rises', () => {
    const e = thresholdPaceFromHrPace([{ paceSecKm: 360, hr: 130 }, { paceSecKm: 300, hr: 150 }, { paceSecKm: 270, hr: 165 }], 185)!
    expect(e).not.toBeNull()
    expect(e.best).toBeGreaterThanOrEqual(260) // ~4:20–4:45/km
    expect(e.best).toBeLessThanOrEqual(285)
    expect(e.lo).toBeLessThan(e.best) // lo = faster pace (lower sec/km)
    expect(e.hi).toBeGreaterThan(e.best) // hi = slower
  })
  it('a fitter runner (faster pace at the same HR) reads a FASTER threshold', () => {
    const slow = thresholdPaceFromHrPace([{ paceSecKm: 360, hr: 140 }, { paceSecKm: 300, hr: 165 }], 185)!
    const fast = thresholdPaceFromHrPace([{ paceSecKm: 300, hr: 140 }, { paceSecKm: 260, hr: 165 }], 185)!
    expect(fast.best).toBeLessThan(slow.best)
  })
  it('all at one HR → null (no slope); and needs ≥2 points + a max HR', () => {
    expect(thresholdPaceFromHrPace([{ paceSecKm: 300, hr: 150 }, { paceSecKm: 302, hr: 150 }], 185)).toBeNull()
    expect(thresholdPaceFromHrPace([{ paceSecKm: 300, hr: 150 }], 185)).toBeNull()
    expect(thresholdPaceFromHrPace([{ paceSecKm: 360, hr: 130 }, { paceSecKm: 270, hr: 165 }], null)).toBeNull()
  })
  it('pace that RISES with HR (noise) → null', () => {
    expect(thresholdPaceFromHrPace([{ paceSecKm: 300, hr: 130 }, { paceSecKm: 360, hr: 165 }], 185)).toBeNull()
  })
  it('surfaces as an "HR vs pace" source in thresholdPaceEstimate', () => {
    const e = thresholdPaceEstimate({ csDerived: null, hrPace: [{ paceSecKm: 360, hr: 130 }, { paceSecKm: 300, hr: 150 }, { paceSecKm: 270, hr: 165 }], maxHr: 185 })
    expect(e.best).not.toBeNull()
    expect(e.sources.find((s) => s.name === 'HR vs pace')?.value).toBeGreaterThan(200)
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
  // #508 (JM: "if 260 were too high I couldn't follow the workouts") — a FRESH but LOW eFTP is an under-read off easy
  // riding; it must NOT drag a training-validated FTP down (the old code blended 260→250).
  it('a fresh LOW eFTP does NOT lower a trained FTP — stays at your value, not blended down', () => {
    const e = ftpEstimate({ eftp: 240, eftpAgeDays: 5, cp: 248, best20: 246, manual: 260 })
    expect(e.best).toBe(260) // NOT 250
    expect(e.why).toMatch(/under-read|validation|too high/i)
  })
  // #506 — JM: "all diff numbers but agrees with the blend?" A computed source far from the value you train by must
  // be tagged low/high (reads lower/higher), NOT blanket 'agrees', and only your manual value is 'primary' (in use).
  it('manual value: sources are tagged by REAL agreement, not rubber-stamped "agrees"', () => {
    const e = ftpEstimate({ eftp: 240, eftpAgeDays: 40, cp: 256, best20: 232, manual: 260 })
    const tag = (n: string) => e.sources.find((s) => s.name === n)?.tag
    expect(tag('you train by')).toBe('primary')       // the only one in use
    expect(tag('from CP')).toBe('agrees')              // 256 within 3% of 260
    expect(tag('best 20-min ×0.95')).toBe('low')       // 220 reads well below 260
    expect(tag('intervals eFTP')).toBe('stale')        // age 40 > fresh window
    expect(e.sources.filter((s) => s.tag === 'agrees').length).toBeLessThan(3) // NOT everything agrees
  })
  // #506b — JM's exact case: CP 248 vs a 260 manual (4.6% off) must read LOWER, not "agrees".
  it('CP 248 vs manual 260 reads "low" (4.6% off is not agreement)', () => {
    const e = ftpEstimate({ eftp: null, cp: 248, manual: 260 })
    expect(e.sources.find((s) => s.name === 'from CP')?.tag).toBe('low')
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
