import { describe, it, expect } from 'vitest'
import { decouplingCheck, recoveryCheck, efTrend, type RideSignal } from './threshold-signals'

const ride = (np: number, decoupling: number, durationMin = 45): RideSignal => ({ np, hr: 150, decoupling, durationMin })

// #508 — decoupling CONFIRMS or FLAGS a candidate FTP; it can't invent one from easy riding.
describe('decouplingCheck', () => {
  it('no FTP → thin (nothing to check against)', () => {
    expect(decouplingCheck([ride(240, 3)], null).verdict).toBe('thin')
  })
  it('steady rides NEAR the FTP with low drift → confirms it is sustainable', () => {
    const r = decouplingCheck([ride(245, 2.5), ride(250, 4)], 250)
    expect(r.verdict).toBe('confirms')
    expect(r.avgDrift).toBeLessThanOrEqual(5)
  })
  it('rides near the FTP with HIGH drift → FTP looks too high', () => {
    const r = decouplingCheck([ride(255, 9), ride(258, 12)], 260)
    expect(r.verdict).toBe('too-high')
    expect(r.note).toMatch(/high|drift/i)
  })
  it("endurance-only riding well below the FTP can't confirm it → thin (honest, not a bug)", () => {
    // JM's case: rides at NP ~198 can't confirm a 246 FTP
    expect(decouplingCheck([ride(198, 3), ride(165, 2)], 246).verdict).toBe('thin')
  })
  it('ignores short efforts (< 30 min) — drift needs a sustained ride', () => {
    expect(decouplingCheck([ride(245, 3, 20), ride(248, 4, 15)], 250).verdict).toBe('thin')
  })
})

describe('recoveryCheck (next-day HRV response)', () => {
  it('an easy ride tells us nothing about threshold recovery → thin', () => {
    expect(recoveryCheck(0.7, -12).verdict).toBe('thin')
  })
  it('a hard ride that suppresses next-day HRV → intensity too high', () => {
    expect(recoveryCheck(0.95, -15).verdict).toBe('suppressed')
  })
  it('a hard ride your HRV bounces back from → sustainable', () => {
    expect(recoveryCheck(0.9, -2).verdict).toBe('recovered')
  })
  it('missing data → thin', () => {
    expect(recoveryCheck(null, -10).verdict).toBe('thin')
    expect(recoveryCheck(0.9, null).verdict).toBe('thin')
  })
})

describe('efTrend', () => {
  it('needs a few rides → thin', () => {
    expect(efTrend([1.1, 1.2]).direction).toBe('thin')
  })
  it('rising efficiency → up', () => {
    expect(efTrend([1.05, 1.06, 1.10, 1.12, 1.14]).direction).toBe('up')
  })
  it('falling efficiency → down', () => {
    expect(efTrend([1.20, 1.18, 1.10, 1.08]).direction).toBe('down')
  })
  it('steady → flat', () => {
    expect(efTrend([1.10, 1.11, 1.10, 1.11, 1.10]).direction).toBe('flat')
  })
})
