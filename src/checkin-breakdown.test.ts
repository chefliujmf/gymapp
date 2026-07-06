import { describe, it, expect } from 'vitest'
import { seriesStats } from './pages/Wellness'

// #383 — legend stats for the check-in breakdown (Sleep · Energy · Form).
describe('seriesStats', () => {
  it('computes avg / min / max over the non-null daily values', () => {
    expect(seriesStats([5, 4, 3, 5])).toEqual({ avg: 4.3, min: 3, max: 5 })
  })
  it('skips nulls (sparse check-in series)', () => {
    expect(seriesStats([null, 4, null, 2, null])).toEqual({ avg: 3, min: 2, max: 4 })
  })
  it('rounds the average to 1 decimal', () => {
    expect(seriesStats([1, 2])!.avg).toBe(1.5)
    expect(seriesStats([1, 1, 2])!.avg).toBe(1.3)
  })
  it('returns null when there is no data', () => {
    expect(seriesStats([])).toBeNull()
    expect(seriesStats([null, null])).toBeNull()
  })
})
