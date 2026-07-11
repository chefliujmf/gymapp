import { describe, it, expect } from 'vitest'
import { orphanActivities, normSport } from './orphan-activities'
import type { IcuEvent, IcuActivity } from './intervals'

const act = (id: string, type: string, date: string): IcuActivity => ({ id, type, start_date_local: `${date}T09:00:00` })
const ev = (id: string, type: string, date: string): IcuEvent => ({ id, name: type, type, start_date_local: `${date}T09:00:00` } as unknown as IcuEvent)

describe('normSport', () => {
  it('folds intervals sport names onto the plan scale', () => {
    expect(normSport('cycling')).toBe('ride')
    expect(normSport('running')).toBe('run')
    expect(normSport('gym')).toBe('gym')
    expect(normSport('ride')).toBe('ride')
  })
})

describe('orphanActivities (#5013)', () => {
  const day = '2026-07-07'

  it('surfaces a completed workout that has no plan or event that day', () => {
    const acts = [act('a1', 'WeightTraining', day)]
    const out = orphanActivities(day, [], [], acts)
    expect(out.map((a) => a.id)).toEqual(['a1'])
  })

  it('hides an activity already covered by a plan of the same sport', () => {
    const acts = [act('a1', 'WeightTraining', day)]
    const plans = [{ date: day, sport: 'gym' }]
    expect(orphanActivities(day, plans, [], acts)).toHaveLength(0)
  })

  it('hides a ride activity covered by a cycling event (sport names normalise)', () => {
    const acts = [act('a1', 'VirtualRide', day)]
    const events = [ev('e1', 'Ride', day)]
    expect(orphanActivities(day, [], events, acts)).toHaveLength(0)
  })

  it('still surfaces an activity of a DIFFERENT sport than the day plan', () => {
    const acts = [act('a1', 'WeightTraining', day)] // gym
    const plans = [{ date: day, sport: 'ride' }] // planned ride, but they lifted
    expect(orphanActivities(day, plans, [], acts).map((a) => a.id)).toEqual(['a1'])
  })

  it('only considers activities on the given day', () => {
    const acts = [act('a1', 'Run', '2026-07-06'), act('a2', 'Run', day)]
    expect(orphanActivities(day, [], [], acts).map((a) => a.id)).toEqual(['a2'])
  })
})
