import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import * as srv from '../server/perf-metrics.js'
import { tteFromPower, tteFromPace, tteModelPower, tteModelPace } from './tte'

// #404 — server/perf-metrics.js MIRRORS src/tte.ts + src/athlete-profile.ts so the COACH reasons with the
// same numbers the UI shows. These tests (a) lock the mirror to the client (parity) and (b) cover the
// server-only helpers efSummary + athleteProfile. If parity breaks, the two drifted — fix the mirror.

describe('perf-metrics TTE parity with src/tte.ts (#404)', () => {
  it('tteFromPower matches the client', () => {
    const secs = [60, 300, 600, 1200], watts = [400, 300, 260, 240]
    expect(srv.tteFromPower(secs, watts, 250)).toBe(tteFromPower(secs, watts, 250)) // 600
    expect(srv.tteFromPower(secs, watts, 250)).toBe(600)
    expect(srv.tteFromPower(secs, watts, 500)).toBeNull()        // none ≥ 500
    expect(srv.tteFromPower([60], [300], 250)).toBeNull()        // 60 s < MIN_TTE_SEC floor
  })
  it('tteModelPower matches the client (W′ in Joules, floor + 2 h cap)', () => {
    expect(srv.tteModelPower(260, 240, 18000)).toBe(tteModelPower(260, 240, 18000)) // 900
    expect(srv.tteModelPower(260, 240, 18000)).toBe(900)
    expect(srv.tteModelPower(240, 248, 18000)).toBeNull()        // eFTP ≤ CP → unbounded
    expect(srv.tteModelPower(250, 248, 100)).toBeNull()          // 50 s < floor
    expect(srv.tteModelPower(250, 248, 100000)).toBe(7200)       // capped at 2 h
  })
  it('tteFromPace + tteModelPace match the client', () => {
    const dist = [400, 1000, 3000], timeSec = [80, 220, 720] // 3 k @ 240 s/km, 1 k @ 220, 400 @ 200
    expect(srv.tteFromPace(dist, timeSec, 240)).toBe(tteFromPace(dist, timeSec, 240))
    expect(srv.tteModelPace(300, 3.0, 200)).toBe(tteModelPace(300, 3.0, 200))
  })
})

describe('efSummary (#404)', () => {
  it('flags a rising trend + latest + delta%', () => {
    const r = srv.efSummary([{ ef: 1.5 }, { ef: 1.6 }, { ef: 1.7 }, { ef: 1.8 }])
    expect(r.trend).toBe('up')
    expect(r.latest).toBe(1.8)
    expect(r.deltaPct).toBeGreaterThan(0)
  })
  it('flags a falling trend', () => {
    expect(srv.efSummary([{ ef: 1.8 }, { ef: 1.7 }, { ef: 1.6 }, { ef: 1.5 }]).trend).toBe('down')
  })
  it('needs ≥2 points for a trend', () => {
    expect(srv.efSummary([{ ef: 1.5 }])).toEqual({ latest: 1.5, trend: null, deltaPct: null })
    expect(srv.efSummary([]).latest).toBeNull()
  })
})

describe('athleteProfile (#404)', () => {
  const focusEffortsAreData = (f: string[]) => f.some((x) => /efforts ARE the data/i.test(x) && /only if the fit goes stale/i.test(x))
  it('short TTE → Punchy threshold, focus leans on efforts (test only if stale, not "never") — #408', () => {
    const p = srv.athleteProfile({ sport: 'cycling', tte: 12 * 60, threshold: 260, eftp: 253, reserveKj: 17, reserveBig: 20 })
    expect(p.type).toBe('Punchy threshold')
    expect(p.tteMin).toBeCloseTo(12)
    expect(focusEffortsAreData(p.focus)).toBe(true)
  })
  it('long TTE + big reserve → All-rounder; long TTE + small reserve → Diesel engine', () => {
    expect(srv.athleteProfile({ sport: 'cycling', tte: 50 * 60, reserveKj: 25, reserveBig: 20 }).type).toBe('All-rounder')
    expect(srv.athleteProfile({ sport: 'cycling', tte: 50 * 60, reserveKj: 10, reserveBig: 20 }).type).toBe('Diesel engine')
  })
})
