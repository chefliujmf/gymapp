import { describe, it, expect } from 'vitest'
import { hrRatioVo2max, runningVo2max, cyclingVo2max, headlineVo2max, confLabel } from './vo2max-submax'

// #234 — submaximal per-sport VO₂max.
describe('hrRatioVo2max (15.3 × HRmax/HRrest)', () => {
  it("JM's case 185/55 ≈ 51.5 (matches his Léger ~52)", () => {
    expect(hrRatioVo2max(185, 55)).toBeCloseTo(15.3 * 185 / 55, 1)
    expect(hrRatioVo2max(185, 55)).toBeGreaterThan(50)
  })
  it('null on bad/missing HRs', () => {
    expect(hrRatioVo2max(0, 55)).toBeNull()
    expect(hrRatioVo2max(185, 0)).toBeNull()
    expect(hrRatioVo2max(150, 160)).toBeNull() // max ≤ rest
  })
})

describe('runningVo2max — VDOT vs HR-ratio, higher wins', () => {
  it('takes HR-ratio (52) over a conservatively-low VDOT (43)', () => {
    const e = runningVo2max({ vdot: 43, hrMax: 185, hrRest: 55 })
    expect(e!.value).toBeGreaterThan(50)
    expect(e!.source).toMatch(/HR/)
    expect(e!.confidence).toBe('medium')
  })
  it('takes VDOT when it is higher', () => {
    const e = runningVo2max({ vdot: 58, hrMax: 185, hrRest: 60 })
    expect(e!.value).toBe(58)
    expect(e!.source).toMatch(/pace/)
  })
  it('HR-ratio only → low confidence', () => {
    expect(runningVo2max({ hrMax: 185, hrRest: 55 })!.confidence).toBe('low')
  })
  it('null with nothing', () => expect(runningVo2max({})).toBeNull())
})

describe('cyclingVo2max — Coggan then HR-ratio×0.95', () => {
  it('Coggan from eFTP÷weight', () => {
    expect(cyclingVo2max({ ftp: 260, weightKg: 76 })!.value).toBeCloseTo(10.8 * 260 / 76 + 7, 1)
  })
  it('HR-ratio fallback reads a touch lower than running', () => {
    const run = runningVo2max({ hrMax: 185, hrRest: 55 })!.value
    const cyc = cyclingVo2max({ hrMax: 185, hrRest: 55 })!.value
    expect(cyc).toBeLessThan(run)
  })
})

describe('headlineVo2max', () => {
  it('manual wins (high)', () => {
    const h = headlineVo2max(52, [{ sport: 'running', est: { value: 43, source: 'x', confidence: 'medium' } }])
    expect(h!.value).toBe(52); expect(h!.confidence).toBe('high')
  })
  it('else best estimate by confidence then value', () => {
    const h = headlineVo2max(null, [
      { sport: 'cycling', est: { value: 60, source: 'x', confidence: 'low' } },
      { sport: 'running', est: { value: 52, source: 'y', confidence: 'medium' } },
    ])
    expect(h!.sport).toBe('running') // medium beats low even though cycling value higher
  })
  it('null when nothing', () => expect(headlineVo2max(null, [{ sport: 'running', est: null }])).toBeNull())
})

describe('confLabel', () => {
  it('maps confidence to words', () => {
    expect(confLabel('high')).toBe('measured')
    expect(confLabel('medium')).toBe('estimated')
    expect(confLabel('low')).toBe('rough estimate')
  })
})
