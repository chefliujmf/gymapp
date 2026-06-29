import { describe, it, expect } from 'vitest'
import {
  vdotFromThresholdPace, thresholdPaceFromVdot, paceZones,
  racePredict, racePredictions, fmtPace, fmtTime, parsePace, zonePaceForPct,
} from './running-paces'

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

describe('formatters', () => {
  it('fmtPace', () => expect(fmtPace(255)).toBe('4:15'))
  it('fmtPace pads seconds', () => expect(fmtPace(245)).toBe('4:05'))
  it('fmtTime under an hour', () => expect(fmtTime(19 * 60 + 57)).toBe('19:57'))
  it('fmtTime over an hour', () => expect(fmtTime(91 * 60 + 35)).toBe('1:31:35'))
  it('parsePace round-trips fmtPace', () => expect(parsePace(fmtPace(255))).toBe(255))
  it('parsePace rejects junk', () => expect(parsePace('abc')).toBeNull())
})
