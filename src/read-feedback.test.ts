import { describe, it, expect } from 'vitest'
import { readIcuFeedback } from './intervals'

// #330 — a form must NOT show feel/RPE as "already logged" when they came from a Strava/device import
// (or the coach's auto-review) rather than the athlete using OUR form. Our CUSTOM fields (Legs/Fuel/…)
// are the only reliable "the athlete logged here" signal.
describe('readIcuFeedback (#330)', () => {
  it('imported feel/RPE with NO custom fields → null (blank form, no phantom POOR/RPE10)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(readIcuFeedback({ feel: 4, icu_rpe: 10 } as any)).toBeNull()
  })
  it('RPE alone (Strava perceived exertion) → null', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(readIcuFeedback({ icu_rpe: 8 } as any)).toBeNull()
  })
  it('with a custom field present → treated as athlete-logged (feel/RPE returned)', () => {
    // LegsBefore is a 1-based index into that field's options
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = readIcuFeedback({ feel: 2, icu_rpe: 6, LegsBefore: 1 } as any)
    expect(r).not.toBeNull()
    expect(r!.rpe).toBe(6)
    expect(Object.keys(r!.fields).length).toBeGreaterThan(0)
  })
  it('nothing → null', () => expect(readIcuFeedback(null)).toBeNull())
})
