import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { normTitle, eventMatchesPlan, planDroppedByReconcile, slotKey, orphanIsMoveLeftover, liveHas } from '../server/icu-match.js'

// #150 — the dedup that decides "is this Platyplus plan already in intervals?" The real bug:
// the athlete's OTHER coach names the event "...#Codex Coach #Aggressive June Build", so an
// exact-title match failed and we created duplicates. These lock the fuzzy match.

const ridePlan = { id: 'pp-abc', sport: 'ride', title: 'Saturday Recovery Spin at Skov' }

describe('intervals dedup matcher (#150)', () => {
  it('normTitle drops the #hashtag coach suffix', () => {
    expect(normTitle('Saturday Recovery Spin at Skov #Codex Coach #Aggressive June Build'))
      .toBe('saturday recovery spin at skov')
  })

  it('matches the other coach event despite the #Codex suffix (the dup bug)', () => {
    expect(eventMatchesPlan(ridePlan, {
      type: 'Ride', category: 'WORKOUT',
      name: 'Saturday Recovery Spin at Skov #Codex Coach #Aggressive June Build',
    })).toBe(true)
  })

  it('matches our own exact-title event', () => {
    expect(eventMatchesPlan(ridePlan, { type: 'Ride', category: 'WORKOUT', name: 'Saturday Recovery Spin at Skov' })).toBe(true)
  })

  it('matches by external_id even if the title differs', () => {
    expect(eventMatchesPlan(ridePlan, { type: 'Ride', category: 'WORKOUT', name: 'totally different', external_id: 'pp-abc' })).toBe(true)
    // intervals adds a ":date" instance suffix on re-push — still ours.
    expect(eventMatchesPlan(ridePlan, { type: 'Ride', category: 'WORKOUT', name: 'x', external_id: 'pp-abc:2026-06-27' })).toBe(true)
  })

  it('does NOT match a different sport or an unrelated title', () => {
    expect(eventMatchesPlan(ridePlan, { type: 'Run', category: 'WORKOUT', name: 'Saturday Recovery Spin at Skov' })).toBe(false)
    expect(eventMatchesPlan(ridePlan, { type: 'Ride', category: 'WORKOUT', name: 'Threshold 4x8' })).toBe(false)
  })

  it('never matches a non-WORKOUT event (notes/targets)', () => {
    expect(eventMatchesPlan(ridePlan, { type: 'Ride', category: 'NOTE', name: 'Saturday Recovery Spin at Skov' })).toBe(false)
  })
})

// #185 — when the external coach republishes a workout under a NEW title for a slot the
// athlete already has, Platyplus must drop the STALE plan whose mirror event is gone (and
// the slot now has a replacement) — instead of showing both. But a pure intervals deletion
// (no replacement) must NOT remove a Platyplus-authored plan (Platyplus stays master, #160).
describe('planDroppedByReconcile (#185 replaced-plan cleanup)', () => {
  const win = { from: '2026-06-22', to: '2026-06-28' }
  const skov = { id: 'friday_ride_to_skov_2026-06-26', date: '2026-06-26', sport: 'ride', title: 'Friday Ride to Skov', origin: 'platyplus', icuEventId: 118840139 }
  const ownedSlots = new Set([slotKey('2026-06-26', 'ride')]) // the coach's "Friday Endurance Ride" is live here

  it('drops the stale platyplus plan when its event is gone AND the slot has a replacement', () => {
    expect(planDroppedByReconcile(skov, { liveIds: new Set([118860036]), ownedSlots, ...win })).toBe(true)
  })

  it('keeps it while its own mirror event is still live', () => {
    expect(planDroppedByReconcile(skov, { liveIds: new Set([118840139]), ownedSlots, ...win })).toBe(false)
  })

  it('keeps a Platyplus plan whose event was deleted with NO replacement (respects #160)', () => {
    expect(planDroppedByReconcile(skov, { liveIds: new Set(), ownedSlots: new Set(), ...win })).toBe(false)
  })

  it('never drops a locally-authored plan that was never pushed (no icuEventId)', () => {
    const local = { ...skov, icuEventId: undefined }
    expect(planDroppedByReconcile(local, { liveIds: new Set(), ownedSlots, ...win })).toBe(false)
  })

  it('drops an icu-origin plan whose event vanished even without a replacement (pure mirror)', () => {
    const icu = { ...skov, origin: 'icu' }
    expect(planDroppedByReconcile(icu, { liveIds: new Set(), ownedSlots: new Set(), ...win })).toBe(true)
  })

  it('does not judge plans outside the synced window', () => {
    const past = { ...skov, date: '2026-06-01' }
    expect(planDroppedByReconcile(past, { liveIds: new Set(), ownedSlots, ...win })).toBe(false)
  })
})

// #446 — the orphan-GC decision: delete a move/re-plan LEFTOVER (slot re-taken by a live plan) but NEVER a
// legit lost-link session (unique title, no live plan owns its slot). Reproduces the exact prod dup-gym case.
describe('orphanIsMoveLeftover (#446 orphan-GC)', () => {
  // prod case: Jul-9 has a stray "Upper-Body & Trunk" event (121417361, no plan) while the LIVE Full-Body
  // plan owns Jul-9 gym, and the real Upper-Body lives on Jul-13.
  const orphan9 = { id: 121417361, type: 'WeightTraining', name: 'Upper-Body & Trunk', start_date_local: '2026-07-09T15:00:00' }
  const fullBodyLive = { id: 'mcp-8yqqn8sq', date: '2026-07-09', sport: 'gym', title: 'Full-Body Strength', icuEventId: 121371062 }
  const upperJul13 = { id: 'mcp-2dr0x7ae', date: '2026-07-13', sport: 'gym', title: 'Upper-Body & Trunk', icuEventId: 121320987 }

  it('DELETES the #446 orphan — a different LIVE plan (Full-Body) owns its Jul-9 slot', () => {
    expect(orphanIsMoveLeftover(orphan9, { liveIds: new Set([121371062, 121320987]), plans: [fullBodyLive, upperJul13] })).toBe(true)
  })

  it('still deletes when the sibling link is stored as a STRING (the type-mismatch that defeated the old rule)', () => {
    const fullBodyStr = { ...fullBodyLive, icuEventId: '121371062' } // link is a string
    expect(orphanIsMoveLeftover(orphan9, { liveIds: new Set([121371062]), plans: [fullBodyStr] })).toBe(true)
    expect(liveHas(new Set([121371062]), '121371062')).toBe(true) // the fix, directly
    expect(liveHas(new Set(['121371062']), 121371062)).toBe(true)
  })

  it('KEEPS a legit lost-link session — unique title, no live plan owns its slot (never delete #431/#377)', () => {
    const lost = { id: 'mcp-rain', date: '2026-07-09', sport: 'gym', title: 'Full-Body Strength — Rain Day', icuEventId: undefined }
    const orphanLost = { id: 900001, type: 'WeightTraining', name: 'Full-Body Strength — Rain Day', start_date_local: '2026-07-09T15:00:00' }
    expect(orphanIsMoveLeftover(orphanLost, { liveIds: new Set(), plans: [lost] })).toBe(false)
  })

  it('KEEPS an orphan whose slot is owned only by a DEAD (not live) sibling link', () => {
    const fullBodyDead = { ...fullBodyLive, icuEventId: 999999 } // link points at a deleted event
    expect(orphanIsMoveLeftover(orphan9, { liveIds: new Set([121320987]), plans: [fullBodyDead] })).toBe(false)
  })

  it('does not treat the orphan as owning its own slot (self-match guard)', () => {
    const selfPlan = { id: 'mcp-x', date: '2026-07-09', sport: 'gym', title: 'Upper-Body & Trunk', icuEventId: 121417361 }
    expect(orphanIsMoveLeftover(orphan9, { liveIds: new Set([121417361]), plans: [selfPlan] })).toBe(false)
  })

  it('a different-SPORT live plan in the slot does not trigger deletion', () => {
    const rideSameDay = { id: 'mcp-r', date: '2026-07-09', sport: 'ride', title: 'Endurance', icuEventId: 121371062 }
    expect(orphanIsMoveLeftover(orphan9, { liveIds: new Set([121371062]), plans: [rideSameDay] })).toBe(false)
  })
})
