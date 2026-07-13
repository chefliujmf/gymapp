import { describe, it, expect } from 'vitest'
import { decouplingCheck, recoveryCheck, efTrend, aerobicFloor, type RideSignal } from './threshold-signals'

const ride = (np: number, decoupling: number, durationMin = 45, vi = 1.03): RideSignal => ({ np, hr: 150, decoupling, durationMin, vi })

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
  it('ignores INTERVAL/surgey rides near the FTP (high VI) — drift is only valid on a steady effort (JM: "bogus")', () => {
    expect(decouplingCheck([ride(248, 9, 45, 1.15), ride(250, 11, 45, 1.22)], 250).verdict).toBe('thin')
  })
})

// #508 — the aerobic-efficiency floor (JM: 170 W steady in Z2 ⇒ FTP well above a 220 read)
describe('aerobicFloor', () => {
  it('holding 170 W at a steady Z2 HR (75% of max) ⇒ FTP ≥ ~220+ (a lower bound, not a lowball)', () => {
    const r = aerobicFloor([{ np: 170, hr: 139, decoupling: 2, durationMin: 60, vi: 1.03 }], 185)!
    expect(r).not.toBeNull()
    expect(r.floor).toBeGreaterThanOrEqual(220)
    expect(r.note).toMatch(/at least/i)
  })
  it('a stronger aerobic ride raises the floor', () => {
    const easy = aerobicFloor([{ np: 150, hr: 135, decoupling: 2, durationMin: 45, vi: 1.03 }], 185)!
    const strong = aerobicFloor([{ np: 200, hr: 140, decoupling: 2, durationMin: 45, vi: 1.03 }], 185)!
    expect(strong.floor).toBeGreaterThan(easy.floor)
  })
  it('needs a max HR; ignores near-max / surgey rides (not aerobic)', () => {
    expect(aerobicFloor([{ np: 170, hr: 139, decoupling: 2, durationMin: 60, vi: 1.03 }], null)).toBeNull()
    expect(aerobicFloor([{ np: 260, hr: 178, decoupling: 8, durationMin: 30, vi: 1.2 }], 185)).toBeNull()
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
