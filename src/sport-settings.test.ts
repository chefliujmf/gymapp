import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { fromIcuSportSettings, icuPatchForGroup, paceFromMps, mpsFromPace } from '../server/sport-settings.js'

// jmfiset's real intervals athlete shape (#210 findings): per-sport settings array, each with an id.
const REAL = [
  { id: 172071, types: ['Ride', 'VirtualRide'], ftp: 260, lthr: 170, max_hr: 185, threshold_pace: null },
  { id: 172072, types: ['Run', 'VirtualRun'], ftp: null, lthr: 170, max_hr: 194, threshold_pace: null, pace_units: 'MINS_KM' },
  { id: 172073, types: ['Swim'], lthr: 176, max_hr: 194, threshold_pace: 0.83, pace_units: 'SECS_100M' },
  { id: 172074, types: ['WeightTraining'], lthr: 170, max_hr: 194 },
]

describe('fromIcuSportSettings (pull)', () => {
  const got = fromIcuSportSettings(REAL)
  it('maps cycling FTP + HRs', () => expect(got.cycling).toEqual({ ftp: 260, maxHr: 185, lthr: 170 }))
  it('maps running HRs, no FTP, no pace when null', () => expect(got.running).toEqual({ maxHr: 194, lthr: 170 }))
  it('converts swim threshold_pace 0.83 m/s → 120 sec/100m', () => {
    expect(got.swimming.thresholdPace).toBe(120) // 100 / 0.83 ≈ 120.5
    expect(got.swimming.maxHr).toBe(194)
  })
  it('ignores WeightTraining (not a tracked group)', () => expect(Object.keys(got)).toEqual(['cycling', 'running', 'swimming']))
  it('survives empty/garbage', () => expect(fromIcuSportSettings(null)).toEqual({}))
})

describe('pace conversions', () => {
  it('running m/s ↔ sec/km round-trips', () => {
    const mps = mpsFromPace('running', 255) // 4:15/km
    expect(mps).toBeCloseTo(3.92, 2)
    expect(paceFromMps('running', mps)).toBe(255)
  })
  it('swim m/s ↔ sec/100m round-trips', () => {
    expect(paceFromMps('swimming', mpsFromPace('swimming', 120))).toBe(120)
  })
  it('cycling has no pace', () => expect(paceFromMps('cycling', 5)).toBeNull())
})

describe('icuPatchForGroup (push) — per-entry PUT body, only the changed field', () => {
  it('targets the cycling entry id with ONLY ftp (intervals leaves all else, incl. custom_field_values)', () => {
    const w = icuPatchForGroup(REAL, 'cycling', { ftp: 275 })
    expect(w).toEqual({ id: 172071, body: { ftp: 275 } })
  })
  it('writes running threshold pace back as m/s to the run entry id', () => {
    const w = icuPatchForGroup(REAL, 'running', { thresholdPace: 255 })
    expect(w!.id).toBe(172072)
    expect(w!.body.threshold_pace).toBeCloseTo(3.92, 2)
    expect('ftp' in w!.body).toBe(false) // running never sends ftp
  })
  it('maps maxHr/lthr to intervals field names', () => {
    expect(icuPatchForGroup(REAL, 'running', { maxHr: 196, lthr: 172 })).toEqual({ id: 172072, body: { max_hr: 196, lthr: 172 } })
  })
  it('ignores ftp for non-cycling groups', () => {
    const w = icuPatchForGroup(REAL, 'running', { ftp: 300, maxHr: 190 } as { ftp: number; maxHr: number })
    expect(w!.body).toEqual({ max_hr: 190 })
  })
  it('returns null when the group is absent (no blind PUT)', () => {
    expect(icuPatchForGroup([{ id: 1, types: ['Ride'] }], 'swimming', { thresholdPace: 110 })).toBeNull()
  })
  it('returns null when the entry has no id (cannot address the per-entry endpoint)', () => {
    expect(icuPatchForGroup([{ types: ['Ride'] }], 'cycling', { ftp: 270 })).toBeNull()
  })
})
