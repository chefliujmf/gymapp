import { describe, it, expect } from 'vitest'
import { vo2maxConfidence, ftpConfidence, thresholdPaceConfidence, maxHrConfidence, sleepNeedConfidence } from './benchmark-confidence'

// #374 — confidence bar model for the benchmark cards. Values mirror the approved mock.
describe('vo2maxConfidence', () => {
  it('high confidence → strong 95', () => {
    expect(vo2maxConfidence({ value: 51, confidence: 'high' })).toEqual({ pct: 95, cls: 'strong', label: 'Strong' })
  })
  it('medium → learn 68', () => {
    expect(vo2maxConfidence({ value: 51, confidence: 'medium' })).toEqual({ pct: 68, cls: 'learn', label: 'Good confidence' })
  })
  it('low → learn 45 rough', () => {
    expect(vo2maxConfidence({ value: 51, confidence: 'low' })).toEqual({ pct: 45, cls: 'learn', label: 'Rough estimate' })
  })
  it('pending (no value) → learn 35 with shortened gate', () => {
    const c = vo2maxConfidence({ value: null, gate: 'after your next hard ~5-min bike effort (a near-max 5 min) — that’s your MAP → VO₂max' })
    expect(c.pct).toBe(35)
    expect(c.cls).toBe('learn')
    expect(c.label).toBe('Learning · a hard 5-min effort')
  })
  it('pending run-gate → run wording', () => {
    expect(vo2maxConfidence({ value: null, gate: 'after ~4 runs so your pace VDOT is reliable' }).label).toBe('Learning · a few more runs')
  })
})

describe('ftpConfidence', () => {
  it('eFTP present, no set FTP → strong 90', () => expect(ftpConfidence({ eftp: 260 })).toEqual({ pct: 90, cls: 'strong', label: 'Strong' }))
  it('no eFTP → learn 30', () => expect(ftpConfidence({ eftp: null })).toEqual({ pct: 30, cls: 'learn', label: 'Learning · needs a hard ride' }))
  // #5007 — eFTP agrees with the set FTP (within 5%) → still strong.
  it('eFTP ≈ set FTP → strong 90', () => expect(ftpConfidence({ eftp: 258, manual: 260 })).toEqual({ pct: 90, cls: 'strong', label: 'Strong' }))
  // #5007 — the reported bug: eFTP 241 vs a proven 260 FTP (~7%) must NOT read "Strong".
  it('eFTP materially below set FTP → learn, not strong', () => expect(ftpConfidence({ eftp: 241, manual: 260 })).toEqual({ pct: 55, cls: 'learn', label: 'Differs from your set FTP' }))
  it('eFTP materially above set FTP → learn, not strong', () => expect(ftpConfidence({ eftp: 290, manual: 260 })).toEqual({ pct: 55, cls: 'learn', label: 'Differs from your set FTP' }))
  it('null set FTP falls back to strong', () => expect(ftpConfidence({ eftp: 241, manual: null })).toEqual({ pct: 90, cls: 'strong', label: 'Strong' }))
})

describe('thresholdPaceConfidence', () => {
  it('paceEst present → strong 88', () => expect(thresholdPaceConfidence({ paceEst: 297, runsRecent: 3 })).toEqual({ pct: 88, cls: 'strong', label: 'Strong' }))
  it('3/4 runs → learn 75', () => expect(thresholdPaceConfidence({ paceEst: null, runsRecent: 3 })).toEqual({ pct: 75, cls: 'learn', label: 'Learning · 3 / 4 runs' }))
  it('0 runs → clamped to 8', () => expect(thresholdPaceConfidence({ paceEst: null, runsRecent: 0 })).toEqual({ pct: 8, cls: 'learn', label: 'Learning · 0 / 4 runs' }))
  it('unknown run count → learn 25', () => expect(thresholdPaceConfidence({ paceEst: null, runsRecent: null })).toEqual({ pct: 25, cls: 'learn', label: 'Learning · needs runs' }))
})

describe('maxHrConfidence', () => {
  it('observed peak → strong 90', () => expect(maxHrConfidence({ computed: 185, from: 'observed' })).toEqual({ pct: 90, cls: 'strong', label: 'Observed peak' }))
  it('ceiling only → need 50', () => expect(maxHrConfidence({ computed: 185, from: 'icu' })).toEqual({ pct: 50, cls: 'need', label: 'Needs a max effort' }))
  it('nothing → need 40', () => expect(maxHrConfidence({ computed: null, from: '' })).toEqual({ pct: 40, cls: 'need', label: 'Needs a max effort' }))
})

describe('sleepNeedConfidence', () => {
  it('learned, no more needed → strong 90', () => expect(sleepNeedConfidence({ est: 9, needMore: null })).toEqual({ pct: 90, cls: 'strong', label: 'Dialed in' }))
  it('18/21 nights → learn ~86', () => {
    const c = sleepNeedConfidence({ est: 9, needMore: 3 })
    expect(c.cls).toBe('learn')
    expect(c.label).toBe('Learning · 18 / 21 nights')
    expect(c.pct).toBe(Math.round((18 / 21) * 100))
  })
  it('nothing yet → learn 20', () => expect(sleepNeedConfidence({ est: null, needMore: null })).toEqual({ pct: 20, cls: 'learn', label: 'Learning · 21 nights' }))
})
