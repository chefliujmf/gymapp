import { describe, it, expect } from 'vitest'
import { buildDayEntries, bucketSport, type LogEntry } from './logs-merge'
import type { WorkoutLog } from './db'
import type { IcuActivity } from './intervals'

const log = (o: Partial<WorkoutLog>): WorkoutLog => ({ date: '2026-06-26', discipline: 'ride', title: 'X', ...o }) as WorkoutLog
const act = (o: Partial<IcuActivity>): IcuActivity => ({ id: 'i1', start_date_local: '2026-06-26T16:00:00', type: 'Ride', name: 'X', ...o } as unknown as IcuActivity)
const sports = (b: Map<string, { entries: LogEntry[] }>, day: string) => (b.get(day)?.entries ?? [])

describe('bucketSport', () => {
  it('normalizes known disciplines and never returns the raw string', () => {
    expect(bucketSport('cycling')).toBe('ride')
    expect(bucketSport('Ride')).toBe('ride')
    expect(bucketSport('running')).toBe('run')
    expect(bucketSport('strength')).toBe('gym')
    expect(bucketSport('endurance')).toBe('other') // the old fall-through that caused the dup
    expect(bucketSport('')).toBe('other')
  })
})

describe('buildDayEntries — #197 no phantom duplicate', () => {
  it('collapses a stale local ride-log + the real device activity into ONE (device wins)', () => {
    const b = buildDayEntries(
      [log({ title: 'Friday Ride to Skov', discipline: 'ride' })],
      [act({ id: 'i160604649', name: 'Friday Endurance Ride', type: 'Ride' })],
      [],
    )
    const e = sports(b, '2026-06-26')
    expect(e).toHaveLength(1)
    expect(e[0].kind).toBe('device')
    expect(e[0].kind === 'device' && e[0].act.name).toBe('Friday Endurance Ride')
  })

  it('keeps a gym session (with sets) over a device activity on the same day+sport', () => {
    const b = buildDayEntries(
      [log({ title: 'Push Day', discipline: 'strength', sets: { Bench: [] } as unknown as WorkoutLog['sets'] })],
      [act({ type: 'WeightTraining', name: 'Gym' })],
      [],
    )
    const e = sports(b, '2026-06-26')
    expect(e).toHaveLength(1)
    expect(e[0].kind).toBe('gym')
  })

  it('keeps two DIFFERENT sports on the same day (gym + ride)', () => {
    const b = buildDayEntries(
      [log({ title: 'Push Day', discipline: 'strength', sets: { Bench: [] } as unknown as WorkoutLog['sets'] })],
      [act({ type: 'Ride', name: 'Endurance' })],
      [],
    )
    expect(sports(b, '2026-06-26')).toHaveLength(2)
  })

  it('attaches a check-in to its day even with no session', () => {
    const b = buildDayEntries([], [], [{ date: '2026-06-26', energy: 7 }])
    expect(b.get('2026-06-26')?.checkin?.energy).toBe(7)
    expect(sports(b, '2026-06-26')).toHaveLength(0)
  })
})
