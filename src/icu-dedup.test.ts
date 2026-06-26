import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { normTitle, eventMatchesPlan } from '../server/icu-match.js'

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
