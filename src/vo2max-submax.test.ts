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

describe('runningVo2max — VDOT (pace) is trusted, HR-ratio never inflates it (#327)', () => {
  it('uses VDOT from pace, NOT the higher HR-ratio (was the "52 for a 6:45/km runner" bug)', () => {
    const e = runningVo2max({ vdot: 43, hrMax: 185, hrRest: 55 }) // HR-ratio ≈ 51
    expect(e!.value).toBe(43)
    expect(e!.source).toMatch(/pace/)
  })
  it('big VDOT↔HR divergence (assumed/stale HRmax) → low confidence, still VDOT value', () => {
    const e = runningVo2max({ vdot: 43, hrMax: 190, hrRest: 55 }) // HR-ratio ≈ 53, diverges >6
    expect(e!.value).toBe(43)
    expect(e!.confidence).toBe('low')
  })
  it('agreeing VDOT + HR → medium confidence', () => {
    expect(runningVo2max({ vdot: 50, hrMax: 185, hrRest: 58 })!.confidence).toBe('medium')
  })
  it('HR-ratio only (no pace) → low confidence fallback', () => {
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
