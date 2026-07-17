import { describe, it, expect } from 'vitest'
import { criticalSwimSpeed, swimZones, zoneForPace, swimTSS, estimateCssFromEffort, fmtPace100, swolf } from './swimming'

describe('criticalSwimSpeed (400/200 test)', () => {
  it('computes CSS speed + pace/100 from the two time-trials', () => {
    const r = criticalSwimSpeed(360, 172)! // 400 in 6:00, 200 in 2:52
    expect(r.cssSpeed).toBeCloseTo(200 / 188, 3) // ~1.064 m/s
    expect(Math.round(r.cssPace100)).toBe(94) // ~1:34 /100
  })
  it('rejects bad input (400 must take LONGER than 200)', () => {
    expect(criticalSwimSpeed(170, 172)).toBeNull()
    expect(criticalSwimSpeed(0, 100)).toBeNull()
  })
  it('works in yards too (ratio is unit-agnostic)', () => {
    expect(criticalSwimSpeed(360, 172, 400, 200)!.cssPace100).toBeGreaterThan(0)
  })
})

describe('swimZones', () => {
  it('threshold zone (3) brackets CSS pace; easy is slower, sprint is faster', () => {
    const css = 90 // 1:30 /100
    const z = swimZones(css)
    const z3 = z.find((x) => x.zone === 3)!
    expect(z3.paceFast).toBeLessThan(css) // fast end quicker than CSS
    expect(z3.paceSlow).toBeGreaterThan(css - 5) // slow end near CSS
    expect(z.find((x) => x.zone === 1)!.paceSlow).toBeGreaterThan(css) // easy is slower (bigger number)
    expect(z.find((x) => x.zone === 5)!.paceFast).toBeLessThan(css) // sprint is faster
  })
})

describe('zoneForPace', () => {
  const css = 90
  it('CSS pace → threshold zone 3', () => { expect(zoneForPace(css, 90)).toBe(3) })
  it('much slower → easy zone 1', () => { expect(zoneForPace(css, 120)).toBe(1) })
  it('much faster → sprint zone 5', () => { expect(zoneForPace(css, 78)).toBe(5) })
})

describe('swimTSS', () => {
  it('1 h exactly at CSS ≈ 100', () => { expect(swimTSS(3600, 90, 90)).toBe(100) })
  it('easy pace scores less than threshold', () => {
    expect(swimTSS(3600, 110, 90)).toBeLessThan(swimTSS(3600, 90, 90))
  })
})

describe('estimateCssFromEffort', () => {
  it('a 20 min sustained effort ≈ CSS at that pace', () => {
    const r = estimateCssFromEffort(1200, 92)!
    expect(Math.round(r.cssPace100)).toBe(92)
  })
  it('needs ≥ ~8 min', () => { expect(estimateCssFromEffort(300, 90)).toBeNull() })
})

describe('helpers', () => {
  it('fmtPace100', () => { expect(fmtPace100(94)).toBe('1:34'); expect(fmtPace100(0)).toBe('—') })
  it('swolf = time + strokes', () => { expect(swolf(30, 16)).toBe(46) })
})
