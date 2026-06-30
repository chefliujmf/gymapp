import { describe, it, expect } from 'vitest'
import { mindStats, isMindDiscipline } from './mind-stats'

// #194c — Mind stats from logged sessions.
describe('isMindDiscipline', () => {
  it('accepts mind/meditation/yoga/pilates, rejects others', () => {
    expect(isMindDiscipline('mind')).toBe(true)
    expect(isMindDiscipline('Meditation')).toBe(true)
    expect(isMindDiscipline('yoga')).toBe(true)
    expect(isMindDiscipline('cycling')).toBe(false)
  })
})

describe('mindStats', () => {
  const today = '2026-06-30'
  it('this-month minutes & sessions', () => {
    const s = mindStats([{ date: '2026-06-29', duration: 10 }, { date: '2026-06-28', duration: 8 }, { date: '2026-05-20', duration: 30 }], today)
    expect(s.minutesMonth).toBe(18) // May session excluded
    expect(s.sessionsMonth).toBe(2)
  })
  it('streak counts consecutive days ending today', () => {
    const s = mindStats([{ date: '2026-06-30', duration: 5 }, { date: '2026-06-29', duration: 5 }, { date: '2026-06-28', duration: 5 }], today)
    expect(s.streak).toBe(3)
  })
  it('streak grace: done yesterday but not yet today still counts', () => {
    const s = mindStats([{ date: '2026-06-29', duration: 5 }, { date: '2026-06-28', duration: 5 }], today)
    expect(s.streak).toBe(2)
  })
  it('streak breaks with a gap', () => {
    const s = mindStats([{ date: '2026-06-30', duration: 5 }, { date: '2026-06-28', duration: 5 }], today)
    expect(s.streak).toBe(1) // 29th missing
  })
  it('no recent sessions → streak 0', () => {
    expect(mindStats([{ date: '2026-06-01', duration: 5 }], today).streak).toBe(0)
  })
  it('weekly buckets: 8 entries, most recent last', () => {
    const s = mindStats([{ date: '2026-06-30', duration: 20 }, { date: '2026-06-23', duration: 15 }], today)
    expect(s.weeklyMinutes).toHaveLength(8)
    expect(s.weeklyMinutes[7]).toBe(20) // this week
    expect(s.weeklyMinutes[6]).toBe(15) // last week
  })
})
