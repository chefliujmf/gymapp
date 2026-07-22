import { describe, it, expect } from 'vitest'
import { feedbackStatus, incompleteFeedback } from './feedbackGaps'

// #340 — nag only when the CORE (feel + RPE) is missing; custom fields drive the % but never the nag.
describe('feedbackStatus', () => {
  it('feel + RPE present → does NOT need feedback (even with no custom fields)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = feedbackStatus({ feel: 3, icu_rpe: 6 } as any)
    expect(s.needsFeedback).toBe(false)
    expect(s.missing).toEqual([])
  })
  it('only feel → needs feedback, RPE missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = feedbackStatus({ feel: 3 } as any)
    expect(s.needsFeedback).toBe(true)
    expect(s.missing).toEqual(['RPE'])
  })
  it('nothing → needs feedback, both missing, 0%', () => {
    const s = feedbackStatus(null)
    expect(s.needsFeedback).toBe(true)
    expect(s.missing).toEqual(['how it felt', 'RPE'])
    expect(s.pct).toBe(0)
  })
  it('custom fields raise the richness %', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = feedbackStatus({ feel: 3, icu_rpe: 6, LegsAfter: 2, FuelGI: 1 } as any)
    expect(s.done).toBe(4)
    expect(s.pct).toBeGreaterThan(feedbackStatus({ feel: 3, icu_rpe: 6 } as any).pct)
  })
})

describe('incompleteFeedback', () => {
  it('returns only core-incomplete activities, oldest first', () => {
    const acts = [
      { id: 1, type: 'Ride', feel: 3, icu_rpe: 6, start_date_local: '2026-07-03' }, // complete
      { id: 2, type: 'Ride', feel: 3, start_date_local: '2026-07-02' }, // missing RPE
      { id: 3, type: 'Ride', start_date_local: '2026-07-01' }, // missing both
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any
    const r = incompleteFeedback(acts, undefined, Infinity) // Infinity → ignore recency for the core-logic test
    expect(r.map((x) => x.act.id)).toEqual([3, 2]) // oldest first, complete one excluded
  })
  it('#review-skip — excludes activities the athlete skipped', () => {
    const acts = [
      { id: 2, type: 'Ride', feel: 3, start_date_local: '2026-07-02' }, // missing RPE
      { id: 3, type: 'Ride', start_date_local: '2026-07-01' }, // missing both
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any
    expect(incompleteFeedback(acts, new Set(['3']), Infinity).map((x) => x.act.id)).toEqual([2]) // 3 skipped → gone
    expect(incompleteFeedback(acts, new Set(['2', '3']), Infinity).length).toBe(0) // both skipped → nothing to review
  })
  it('#565 — old activities (past the recency window) do NOT flag', () => {
    const iso = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10)
    const acts = [
      { id: 'recent', start_date_local: iso(5), type: 'Ride' },   // 5 days ago, missing feedback → flags
      { id: 'old', start_date_local: iso(90), type: 'Ride' },     // 90 days ago, missing feedback → stale, no flag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any
    expect(incompleteFeedback(acts).map((x) => x.act.id)).toEqual(['recent']) // default 30d window drops the old one
    expect(incompleteFeedback(acts, undefined, 120).map((x) => x.act.id).sort()).toEqual(['old', 'recent']) // wider window includes both
  })
  it('#661 — a GYM/strength activity is NEVER nagged (its feedback lives in the Platyplus store, not intervals fields)', () => {
    const acts = [
      { id: 'ride', type: 'Ride', start_date_local: new Date().toISOString().slice(0, 10) }, // no feel/rpe → flags
      { id: 'gym', type: 'WeightTraining', start_date_local: new Date().toISOString().slice(0, 10) }, // gym → excluded even with no intervals feedback
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any
    expect(incompleteFeedback(acts, undefined, Infinity).map((x) => x.act.id)).toEqual(['ride'])
  })

  it('#679 — a gym/other activity with ANY type (incl. one the old regex missed) NEVER nags', () => {
    const acts = [
      { id: 'ride', type: 'VirtualRide', start_date_local: new Date().toISOString().slice(0, 10) }, // endurance → nags
      { id: 'gym1', type: 'WeightTraining', start_date_local: new Date().toISOString().slice(0, 10) },
      { id: 'gym2', type: 'Workout', start_date_local: new Date().toISOString().slice(0, 10) },
      { id: 'gym3', type: 'IndoorClimbing', start_date_local: new Date().toISOString().slice(0, 10) }, // odd type the #661 regex missed
      { id: 'gym4', type: '', start_date_local: new Date().toISOString().slice(0, 10) }, // no type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any
    expect(incompleteFeedback(acts, undefined, Infinity).map((x) => x.act.id)).toEqual(['ride']) // ONLY the ride nags
  })
})
