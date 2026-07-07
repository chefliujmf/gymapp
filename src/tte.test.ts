import { describe, it, expect } from 'vitest'
import { tteFromPower, tteFromPace, fmtTte } from './tte'

// #401 — TTE = longest duration you can hold threshold, read off the mean-max curve.
describe('tteFromPower (cycling — longest time ≥ eFTP)', () => {
  const secs = [5, 60, 300, 600, 1200, 3600]
  const watts = [800, 400, 310, 270, 229, 180] // descending
  it('finds the crossover: longest duration still ≥ eFTP', () => {
    expect(tteFromPower(secs, watts, 253)).toBe(600) // 310@300 & 270@600 ≥253; 229@1200 <253 → 600s (10m)
  })
  it('a lower eFTP → longer TTE', () => {
    expect(tteFromPower(secs, watts, 229)!).toBeGreaterThanOrEqual(tteFromPower(secs, watts, 253)!)
  })
  it('null when eFTP above your whole curve, or missing inputs', () => {
    expect(tteFromPower(secs, watts, 900)).toBeNull()
    expect(tteFromPower([], [], 250)).toBeNull()
    expect(tteFromPower(secs, watts, null)).toBeNull()
  })
})

describe('tteFromPace (running — longest time ≤ threshold pace)', () => {
  // dist(m) → best time(s): 1k@240 (4:00/km), 3k@900 (5:00/km), 5k@1600 (5:20/km)
  const dist = [1000, 3000, 5000]
  const time = [240, 900, 1600]
  it('longest effort still at/faster than threshold pace', () => {
    // threshold 5:00/km (300 s/km): 1k=4:00 ✓, 3k=5:00 ✓, 5k=5:20 ✗ → longest = 3k (900 s)
    expect(tteFromPace(dist, time, 300)).toBe(900)
  })
  it('a faster (smaller) threshold pace → shorter TTE', () => {
    expect(tteFromPace(dist, time, 250)).toBe(240) // only the 1k (4:00) is ≤4:10
  })
  it('null when threshold faster than anything you ran / bad inputs', () => {
    expect(tteFromPace(dist, time, 200)).toBeNull() // nothing ≤3:20/km
    expect(tteFromPace([], [], 300)).toBeNull()
  })
})

describe('TTE floor — a sub-2-min hold isn’t a real TTE (threshold set too high) → null', () => {
  it('running: only a short sprint qualifies → null, not 0:22', () => {
    expect(tteFromPace([400], [80], 300)).toBeNull() // 400 m in 80 s (3:20/km ≤ 5:00) but 80 s < 120 s floor
  })
  it('cycling: only a 30 s effort ≥ eFTP → null', () => {
    expect(tteFromPower([5, 30, 600], [500, 300, 200], 280)).toBeNull() // 30 s@300 ≥280 but < floor; 600 s@200 <280
  })
})

describe('fmtTte', () => {
  it('m:ss under an hour', () => expect(fmtTte(600)).toBe('10:00'))
  it('h:mm:ss over an hour', () => expect(fmtTte(3720)).toBe('1:02:00'))
  it('rounds seconds', () => expect(fmtTte(65.6)).toBe('1:06'))
})
