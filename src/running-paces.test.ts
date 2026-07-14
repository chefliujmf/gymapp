import { describe, it, expect } from 'vitest'
import {
  vdotFromThresholdPace, thresholdPaceFromVdot, paceZones,
  racePredict, racePredictions, fmtPace, fmtTime, parsePace, zonePaceForPct,
  marathonDurabilityPenalty, marathonRealism, MAX_DURABILITY_PENALTY, DEFAULT_DURABILITY_PENALTY, MARATHON_READY,
  estimateVo2max, vdotFromRace, bestVdotFromRaces, csPaceFromVdot,
} from './running-paces'

// #512 — VDOT from RACE times (the reliable running anchor). Grounded in JM's real intervals bests.
describe('VDOT from races (#512)', () => {
  it('JM 5k 23:12 → VDOT ~42', () => {
    expect(vdotFromRace(5000, 23 * 60 + 12)).toBeCloseTo(41.8, 0)
  })
  it('threshold from race-VDOT ~4:56/km, CS just faster (threshold ≤ CS)', () => {
    const v = bestVdotFromRaces([{ distM: 3000, timeSec: 822 }, { distM: 5000, timeSec: 1392 }, { distM: 10000, timeSec: 3059 }])!
    expect(v).toBeCloseTo(41.8, 0)
    const th = thresholdPaceFromVdot(v), cs = csPaceFromVdot(v)
    expect(th).toBeGreaterThan(cs) // sec/km: threshold is SLOWER (bigger) than CS → threshold ≤ CS in speed
    expect(th).toBeGreaterThan(280); expect(th).toBeLessThan(310) // ~4:40–5:10
  })
  it('rejects a GPS-glitch race (JM 1.5k in 3:20 → fantasy VDOT 86, dropped)', () => {
    const withGlitch = bestVdotFromRaces([{ distM: 1500, timeSec: 200 }, { distM: 5000, timeSec: 1392 }, { distM: 10000, timeSec: 3059 }])!
    expect(withGlitch).toBeLessThan(45) // the 86 glitch must not inflate it
    expect(withGlitch).toBeCloseTo(41.8, 0)
  })
  it('null when there is no sane race', () => expect(bestVdotFromRaces([])).toBeNull())
})

// Daniels' published VDOT 50 table values — our model should land within tolerance.
describe('VDOT ↔ threshold pace', () => {
  it('threshold pace 4:15/km ≈ VDOT 50', () => {
    expect(vdotFromThresholdPace(255)).toBeCloseTo(50, 0)
  })
  it('round-trips: VDOT → T-pace → VDOT', () => {
    const p = thresholdPaceFromVdot(50)
    expect(p).toBeGreaterThan(250)
    expect(p).toBeLessThan(260)
    expect(vdotFromThresholdPace(p)).toBeCloseTo(50, 5)
  })
  it('faster threshold pace → higher VDOT', () => {
    expect(vdotFromThresholdPace(220)).toBeGreaterThan(vdotFromThresholdPace(280))
  })
  it('rejects junk', () => {
    expect(Number.isNaN(vdotFromThresholdPace(0))).toBe(true)
  })
})

describe('race predictions (Daniels VDOT 50 reference)', () => {
  const within = (got: number, want: number, tolSec: number) => expect(Math.abs(got - want)).toBeLessThan(tolSec)
  it('5K ≈ 19:57', () => within(racePredict(50, 5000).sec, 19 * 60 + 57, 30))
  it('10K ≈ 41:21', () => within(racePredict(50, 10000).sec, 41 * 60 + 21, 45))
  it('Half ≈ 1:31:35', () => within(racePredict(50, 21097.5).sec, 91 * 60 + 35, 90))
  it('Marathon ≈ 3:10:49', () => within(racePredict(50, 42195).sec, 190 * 60 + 49, 180))
  it('longer race → slower pace', () => {
    const r = racePredictions(50)
    for (let i = 1; i < r.length; i++) expect(r[i].pace).toBeGreaterThan(r[i - 1].pace)
  })
  it('higher VDOT → faster 10K', () => {
    expect(racePredict(60, 10000).sec).toBeLessThan(racePredict(50, 10000).sec)
  })
  it('returns all four distances', () => {
    expect(racePredictions(50).map((r) => r.label)).toEqual(['5K', '10K', 'Half', 'Marathon'])
  })
})

describe('Daniels pace zones (VDOT 50)', () => {
  const z = paceZones(50)
  it('ordered easy(slow) > marathon > threshold > interval > rep', () => {
    expect(z.easy[1]).toBeGreaterThan(z.marathon)
    expect(z.marathon).toBeGreaterThan(z.threshold)
    expect(z.threshold).toBeGreaterThan(z.interval)
    expect(z.interval).toBeGreaterThan(z.rep)
  })
  it('threshold ≈ 4:15/km', () => expect(z.threshold).toBeCloseTo(255, -1))
  it('easy is a fast..slow range', () => expect(z.easy[0]).toBeLessThan(z.easy[1]))
  it('interval ≈ 3:51/km (vVO₂max)', () => expect(Math.abs(z.interval - 231)).toBeLessThan(8))
})

describe('zonePaceForPct (RunPlayer segment → pace)', () => {
  const z = paceZones(50)
  it('easy band (70%) → easy pace', () => expect(zonePaceForPct(50, 70)).toBe(z.easy[1]))
  it('threshold band (95%) → threshold pace', () => expect(zonePaceForPct(50, 95)).toBe(z.threshold))
  it('interval band (105%) → interval pace', () => expect(zonePaceForPct(50, 105)).toBe(z.interval))
  it('sprint band (120%) → rep pace', () => expect(zonePaceForPct(50, 120)).toBe(z.rep))
  it('harder band → faster pace', () => expect(zonePaceForPct(50, 105)).toBeLessThan(zonePaceForPct(50, 70)))
})

// #216 — marathon realism: the durability penalty + potential→realistic range.
describe('marathon durability penalty', () => {
  it('a marathon-ready base → ~0 penalty', () => {
    expect(marathonDurabilityPenalty(MARATHON_READY)).toBeCloseTo(0, 3)
  })
  it('a beyond-ready base is clamped to 0 (never negative)', () => {
    expect(marathonDurabilityPenalty({ longestKm: 40, weeklyKm: 100 })).toBe(0)
  })
  it('no base at all → the maximum penalty', () => {
    expect(marathonDurabilityPenalty({ longestKm: 0, weeklyKm: 0 })).toBeCloseTo(MAX_DURABILITY_PENALTY, 4)
  })
  it('more long-run base → smaller penalty', () => {
    const low = marathonDurabilityPenalty({ longestKm: 12, weeklyKm: 30 })
    const high = marathonDurabilityPenalty({ longestKm: 28, weeklyKm: 60 })
    expect(high).toBeLessThan(low)
  })
  it('longest run is weighted more than weekly volume', () => {
    // same total "readiness budget" but concentrated in the long run → smaller penalty
    const longHeavy = marathonDurabilityPenalty({ longestKm: 32, weeklyKm: 0 }) // longReady=1
    const volHeavy = marathonDurabilityPenalty({ longestKm: 0, weeklyKm: 70 }) // volReady=1
    expect(longHeavy).toBeLessThan(volHeavy)
  })
  it('stays within [0, MAX] for a typical recreational base', () => {
    const p = marathonDurabilityPenalty({ longestKm: 18, weeklyKm: 40 })
    expect(p).toBeGreaterThan(0)
    expect(p).toBeLessThanOrEqual(MAX_DURABILITY_PENALTY)
  })
})

describe('marathonRealism (potential → realistic range)', () => {
  it('realistic is always ≥ potential (penalty never speeds you up)', () => {
    const m = marathonRealism(50, { longestKm: 18, weeklyKm: 40 })
    expect(m.realisticSec).toBeGreaterThanOrEqual(m.potentialSec)
  })
  it('potential equals the pure Daniels marathon', () => {
    const m = marathonRealism(50, { longestKm: 18, weeklyKm: 40 })
    expect(m.potentialSec).toBeCloseTo(racePredict(50, 42195).sec, 5)
  })
  it('a marathon-ready base collapses the range (potential ≈ realistic)', () => {
    const m = marathonRealism(50, MARATHON_READY)
    expect(m.realisticSec).toBeCloseTo(m.potentialSec, 0)
  })
  it('no volume → default penalty, flagged hasVolume=false', () => {
    const m = marathonRealism(50)
    expect(m.hasVolume).toBe(false)
    expect(m.penalty).toBeCloseTo(DEFAULT_DURABILITY_PENALTY, 4)
    expect(m.realisticSec).toBeCloseTo(m.potentialSec * (1 + DEFAULT_DURABILITY_PENALTY), 0)
  })
  it('empty volume (no recent runs) falls back to default, not a 100% penalty', () => {
    const m = marathonRealism(50, { longestKm: 0, weeklyKm: 0 })
    expect(m.hasVolume).toBe(false)
    expect(m.penalty).toBeCloseTo(DEFAULT_DURABILITY_PENALTY, 4)
  })
  it('paces match the times over 42.195 km', () => {
    const m = marathonRealism(50, { longestKm: 18, weeklyKm: 40 })
    expect(m.realisticPace).toBeCloseTo(m.realisticSec / 42.195, 5)
  })
  it('JM-ish case: VDOT 50, 18 km longest / 40 km wk → ~5% penalty, realistic ~3:20', () => {
    const m = marathonRealism(50, { longestKm: 18, weeklyKm: 40 })
    expect(m.penalty).toBeGreaterThan(0.04)
    expect(m.penalty).toBeLessThan(0.06)
    expect(Math.abs(m.realisticSec - (3 * 3600 + 20 * 60))).toBeLessThan(120) // within 2 min of 3:20
  })
})

// #207 Phase 2b — VO₂max estimate from the best aerobic measure.
describe('estimateVo2max', () => {
  it('cycling: Coggan 10.8·W/kg + 7', () => {
    const e = estimateVo2max({ ftp: 260, weightKg: 76 })
    expect(e!.value).toBeCloseTo(10.8 * 260 / 76 + 7, 1) // ≈ 43.9
    expect(e!.from).toMatch(/cycling/)
  })
  it('running VDOT is itself a VO₂max', () => {
    expect(estimateVo2max({ vdot: 50 })!.value).toBe(50)
  })
  it('takes the higher of the two (best-trained engine)', () => {
    const e = estimateVo2max({ ftp: 260, weightKg: 76, vdot: 50 }) // cycling ≈44, run 50
    expect(e!.value).toBe(50)
    expect(e!.from).toMatch(/running/)
  })
  it('null when no inputs / bad weight', () => {
    expect(estimateVo2max({})).toBeNull()
    expect(estimateVo2max({ ftp: 260, weightKg: 0 })).toBeNull()
  })
})

describe('formatters', () => {
  it('fmtPace', () => expect(fmtPace(255)).toBe('4:15'))
  it('fmtPace pads seconds', () => expect(fmtPace(245)).toBe('4:05'))
  it('fmtTime under an hour', () => expect(fmtTime(19 * 60 + 57)).toBe('19:57'))
  it('fmtTime over an hour', () => expect(fmtTime(91 * 60 + 35)).toBe('1:31:35'))
  it('parsePace round-trips fmtPace', () => expect(parsePace(fmtPace(255))).toBe(255))
  it('parsePace rejects junk', () => expect(parsePace('abc')).toBeNull())
})
