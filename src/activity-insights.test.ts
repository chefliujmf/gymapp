import { describe, it, expect } from 'vitest'
import { decouplingPct, efFactor, splitPct, zoneShare, rideInsights, runInsights, swimInsights, gymInsights } from './activity-insights'

// helper: a constant-ish stream of length n
const flat = (n: number, v: number) => Array.from({ length: n }, () => v)
// a stream whose 2nd half rises (e.g. HR drifting up)
const drift = (n: number, a: number, b: number) => Array.from({ length: n }, (_, i) => (i < n / 2 ? a : b))

describe('#768 core analytics', () => {
  it('decouplingPct ≈ 0 for a perfectly steady effort:HR', () => {
    const d = decouplingPct(flat(600, 150), flat(600, 145))
    expect(d).not.toBeNull()
    expect(Math.abs(d!)).toBeLessThan(1)
  })
  it('decouplingPct is POSITIVE when HR drifts up on the same power (fatigue)', () => {
    const d = decouplingPct(flat(600, 150), drift(600, 140, 155)) // power flat, HR rises → ratio falls → drift +
    expect(d!).toBeGreaterThan(5)
  })
  it('decouplingPct is NEGATIVE (got more efficient) when HR drops on the same power', () => {
    const d = decouplingPct(flat(600, 150), drift(600, 155, 140))
    expect(d!).toBeLessThan(0)
  })
  it('decouplingPct is null for too-short data', () => { expect(decouplingPct(flat(60, 150), flat(60, 145))).toBeNull() })

  it('efFactor = normalized effort / avg HR', () => { expect(efFactor(152, 144)).toBeCloseTo(1.056, 2); expect(efFactor(0, 144)).toBeNull() })

  it('splitPct ≈ 0 for even pacing, negative for a negative split', () => {
    expect(Math.abs(splitPct(flat(600, 150))!)).toBeLessThan(1)
    expect(splitPct(drift(600, 150, 165))!).toBeGreaterThan(5) // faded (got slower/harder late reads as +)
    expect(splitPct(drift(600, 150, 135))!).toBeLessThan(0)   // negative split
  })

  it('zoneShare sums to ~100% and puts steady Z2 power in the endurance bucket', () => {
    const share = zoneShare(flat(600, 170), 260, (p) => (p < 60 ? 0 : p < 76 ? 1 : p < 91 ? 2 : p < 106 ? 3 : p < 121 ? 4 : 5))
    expect(Math.round(share.reduce((s, x) => s + x, 0))).toBe(100)
    expect(share[1]).toBeGreaterThan(95) // 170/260 = 65% → Z2 endurance
  })
})

describe('#768 rideInsights — a real Z2 ride reads as durable, in-zone, not a restatement', () => {
  const r = rideInsights({ streams: { watts: flat(600, 170), heartrate: flat(600, 144) }, np: 170, avgHr: 144, ftp: 262, efBaseline: 1.02 }) // 170/262 = 65% → Z2 endurance
  it('power read names the zone discipline + benchmark, not just the number', () => {
    expect(r.perChart.watts.title).toMatch(/endurance|Z2/i)
    expect(r.perChart.watts.detail).toMatch(/FTP/)
  })
  it('HR read surfaces DECOUPLING + efficiency (the value-add)', () => {
    expect(r.perChart.heartrate.title.toLowerCase()).toMatch(/drift|base|durab/)
    expect(r.perChart.heartrate.detail).toMatch(/decoupling/i)
  })
  it('degrades gracefully with no FTP + no HR', () => {
    const r2 = rideInsights({ streams: { watts: flat(600, 150) }, np: 150, avgHr: 0, ftp: 0 })
    expect(r2.perChart.watts).toBeTruthy() // still produces a read, no crash
  })
})

describe('#768 runInsights + swimInsights + gymInsights cover every sport', () => {
  it('run: pace:HR decoupling + % of threshold pace', () => {
    const r = runInsights({ streams: { velocity_smooth: flat(600, 3.3), heartrate: flat(600, 150) }, avgHr: 150, thresholdPaceSecPerKm: 270 })
    expect(r.perChart.pace.detail).toMatch(/threshold/i)
    expect(r.perChart.heartrate.detail).toMatch(/decoupling/i)
  })
  it('swim: % of CSS + SWOLF stroke-efficiency read', () => {
    const r = swimInsights({ streams: { velocity_smooth: flat(300, 1.2) }, avgHr: 140, cssPaceSecPer100: 95, swolf: 38 })
    expect(r.perChart.pace.detail).toMatch(/CSS|threshold|aerobic|race/i)
    expect(r.perChart.cadence.title).toMatch(/SWOLF/)
  })
  it('gym: names sets/volume + progression, never crashes without weights', () => {
    const r = gymInsights({ exercises: [{ name: 'Bench', sets: 4, reps: 8, weight: 80, section: 'main' }], rpe: 7 })
    expect(r.perChart.volume.title).toMatch(/set/i)
    expect(r.perChart.rpe.title).toMatch(/7\/10|effort/i)
    expect(() => gymInsights({ exercises: [{ name: 'Push-Up', reps: 12, sets: 3, section: 'main' }] })).not.toThrow()
  })
})
