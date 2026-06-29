import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { fromIcuSportSettings, applyPatchToSportSettings, paceFromMps, mpsFromPace } from '../server/sport-settings.js'

// jmfiset's real intervals athlete shape (#210 findings): per-sport settings array.
const REAL = [
  { types: ['Ride', 'VirtualRide'], ftp: 260, lthr: 170, max_hr: 185, threshold_pace: null },
  { types: ['Run', 'VirtualRun'], ftp: null, lthr: 170, max_hr: 194, threshold_pace: null, pace_units: 'MINS_KM' },
  { types: ['Swim'], lthr: 176, max_hr: 194, threshold_pace: 0.83, pace_units: 'SECS_100M' },
  { types: ['WeightTraining'], lthr: 170, max_hr: 194 },
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

describe('applyPatchToSportSettings (push) — surgical, custom-field-safe', () => {
  it('changes ONLY the cycling FTP, leaves every other entry & field untouched', () => {
    const out = applyPatchToSportSettings(REAL, 'cycling', { ftp: 275 })
    expect(out[0].ftp).toBe(275)
    expect(out[0].lthr).toBe(170) // untouched
    expect(out[0].max_hr).toBe(185) // untouched
    expect(out[1]).toEqual(REAL[1]) // running entry byte-for-byte
    expect(out[3]).toEqual(REAL[3]) // weights entry untouched
    expect(REAL[0].ftp).toBe(260) // original not mutated
  })
  it('writes running threshold pace back as m/s', () => {
    const out = applyPatchToSportSettings(REAL, 'running', { thresholdPace: 255 })
    expect(out[1].threshold_pace).toBeCloseTo(3.92, 2)
    expect(out[1].max_hr).toBe(194) // untouched
  })
  it('updates max_hr / lthr by group', () => {
    const out = applyPatchToSportSettings(REAL, 'running', { maxHr: 196, lthr: 172 })
    expect(out[1].max_hr).toBe(196)
    expect(out[1].lthr).toBe(172)
  })
  it('preserves unknown/custom keys on the touched entry', () => {
    const withCustom = [{ types: ['Ride'], ftp: 260, custom_field_x: 'keep-me', w_prime: 20000 }]
    const out = applyPatchToSportSettings(withCustom, 'cycling', { ftp: 270 })
    expect(out[0]).toEqual({ types: ['Ride'], ftp: 270, custom_field_x: 'keep-me', w_prime: 20000 })
  })
  it('returns null when the group is absent (no blind PUT)', () => {
    expect(applyPatchToSportSettings([{ types: ['Ride'] }], 'swimming', { thresholdPace: 110 })).toBeNull()
  })
})
