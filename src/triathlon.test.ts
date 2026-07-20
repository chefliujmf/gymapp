import { describe, it, expect } from 'vitest'
import { parseRaceType, triathlonSynthesis, RACE_DEMAND } from './triathlon'

describe('parseRaceType', () => {
  it('reads the race from goal text', () => {
    expect(parseRaceType('training for my first 70.3 in the fall')).toBe('70.3')
    expect(parseRaceType('sprint tri to start')).toBe('sprint')
    expect(parseRaceType('full ironman next year')).toBe('ironman')
    expect(parseRaceType('olympic distance')).toBe('olympic')
  })
  it('a generic triathlon goal defaults to Olympic; unrelated → null', () => {
    expect(parseRaceType('get better at triathlon')).toBe('olympic')
    expect(parseRaceType('lose weight')).toBeNull()
    expect(parseRaceType('')).toBeNull()
  })
})

describe('triathlonSynthesis — limiter', () => {
  const strong = { has: true, computed: true }
  it("flags an UNASSESSED swim as the limiter (JM's real state)", () => {
    const r = triathlonSynthesis({
      raceType: '70.3', swim: { has: false, computed: false }, bike: strong, run: strong,
      load: { swim: 20, bike: 260, run: 130 }, // swim ~5%, bike ~63%, run ~32%
    })
    expect(r.limiter).toBe('swim')
    expect(r.disciplines.find((d) => d.discipline === 'swim')!.readiness).toBeLessThan(40)
    expect(r.disciplines.find((d) => d.discipline === 'bike')!.readiness).toBeGreaterThan(75)
    expect(r.insight).toMatch(/swim|CSS/i)
  })
  it('no limiter when all three are dialed in + balanced', () => {
    const r = triathlonSynthesis({
      raceType: 'olympic', swim: strong, bike: strong, run: strong,
      load: { swim: RACE_DEMAND.olympic.swim, bike: RACE_DEMAND.olympic.bike, run: RACE_DEMAND.olympic.run },
    })
    expect(r.limiter).toBeNull()
  })
  it('an under-prepared BIKE outranks an under-prepared SWIM at equal readiness (demand-weighted)', () => {
    const weak = { has: false, computed: false }
    const r = triathlonSynthesis({ raceType: '70.3', swim: weak, bike: weak, run: { has: true, computed: true }, load: { swim: 0, bike: 0, run: 100 } })
    expect(r.limiter).toBe('bike') // bike is 56% of the race → bigger weighted gap than the swim's 14%
  })
  it('load shares sum to ~100 and reflect the inputs', () => {
    const r = triathlonSynthesis({ raceType: 'olympic', swim: { has: true, computed: false }, bike: { has: true, computed: true }, run: { has: true, computed: true }, load: { swim: 25, bike: 50, run: 25 } })
    const shares = r.disciplines.map((d) => d.sharePct)
    expect(shares).toEqual([25, 50, 25])
  })
  it('zero load → shares are 0, benchmarks still drive readiness', () => {
    const r = triathlonSynthesis({ raceType: 'olympic', swim: { has: false, computed: false }, bike: { has: true, computed: true }, run: { has: true, computed: true }, load: { swim: 0, bike: 0, run: 0 } })
    expect(r.disciplines.every((d) => d.sharePct === 0)).toBe(true)
    expect(r.limiter).toBe('swim') // no benchmark + no load
  })
})
