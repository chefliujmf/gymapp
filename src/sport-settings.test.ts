import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { fromIcuSportSettings, icuPatchForGroup, paceFromMps, mpsFromPace, runThresholdFromPaceCurve, athleteBasicsPatch } from '../server/sport-settings.js'

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

describe('runThresholdFromPaceCurve (#215 estimate from Critical Speed)', () => {
  // jmfiset's real pace curve: CS 3.1173706 m/s, r2 0.999 → 1000/3.117 ≈ 321 s/km (5:21/km)
  const REAL_PC = { list: [{ paceModels: [{ type: 'CS', criticalSpeed: 3.1173706, dPrime: 148, r2: 0.99911654 }] }] }
  it('derives threshold pace from Critical Speed', () => {
    const e = runThresholdFromPaceCurve(REAL_PC)
    expect(e!.thresholdPace).toBe(329) // #506d — 1000/3.117 = 321, ×1.025 offset (CS overestimates MLSS ~2-3%) → 329
    expect(e!.criticalSpeed).toBeCloseTo(3.117, 2)
    expect(e!.r2).toBeCloseTo(0.999, 2)
  })
  it('rejects a poor fit (r2 below threshold)', () => {
    expect(runThresholdFromPaceCurve({ list: [{ paceModels: [{ type: 'CS', criticalSpeed: 3, r2: 0.4 }] }] })).toBeNull()
  })
  it('returns null with no CS model / empty / garbage', () => {
    expect(runThresholdFromPaceCurve({ list: [{ paceModels: [{ type: 'PD', criticalSpeed: 0 }] }] })).toBeNull()
    expect(runThresholdFromPaceCurve({ list: [] })).toBeNull()
    expect(runThresholdFromPaceCurve(null)).toBeNull()
  })
  it('takes the first window that has a good CS fit', () => {
    const pc = { list: [{ paceModels: [] }, { paceModels: [{ type: 'CS', criticalSpeed: 4.0, r2: 0.95 }] }] }
    expect(runThresholdFromPaceCurve(pc)!.thresholdPace).toBe(256) // #506d — 1000/4.0 = 250, ×1.025 → 256
  })
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

// #268/#1003/#459 — write profile basics BACK to the intervals athlete record (two-way sync).
describe('athleteBasicsPatch (write-back to intervals)', () => {
  it('height cm → metres', () => expect(athleteBasicsPatch(['heightCm'], { heightCm: 175 })).toEqual({ height: 1.75 }))
  it('dob passes through (YYYY-MM-DD)', () => expect(athleteBasicsPatch(['dob'], { dob: '1985-08-16' })).toEqual({ icu_date_of_birth: '1985-08-16' }))
  it('sex male → M, female → F', () => {
    expect(athleteBasicsPatch(['sex'], { sex: 'male' })).toEqual({ sex: 'M' })
    expect(athleteBasicsPatch(['sex'], { sex: 'female' })).toEqual({ sex: 'F' })
  })
  it('only maps the keys the user actually CHANGED (never clobbers an untouched field)', () => {
    expect(athleteBasicsPatch(['heightCm'], { heightCm: 180, dob: '1990-01-01', sex: 'male' })).toEqual({ height: 1.8 })
  })
  it('ignores blank / invalid values (no accidental wipe)', () => {
    expect(athleteBasicsPatch(['heightCm'], { heightCm: 0 })).toEqual({})
    expect(athleteBasicsPatch(['dob'], { dob: '' })).toEqual({})
    expect(athleteBasicsPatch(['sex'], { sex: 'other' })).toEqual({})
  })
  it('empty when nothing relevant changed', () => expect(athleteBasicsPatch(['coachName', 'sleepNeed'], { heightCm: 175 })).toEqual({}))
  it('maps several changed fields at once', () => expect(athleteBasicsPatch(['heightCm', 'dob', 'sex'], { heightCm: 175, dob: '1985-08-16', sex: 'female' })).toEqual({ height: 1.75, icu_date_of_birth: '1985-08-16', sex: 'F' }))
})
