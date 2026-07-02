import { describe, it, expect } from 'vitest'
import { exerciseInsight } from './strength'

const DAY = 864e5
const pt = (dayOffset: number, e1rm: number) => ({ date: 1_700_000_000_000 + dayOffset * DAY, e1rm })

describe('exerciseInsight (#255)', () => {
  it('null when no data; new on a single session', () => {
    expect(exerciseInsight([])).toBeNull()
    const n = exerciseInsight([pt(0, 100)])!
    expect(n.tone).toBe('new')
  })
  it('PR/on-form when the latest is the peak', () => {
    const r = exerciseInsight([pt(0, 90), pt(7, 95), pt(14, 100)])!
    expect(r.tone).toBe('pr')
    expect(r.text).toMatch(/100 kg/)
  })
  it('stalled when 3+ sessions off the peak', () => {
    const r = exerciseInsight([pt(0, 100), pt(7, 95), pt(14, 96), pt(21, 94)])!
    expect(r.tone).toBe('stall')
    expect(r.text).toMatch(/Stalled/)
  })
  it('trending up when rising but below peak', () => {
    const r = exerciseInsight([pt(0, 100), pt(7, 90), pt(14, 96)])!
    expect(r.tone).toBe('up')
  })
  it('flat when holding below peak without a new high', () => {
    const r = exerciseInsight([pt(0, 100), pt(7, 95), pt(14, 95)])!
    expect(r.tone).toBe('flat')
  })
  it('respects the unit formatter', () => {
    const r = exerciseInsight([pt(0, 100), pt(7, 110)], (kg) => `${Math.round(kg * 2.2)} lb`)!
    expect(r.text).toMatch(/lb/)
  })
})
