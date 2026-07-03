import { describe, it, expect } from 'vitest'
import { paceOf, bestPaceCurve, paceZoneSecs, paceZoneIdx, PZONES } from './run-analysis'

describe('paceOf — speed (m/s) → pace (sec/km)', () => {
  it('converts a normal running speed', () => {
    expect(paceOf(3.0769)).toBe(Math.round(1000 / 3.0769)) // 5:25/km threshold speed
    expect(paceOf(4)).toBe(250) // 4 m/s = 4:10/km
  })
  it('ignores stopped / GPS-noise (<0.4 m/s) and caps absurd paces', () => {
    expect(paceOf(0)).toBeNull()
    expect(paceOf(0.3)).toBeNull()
    expect(paceOf(null)).toBeNull()
    expect(paceOf(0.5)).toBe(1200) // 1000/0.5 = 2000, capped at 1200 (20:00/km)
  })
})

describe('bestPaceCurve — best avg pace by duration', () => {
  it('a steady run yields ~its pace at every duration ≤ length', () => {
    const vel = new Array(700).fill(3) // 3 m/s = 5:33/km, 700 s
    const { secs, pace } = bestPaceCurve(vel)
    expect(secs).toContain(300)
    expect(secs).not.toContain(1200) // longer than the run
    for (const p of pace) expect(p).toBe(Math.round(1000 / 3))
  })
  it('a fast surge makes SHORT durations quicker than long ones', () => {
    const vel = [...new Array(60).fill(5), ...new Array(600).fill(3)] // 1-min surge then steady
    const { secs, pace } = bestPaceCurve(vel)
    const p60 = pace[secs.indexOf(60)], p600 = pace[secs.indexOf(600)]
    expect(p60).toBeLessThan(p600) // sec/km: smaller = faster
  })
})

describe('paceZoneIdx / paceZoneSecs — Daniels pace zones (% of threshold speed)', () => {
  it('bins by % of threshold speed (higher % = faster = harder zone)', () => {
    expect(PZONES[paceZoneIdx(70)]).toBe('Recovery') // ≤77.5
    expect(PZONES[paceZoneIdx(84)]).toBe('Easy') // ≤87.7
    expect(PZONES[paceZoneIdx(92)]).toBe('Marathon') // ≤94.3
    expect(PZONES[paceZoneIdx(99)]).toBe('Threshold') // ≤100
    expect(PZONES[paceZoneIdx(120)]).toBe('Rep') // >106
  })
  it('counts seconds per zone from the speed stream', () => {
    const thrPace = 300 // 5:00/km → threshold speed 3.333 m/s
    const vel = [...new Array(100).fill(2.5), ...new Array(50).fill(3.333)] // easy then threshold
    const z = paceZoneSecs(vel, thrPace)
    expect(z.reduce((a, b) => a + b, 0)).toBe(150)
    // 2.5/3.333 = 75% → Recovery(0); 3.333/3.333 = 100% → Threshold(3)
    expect(z[0]).toBe(100)
    expect(z[3]).toBe(50)
  })
  it('ignores stopped samples', () => {
    const z = paceZoneSecs([0, 0.2, null as unknown as number, 3], 300)
    expect(z.reduce((a, b) => a + b, 0)).toBe(1)
  })
})
