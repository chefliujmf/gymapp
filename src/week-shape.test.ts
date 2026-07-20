import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { weekShape, CEILINGS } from '../server/week-shape.js'

const HARD = ['sweetspot', 'threshold', 'vo2']

describe('weekShape — #613 the code-decided week structure (single source of truth)', () => {
  it('PREGNANT: zero structured quality, at most one moderate, maintenance band', () => {
    const s = weekShape({ pregnant: true, trimester: 1, trainingDays: 4 })
    expect(s.loadBand).toBe('maintenance')
    expect(s.qualityDays).toBe(0) // never a structured sweet-spot/threshold/vo2 day
    expect(s.moderateDays).toBeLessThanOrEqual(1)
    expect(HARD).not.toContain(s.intensityCeiling) // ceiling is tempo/endurance, never hard
  })

  it('PREGNANT unknown trimester → first-trimester defaults (tempo ceiling, one moderate)', () => {
    const s = weekShape({ pregnant: true, trimester: null })
    expect(s.qualityDays).toBe(0)
    expect(s.moderateDays).toBe(1)
    expect(s.intensityCeiling).toBe('tempo')
  })

  it('PREGNANT 3rd trimester self-tapers to easy (zero moderate, endurance ceiling)', () => {
    const s = weekShape({ pregnant: true, trimester: 3 })
    expect(s.moderateDays).toBe(0)
    expect(s.intensityCeiling).toBe('endurance')
  })

  it('BUILD goal (wants faster/FTP) → 2 quality days, build band', () => {
    const s = weekShape({ goalFocus: ['performance'], goalNotes: 'raise my FTP and get faster', ctl: 60, trainingDays: 5 })
    expect(s.loadBand).toBe('build')
    expect(s.qualityDays).toBe(2)
  })

  it('CONSISTENCY goal (stay fit, tone) → 1 quality day, flat band', () => {
    const s = weekShape({ goalFocus: ['consistency', 'tone'], goalNotes: 'stay fit and consistent, not bulk up', trainingDays: 4 })
    expect(s.loadBand).toBe('flat')
    expect(s.qualityDays).toBe(1)
  })

  it('TEEN: capped to ≤1 quality, no VO2 (technique-first)', () => {
    const s = weekShape({ goalFocus: ['performance'], goalNotes: 'get faster', ageYears: 15, trainingDays: 5 })
    expect(s.qualityDays).toBeLessThanOrEqual(1)
    expect(s.intensityCeiling).not.toBe('vo2')
  })

  it('weekly training-days cap limits quality days', () => {
    const s = weekShape({ goalFocus: ['performance'], goalNotes: 'race', trainingDays: 2 })
    expect(s.qualityDays).toBeLessThanOrEqual(1) // trainingDays 2 → at most 1 quality (leave an easy day)
  })

  it('late-luteal / PMS eases the top end', () => {
    const build = weekShape({ goalFocus: ['performance'], goalNotes: 'race', trainingDays: 6 })
    const luteal = weekShape({ goalFocus: ['performance'], goalNotes: 'race', trainingDays: 6, cyclePhase: 'late-luteal', cycleFresh: true })
    expect(luteal.qualityDays).toBeLessThan(build.qualityDays)
  })

  it('every ceiling is a known zone', () => {
    for (const p of [{ pregnant: true }, { goalNotes: 'race' }, { goalNotes: 'stay fit' }, { ageYears: 14 }]) {
      expect(CEILINGS).toContain(weekShape(p).intensityCeiling)
    }
  })
})
