import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module
import { validateEvent, normEvent, nearestPeakEvent, taperWeeksForName, upcomingEvents, seasonPromptBlock, EVENT_JOBS } from '../server/events.js'

describe('#760 event validation + normalize', () => {
  it('accepts a well-formed event, rejects bad ones', () => {
    expect(validateEvent({ name: 'Chattanooga 70.3', start: '2026-09-21', job: 'peak' })).toBeNull()
    expect(validateEvent({ start: '2026-09-21', job: 'peak' })).toMatch(/name/)
    expect(validateEvent({ name: 'x', start: 'nope', job: 'peak' })).toMatch(/start/)
    expect(validateEvent({ name: 'x', start: '2026-09-21', job: 'win' })).toMatch(/job/)
    expect(validateEvent({ name: 'x', start: '2026-10-05', end: '2026-10-01', job: 'block' })).toMatch(/end/)
    expect(EVENT_JOBS).toEqual(['peak', 'ready', 'block', 'note'])
  })
  it('normEvent trims + keeps only the shape', () => {
    const e = normEvent({ name: '  Girona trip  ', start: '2026-10-04', end: '2026-10-11', job: 'ready', sport: 'cycling' }, 'ev1')
    expect(e).toMatchObject({ id: 'ev1', name: 'Girona trip', start: '2026-10-04', end: '2026-10-11', job: 'ready', sport: 'cycling' })
  })
})

describe('#760 nearestPeakEvent — only a future PEAK drives periodization', () => {
  const today = '2026-08-01'
  const evs = [
    { id: 'a', name: 'Local Sprint', start: '2026-08-10', job: 'ready' }, // near but not a peak
    { id: 'b', name: 'Chattanooga 70.3', start: '2026-09-21', job: 'peak' },
    { id: 'c', name: 'Worlds', start: '2026-11-01', job: 'peak' }, // further peak
    { id: 'd', name: 'Past race', start: '2026-06-01', job: 'peak' }, // past
  ]
  it('picks the NEAREST future peak (not a nearer non-peak, not a past peak, not a further peak)', () => {
    expect(nearestPeakEvent(evs, today)?.id).toBe('b')
  })
  it('returns null when there is no future peak', () => {
    expect(nearestPeakEvent([{ id: 'a', name: 'trip', start: '2026-09-01', job: 'ready' }], today)).toBeNull()
    expect(nearestPeakEvent([], today)).toBeNull()
  })
})

describe('#760 taperWeeksForName — distance-aware from the free-text name', () => {
  it('IM 4wk, 70.3 3wk, marathon/fondo 2wk, short 2wk', () => {
    expect(taperWeeksForName('Ironman Nice')).toBe(4)
    expect(taperWeeksForName('Chattanooga 70.3')).toBe(3)
    expect(taperWeeksForName('Berlin Marathon')).toBe(2)
    expect(taperWeeksForName('Girona Gran Fondo')).toBe(2)
    expect(taperWeeksForName('Local 5K')).toBe(2)
  })
})

describe('#760 upcomingEvents + seasonPromptBlock', () => {
  const today = '2026-08-01'
  const evs = [
    { id: 'a', name: 'Local Sprint Tri', start: '2026-08-10', job: 'ready', sport: 'triathlon' },
    { id: 'b', name: 'Chattanooga 70.3', start: '2026-09-21', job: 'peak' },
    { id: 'p', name: 'Old race', start: '2026-05-01', job: 'peak' },
  ]
  it('upcomingEvents drops past + sorts by date', () => {
    const up = upcomingEvents(evs, today)
    expect(up.map((e: { id: string }) => e.id)).toEqual(['a', 'b'])
  })
  it('seasonPromptBlock is EMPTY with no events, and lists + rules when present', () => {
    expect(seasonPromptBlock([], today)).toBe('')
    const blk = seasonPromptBlock(evs, today)
    expect(blk).toMatch(/# SEASON/)
    expect(blk).toMatch(/Chattanooga 70\.3/)
    expect(blk).toMatch(/PEAK/)
    expect(blk).toMatch(/train-through|residual fitness/i) // the two-peaks-too-close rule
    expect(blk).not.toMatch(/Old race/) // past excluded
  })
})
