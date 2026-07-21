import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { assignQuality, assignEasy, ARCHETYPE_KEYS, assignArchetypeBlock, keyFromTitle } from '../server/archetypes.js'

describe('#620 code-driven variety — assignQuality', () => {
  it('respects the intensity ceiling: a tempo ceiling yields only ≤tempo archetypes (no threshold/vo2/sweet-spot)', () => {
    const a = assignQuality({ sport: 'ride', count: 2, ceiling: 'tempo' })
    for (const x of a as any[]) expect(['threshold', 'vo2', 'sweetspot', 'overunder', 'hills']).not.toContain(x.key)
  })

  it('a build athlete (vo2 ceiling) can get the FULL range incl. over-unders / VO2 / hills, not just threshold+sweetspot', () => {
    // across 3 rotated weeks, the union of assigned archetypes must include something beyond threshold/sweetspot
    const keys = new Set<string>()
    for (let w = 0; w < 3; w++) for (const x of assignQuality({ sport: 'ride', count: 2, ceiling: 'vo2', weekIndex: w })) keys.add(x.key)
    const beyond = [...keys].filter((k) => !['threshold', 'sweetspot'].includes(k))
    expect(beyond.length).toBeGreaterThan(0) // proves it doesn't collapse to the two comfort-zone types
  })

  it('SKIPS recently-used archetypes (variety, not repetition)', () => {
    const recent = ['threshold', 'sweetspot']
    const a = assignQuality({ sport: 'ride', count: 2, ceiling: 'vo2', recentKeys: recent })
    for (const x of a as any[]) expect(recent).not.toContain(x.key) // picks fresh ones over the recent two
  })

  it('two quality days in a week are DIFFERENT archetypes', () => {
    const a = assignQuality({ sport: 'run', count: 2, ceiling: 'vo2' })
    expect(a[0].key).not.toBe(a[1].key)
  })

  it('rotates week to week (weekIndex changes the assignment)', () => {
    const w0 = assignQuality({ sport: 'ride', count: 2, ceiling: 'vo2', weekIndex: 0 }).map((x: any) => x.key).join()
    const w1 = assignQuality({ sport: 'ride', count: 2, ceiling: 'vo2', weekIndex: 1 }).map((x: any) => x.key).join()
    expect(w0).not.toBe(w1)
  })

  it('every sport has a real archetype pool', () => {
    for (const s of ['ride', 'run', 'swim']) expect(ARCHETYPE_KEYS[s].length).toBeGreaterThanOrEqual(4)
  })
})

describe('#620 assignEasy — easy days genuinely differ', () => {
  it('returns distinct rotating cues, not the same one repeated', () => {
    const c = assignEasy({ sport: 'ride', count: 4 })
    expect(new Set(c).size).toBeGreaterThanOrEqual(3) // at least 3 distinct cues across 4 easy days
  })
  it('skips recently-used cues', () => {
    const recent = ['steady Z2 endurance']
    const c = assignEasy({ sport: 'ride', count: 2, recentCues: recent })
    expect(c).not.toContain('steady Z2 endurance')
  })
})

describe('#620 assignArchetypeBlock — the block emitted into the prompt', () => {
  it('a build cyclist gets 2 quality/wk that DIFFER week-to-week (no repeated shape across the block)', () => {
    const b = assignArchetypeBlock({ sport: 'ride', qualityDays: 2, easyDays: 3, ceiling: 'vo2', weeks: 2 })
    expect(b).toHaveLength(2)
    const w0 = b[0].quality.map((a: any) => a.key)
    const w1 = b[1].quality.map((a: any) => a.key)
    expect(new Set(w0).size).toBe(2) // 2 distinct within the week
    // the block carries `used` forward, so week 2 avoids week 1's keys
    for (const k of w1) expect(w0).not.toContain(k)
  })

  it('a pregnancy/maintenance persona (1 moderate slot, tempo ceiling) gets ONLY ≤tempo quality — never sweet-spot/threshold/vo2', () => {
    const b = assignArchetypeBlock({ sport: 'run', qualityDays: 1, easyDays: 4, ceiling: 'tempo', weeks: 2 })
    for (const wk of b as any[]) for (const a of wk.quality) expect(['sweetspot', 'threshold', 'overunder', 'hills', 'mpace', 'vo2', 'fartlek']).not.toContain(a.key)
  })

  it('even a SMALL pool (tempo-ceiling: strides/tempo) alternates week to week — not the same archetype twice', () => {
    const b = assignArchetypeBlock({ sport: 'run', qualityDays: 1, easyDays: 3, ceiling: 'tempo', weeks: 2 })
    expect(b[0].quality[0].key).not.toBe(b[1].quality[0].key) // strides wk1, tempo wk2 (was strides+strides before the fix)
    // easy cues also differ across the two weeks
    expect(b[0].easy.join()).not.toBe(b[1].easy.join())
  })

  it('a swimmer gets SWIM archetypes (not silently substituted with a run/ride)', () => {
    const b = assignArchetypeBlock({ sport: 'swim', qualityDays: 2, easyDays: 2, ceiling: 'threshold', weeks: 1 })
    for (const a of b[0].quality as any[]) expect(ARCHETYPE_KEYS.swim).toContain(a.key)
  })

  it('every easy day still gets a cue', () => {
    const b = assignArchetypeBlock({ sport: 'ride', qualityDays: 1, easyDays: 3, ceiling: 'sweetspot', weeks: 1 })
    expect(b[0].easy.length).toBe(3)
  })
})

describe('#620 keyFromTitle — look-back fingerprint', () => {
  it('maps quality titles to their archetype key, and easy/rest to null', () => {
    expect(keyFromTitle('Sweet-Spot 3×12')).toBe('sweetspot')
    expect(keyFromTitle('Over-Unders')).toBe('overunder')
    expect(keyFromTitle('VO2 Intervals')).toBe('vo2')
    expect(keyFromTitle('Easy Aerobic Run')).toBeNull()
    expect(keyFromTitle('Long Run')).toBeNull()
  })
})
