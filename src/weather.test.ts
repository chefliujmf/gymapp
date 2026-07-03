import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { weatherGuidance } from '../server/weather.js'

describe('weatherGuidance (#341)', () => {
  it('mild day → no flags', () => {
    const g = weatherGuidance({ tMax: 20, tApparentMax: 19, tMin: 12, precipProb: 10, windMax: 12 })
    expect(g.heat).toBe('none')
    expect(g.flags).toEqual([])
  })
  it('32°C apparent → high heat, derate guidance', () => {
    const g = weatherGuidance({ tMax: 31, tApparentMax: 32, tMin: 22 })
    expect(g.heat).toBe('high')
    expect(g.flags).toContain('heat:high')
    expect(g.notes.join(' ')).toMatch(/ease|trim|hydrat/i)
  })
  it('37°C apparent → extreme heat (indoor / easy)', () => {
    const g = weatherGuidance({ tApparentMax: 37 })
    expect(g.heat).toBe('extreme')
    expect(g.notes.join(' ')).toMatch(/indoor|coolest|easy/i)
  })
  it('prefers apparent temp over air temp for "feels like"', () => {
    expect(weatherGuidance({ tMax: 28, tApparentMax: 34 }).feels).toBe(34)
    expect(weatherGuidance({ tMax: 28 }).feels).toBe(28)
  })
  it('freezing + windy + wet → all flags', () => {
    const g = weatherGuidance({ tMax: 3, tApparentMax: 1, tMin: -3, precipProb: 80, windMax: 40 })
    expect(g.flags).toEqual(expect.arrayContaining(['cold', 'windy', 'wet']))
  })
  it('summary reads like a forecast line', () => {
    const g = weatherGuidance({ tMax: 30, tApparentMax: 33, precipProb: 20, windMax: 18 })
    expect(g.summary).toMatch(/feels like 33°C/)
    expect(g.summary).toMatch(/km\/h/)
  })
})
