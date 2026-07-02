import { describe, it, expect } from 'vitest'
import { learnedStatState } from './learnedStat'

// #319 — one consistent "learned stat" treatment (default → learning → suggestion → settled).
describe('learnedStatState', () => {
  it('default value → confirm-it copy', () => {
    const s = learnedStatState({ source: 'default' })
    expect(s.phase).toBe('default')
    expect(s.note).toMatch(/confirm/i)
  })
  it('still collecting → "N more <unit>" transparency (#304 generalized)', () => {
    const s = learnedStatState({ source: 'computed', samplesHave: 3, samplesNeed: 14, unit: 'nights' })
    expect(s.phase).toBe('learning')
    expect(s.needMore).toBe(11)
    expect(s.note).toMatch(/11 more nights/)
  })
  it('enough data + a differing suggestion → "data suggests X — use it"', () => {
    const s = learnedStatState({ source: 'computed', samplesHave: 20, samplesNeed: 14, suggestion: '9 h' })
    expect(s.phase).toBe('suggestion')
    expect(s.note).toMatch(/suggests 9 h/)
    expect(s.needMore).toBe(0)
  })
  it('enough data, no suggestion → settled', () => {
    expect(learnedStatState({ source: 'intervals', samplesHave: 30, samplesNeed: 14 }).phase).toBe('settled')
    expect(learnedStatState({ source: 'manual' }).phase).toBe('settled')
  })
  it('exposes a short source tag', () => {
    expect(learnedStatState({ source: 'manual' }).tag).toBe('yours')
    expect(learnedStatState({ source: 'intervals' }).tag).toBe('intervals')
    expect(learnedStatState({ source: 'computed' }).tag).toBe('est.')
  })
})
