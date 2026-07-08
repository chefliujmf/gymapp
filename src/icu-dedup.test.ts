import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { normTitle, eventMatchesPlan, planDroppedByReconcile, slotKey } from '../server/icu-match.js'

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
