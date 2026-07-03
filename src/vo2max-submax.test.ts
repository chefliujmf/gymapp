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

describe('cyclingVo2max — MAP (5-min power) preferred, FTP→MAP fallback (#337)', () => {
  it('5-min max power is the accurate MAP input (305 W / 76 kg ≈ 50, matches Coros)', () => {
    const e = cyclingVo2max({ map5min: 305, weightKg: 76 })!
    expect(e.value).toBeCloseTo(10.8 * 305 / 76 + 7, 1)
    expect(e.value).toBeGreaterThan(48)
    expect(e.source).toMatch(/5-min/)
    expect(e.confidence).toBe('medium')
  })
  it('FTP alone is scaled up to est. MAP (×1.22) so it does not read artificially low', () => {
    const ftpEst = cyclingVo2max({ ftp: 235, weightKg: 76 })!.value
    const rawFtp = 10.8 * 235 / 76 + 7 // the old, too-low number (~40)
    expect(ftpEst).toBeGreaterThan(rawFtp + 4)
  })
  it('HR-ratio fallback reads a touch lower than running', () => {
    const run = runningVo2max({ hrMax: 185, hrRest: 55 })!.value
    const cyc = cyclingVo2max({ hrMax: 185, hrRest: 55 })!.value
    expect(cyc).toBeLessThan(run)
  })
})

describe('runningVo2max thin-volume guard (#337)', () => {
  it('barely any runs (<4) → no running VO₂max at all', () => {
    expect(runningVo2max({ vdot: 45, runsRecent: 1 })).toBeNull()
  })
  it('enough runs → normal estimate', () => {
    expect(runningVo2max({ vdot: 45, runsRecent: 12 })!.value).toBe(45)
  })
})

describe('headlineVo2max', () => {
  it('manual wins (high)', () => {
    const h = headlineVo2max(52, [{ sport: 'running', est: { value: 43, source: 'x', confidence: 'medium' } }])
    expect(h!.value).toBe(52); expect(h!.confidence).toBe('high')
  })
  it('#327 — uses the PRIMARY sport (first in the caller-ordered list), not the biggest number', () => {
    // cyclist: cycling first → cycling wins even though running est is numerically higher
    const cyclist = headlineVo2max(null, [
      { sport: 'cycling', est: { value: 48, source: 'power', confidence: 'low' } },
      { sport: 'running', est: { value: 60, source: 'hr', confidence: 'medium' } },
    ])
    expect(cyclist!.sport).toBe('cycling'); expect(cyclist!.value).toBe(48)
    // runner: running first → running wins
    const runner = headlineVo2max(null, [
      { sport: 'running', est: { value: 45, source: 'vdot', confidence: 'medium' } },
      { sport: 'cycling', est: { value: 55, source: 'hr', confidence: 'low' } },
    ])
    expect(runner!.sport).toBe('running'); expect(runner!.value).toBe(45)
  })
  it('skips a sport with no estimate → next sport', () => {
    const h = headlineVo2max(null, [{ sport: 'cycling', est: null }, { sport: 'running', est: { value: 45, source: 'vdot', confidence: 'medium' } }])
    expect(h!.sport).toBe('running')
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
