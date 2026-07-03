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
      { id: 1, feel: 3, icu_rpe: 6, start_date_local: '2026-07-03' }, // complete
      { id: 2, feel: 3, start_date_local: '2026-07-02' }, // missing RPE
      { id: 3, start_date_local: '2026-07-01' }, // missing both
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any
    const r = incompleteFeedback(acts)
    expect(r.map((x) => x.act.id)).toEqual([3, 2]) // oldest first, complete one excluded
  })
})
