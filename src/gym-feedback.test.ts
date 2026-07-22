import { describe, it, expect } from 'vitest'
// @ts-expect-error — JS module, no types
import { fbHasContent, gymHasFeedback, gymFeedbackGaps } from '../server/gym-feedback.js'

// #723 — a completed gym's feedback lives in the Platyplus store (plan.feedback / activityFeedback[gym-{date}|planId|
// activityId]), NOT on the intervals activity. These guard both the coach's awaitingFeedback grace AND the client nag.
describe('gym-feedback (#723)', () => {
  it('fbHasContent — real content vs empty stub', () => {
    expect(fbHasContent({ feel: 'good' })).toBe(true)
    expect(fbHasContent({ rpe: 6 })).toBe(true)
    expect(fbHasContent({ fields: { Legs: '3' } })).toBe(true)
    expect(fbHasContent({ note: 'felt strong' })).toBe(true)
    expect(fbHasContent({})).toBe(false)
    expect(fbHasContent({ note: '   ' })).toBe(false)
    expect(fbHasContent(null)).toBe(false)
  })

  it('gymHasFeedback finds feedback under any key it could live', () => {
    const base = { activityFeedback: {}, plans: [], logs: [] }
    expect(gymHasFeedback(base, { date: '2026-07-20' })).toBe(false)
    // keyed by gym-{date}
    expect(gymHasFeedback({ ...base, activityFeedback: { 'gym-2026-07-20': { feel: 'ok' } } }, { date: '2026-07-20' })).toBe(true)
    // keyed by plan id
    expect(gymHasFeedback({ ...base, activityFeedback: { p1: { rpe: 7 } } }, { date: '2026-07-20', planId: 'p1' })).toBe(true)
    // keyed by activity id (number → string)
    expect(gymHasFeedback({ ...base, activityFeedback: { '999': { feel: 'hard' } } }, { activityId: 999 })).toBe(true)
    // stored on the plan itself
    expect(gymHasFeedback({ ...base, plans: [{ id: 'p1', sport: 'gym', date: '2026-07-20', feedback: { feel: 'good' } }] }, { date: '2026-07-20', planId: 'p1' })).toBe(true)
    // an empty stub does NOT count
    expect(gymHasFeedback({ ...base, activityFeedback: { 'gym-2026-07-20': {} } }, { date: '2026-07-20' })).toBe(false)
  })

  it('gymFeedbackGaps lists completed gyms lacking feedback, oldest first, dedup per day, within window', () => {
    const user = {
      activityFeedback: { 'gym-2026-07-18': { feel: 'good' } }, // 07-18 HAS feedback → excluded
      plans: [{ id: 'pA', sport: 'gym', date: '2026-07-15', title: 'Full-Body A' }],
      logs: [
        { date: '2026-07-15', discipline: 'strength', title: 'Legs' }, // no feedback → gap
        { date: '2026-07-18', discipline: 'gym', title: 'Push' },       // has feedback → not a gap
        { date: '2026-07-19', discipline: 'strength', title: 'Pull' },  // no feedback → gap
        { date: '2026-07-19', discipline: 'strength', title: 'Pull dup' }, // same day → deduped
        { date: '2026-06-01', discipline: 'gym', title: 'Old' },        // outside 14d window → excluded
        { date: '2026-07-16', discipline: 'running', title: 'Run' },    // not a gym → excluded
      ],
    }
    const gaps = gymFeedbackGaps(user, '2026-07-20', 14)
    expect(gaps.map((g: { date: string }) => g.date)).toEqual(['2026-07-15', '2026-07-19'])
    expect(gaps[0].title).toBe('Full-Body A') // prefers the plan title over the log title
    expect(gaps[0].planId).toBe('pA')
  })

  it('degrades gracefully for a user with no logs/plans/feedback', () => {
    expect(gymFeedbackGaps({}, '2026-07-20')).toEqual([])
    expect(gymHasFeedback({}, { date: '2026-07-20' })).toBe(false)
  })
})
