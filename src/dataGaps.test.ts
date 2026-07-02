import { describe, it, expect } from 'vitest'
import { dataGaps } from './dataGaps'
import type { User } from './auth/api'

const base = (o: Partial<User> = {}): User => ({ id: '1', username: 'x', email: 'x@x.com', role: 'user', sports: [], ...o } as User)

describe('dataGaps', () => {
  it('flags intervals for a bare account (sleep need is now its own SleepNeed card, #304)', () => {
    const keys = dataGaps(base()).map((g) => g.key)
    expect(keys).toContain('intervals')
    expect(keys).not.toContain('sleepNeed')
  })
  it('cyclist with no FTP → ftp gap; runner with no pace → thresholdPace gap', () => {
    expect(dataGaps(base({ sports: ['cycling'] })).map((g) => g.key)).toContain('ftp')
    expect(dataGaps(base({ sports: ['running'] })).map((g) => g.key)).toContain('thresholdPace')
  })
  it('does not ask a runner for FTP or a cyclist for pace', () => {
    expect(dataGaps(base({ sports: ['running'] })).map((g) => g.key)).not.toContain('ftp')
    expect(dataGaps(base({ sports: ['cycling'] })).map((g) => g.key)).not.toContain('thresholdPace')
  })
  it('resolved fields drop their gap', () => {
    const u = base({ sports: ['cycling'], hasIcuKey: true, ftp: 260, maxHR: 185, sleepNeed: 8 })
    expect(dataGaps(u)).toHaveLength(0)
  })
  it('maxHR only asked for endurance athletes', () => {
    expect(dataGaps(base({ sports: ['strength'], sleepNeed: 8 })).map((g) => g.key)).not.toContain('maxHr')
    expect(dataGaps(base({ sports: ['cycling'], hasIcuKey: true, ftp: 260, sleepNeed: 8 })).map((g) => g.key)).toContain('maxHr')
  })
  it('null user → no gaps', () => { expect(dataGaps(null)).toEqual([]) })
})
