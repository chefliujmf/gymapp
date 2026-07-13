import { describe, it, expect } from 'vitest'
import { powerAt, tteAtPower, ftpFromCp, cpFromFtp, speedFromPace, paceFromSpeed, paceAt, tteAtPace, thresholdFromCs, fitConfidence } from './cp-model'

// #508 — the coupled Critical-Power engine. CP + W′ define the whole curve; every metric derives from them.
describe('cp-model — cycling (CP/W′)', () => {
  const m = { cp: 248, wPrimeKj: 17.1 }
  it('powerAt: P(t) = CP + W′/t; → CP as t grows', () => {
    expect(powerAt(m, 300)).toBe(305)    // best 5-min
    expect(powerAt(m, 1200)).toBe(262)   // best 20-min
    expect(powerAt(m, 36000)).toBe(248)  // → the CP asymptote
  })
  it('tteAtPower: W′/(P−CP); null at/below CP (sustainable)', () => {
    expect(tteAtPower(m, 260)).toBe(1425) // ~24 min at 260 W
    expect(tteAtPower(m, 248)).toBeNull()
    expect(tteAtPower(m, 240)).toBeNull()
  })
  it('FTP sits just below CP, and cpFromFtp round-trips', () => {
    expect(ftpFromCp(248)).toBeLessThan(248)
    expect(ftpFromCp(248)).toBeGreaterThan(235)
    expect(cpFromFtp(ftpFromCp(248))).toBeCloseTo(248, -1)
  })
  it('COUPLED: raise CP → a fixed power gets far more sustainable (TTE jumps) — one param moves the rest', () => {
    expect(tteAtPower({ cp: 258, wPrimeKj: 17.1 }, 260)!).toBeGreaterThan(tteAtPower({ cp: 248, wPrimeKj: 17.1 }, 260)!)
  })
  it('COUPLED: a bigger W′ battery extends TTE at the same power', () => {
    expect(tteAtPower({ cp: 248, wPrimeKj: 25 }, 260)!).toBeGreaterThan(tteAtPower({ cp: 248, wPrimeKj: 17.1 }, 260)!)
  })
})

describe('cp-model — running mirror (CS/D′)', () => {
  const r = { csPaceSecKm: 320, dPrimeM: 150 } // CS 5:20/km
  it('pace↔speed convert cleanly', () => { expect(paceFromSpeed(speedFromPace(320))).toBe(320) })
  it('paceAt is FASTER than CS at short durations, → CS as t grows', () => {
    expect(paceAt(r, 300)).toBeLessThan(320)
    expect(paceAt(r, 36000)).toBeCloseTo(320, -1)
  })
  it('threshold pace sits just SLOWER than CS (MLSS offset)', () => {
    expect(thresholdFromCs(320)).toBeGreaterThan(320)
  })
  it('tteAtPace: null at/slower than CS', () => {
    expect(tteAtPace(r, 300)).not.toBeNull()
    expect(tteAtPace(r, 330)).toBeNull()
  })
})

describe('fitConfidence', () => {
  it('great fit + many spread efforts + fresh → strong', () => {
    expect(fitConfidence({ r2: 0.99, effortCount: 6, durationSpreadMin: 40, ageDays: 3 }).cls).toBe('strong')
  })
  it('poor/thin/stale fit → learn or need', () => {
    expect(['learn', 'need']).toContain(fitConfidence({ r2: 0.9, effortCount: 1, durationSpreadMin: 3, ageDays: 60 }).cls)
  })
})
