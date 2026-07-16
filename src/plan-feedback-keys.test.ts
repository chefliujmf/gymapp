import { describe, it, expect } from 'vitest'
import { gymFeedbackKeys } from './plan'

// #feedback-key-audit — robust gym feedback keys: canonical = plan id > activity id > date; the rest are fallbacks.
describe('gymFeedbackKeys', () => {
  it('prefers the PLAN id as the canonical, with activity id + date as fallbacks', () => {
    const k = gymFeedbackKeys({ date: '2026-06-19', planId: 'plan-abc', activityId: 'i158721911', workoutId: 'w1' })
    expect(k.id).toBe('plan-abc')
    expect(k.altIds).toEqual(['i158721911', 'gym-2026-06-19', 'gym-2026-06-19-w1'])
  })
  it('falls back to the activity id when there is no plan', () => {
    const k = gymFeedbackKeys({ date: '2026-06-19', activityId: 158721911 })
    expect(k.id).toBe('158721911')
    expect(k.altIds).toContain('gym-2026-06-19')
  })
  it('date-only when nothing else (done screen, ad-hoc)', () => {
    expect(gymFeedbackKeys({ date: '2026-06-19', workoutId: 'w1' })).toEqual({ id: 'gym-2026-06-19', altIds: ['gym-2026-06-19-w1'] })
  })
  it('a legacy entry under ANY candidate is reachable (canonical + alts cover every id a session ever had)', () => {
    const k = gymFeedbackKeys({ date: '2026-06-19', planId: 'p1', activityId: 'a1', workoutId: 'w1' })
    expect([k.id, ...k.altIds]).toEqual(expect.arrayContaining(['p1', 'a1', 'gym-2026-06-19', 'gym-2026-06-19-w1']))
  })
})
