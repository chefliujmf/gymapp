import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { mirrorBrokenPlans } from '../server/icu-match.js'

// #726 — healMirror re-pushes a current/future Platyplus plan that isn't correctly mirrored in intervals. Two failure
// modes: (a) never synced (no icuEventId), (b) STALE — the plan's icuEventId points at an event DELETED in intervals
// (JM's 07-22 "Threshold 4×10" → event 121594819 gone, but 07-23's event survived). The old healer only caught (a).
describe('mirrorBrokenPlans (#726)', () => {
  const today = '2026-07-22'
  it('flags a never-synced future plan (no icuEventId)', () => {
    const plans = [{ id: 'p1', date: '2026-07-23', origin: 'platyplus' }]
    expect(mirrorBrokenPlans(plans, today, new Set([])).map((p: { id: string }) => p.id)).toEqual(['p1'])
  })
  it('flags a STALE plan whose event is gone from intervals, but NOT one whose event is present', () => {
    const plans = [
      { id: 'today', date: '2026-07-22', origin: 'platyplus', icuEventId: 121594819 }, // event DELETED
      { id: 'tmrw', date: '2026-07-23', origin: 'platyplus', icuEventId: 121594822 },  // event PRESENT
    ]
    const existing = new Set([121594822]) // only tomorrow's event exists in intervals
    expect(mirrorBrokenPlans(plans, today, existing).map((p: { id: string }) => p.id)).toEqual(['today'])
  })
  it('is string/number tolerant for the icuEventId membership check', () => {
    const plans = [{ id: 'p', date: '2026-07-22', origin: 'platyplus', icuEventId: '121594822' }]
    expect(mirrorBrokenPlans(plans, today, new Set([121594822]))).toEqual([]) // present despite string vs number
  })
  it('ignores PAST plans and intervals-ORIGIN plans', () => {
    const plans = [
      { id: 'past', date: '2026-07-20', origin: 'platyplus' },                 // past → skip
      { id: 'icu', date: '2026-07-23', origin: 'icu', icuEventId: 999 },        // intervals-origin → not ours to heal
    ]
    expect(mirrorBrokenPlans(plans, today, new Set([]))).toEqual([])
  })
  it('when the events fetch failed (existing=null), heals only never-synced plans (never a false re-push)', () => {
    const plans = [
      { id: 'synced', date: '2026-07-23', origin: 'platyplus', icuEventId: 55 }, // can't verify → assume OK
      { id: 'unsynced', date: '2026-07-23', origin: 'platyplus' },
    ]
    expect(mirrorBrokenPlans(plans, today, null).map((p: { id: string }) => p.id)).toEqual(['unsynced'])
  })
})
