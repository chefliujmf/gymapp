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

  it('POSTPARTUM: a graded return, NOT a snap back to a build (#631)', () => {
    const early = weekShape({ postpartumWeeks: 3, goalFocus: ['performance'], goalNotes: 'get my fitness back fast', trainingDays: 4 })
    expect(early.loadBand).toBe('maintenance')
    expect(early.qualityDays).toBe(0) // first ~6 weeks: no structured quality even on an ambitious goal
    expect(HARD).not.toContain(early.intensityCeiling)
    const mid = weekShape({ postpartumWeeks: 8, goalFocus: ['performance'], goalNotes: 'race', trainingDays: 5 })
    expect(mid.qualityDays).toBe(1) // weeks 6–12: one quality day back
    expect(mid.intensityCeiling).not.toBe('vo2')
    // past 12 weeks, symptom-free → normal build resumes
    expect(weekShape({ postpartumWeeks: 20, goalFocus: ['performance'], goalNotes: 'race', trainingDays: 5 }).qualityDays).toBe(2)
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

  it('does NOT bucket by fitness — CTL never changes the week SHAPE (intensity is % of THEIR threshold, volume scales elsewhere)', () => {
    // JM 2026-07-20: forget "beginner vs advanced". A low-fitness athlete just has lower absolute numbers; the shape
    // (quality-day count + relative ceiling) is goal-driven and identical — the plan works to improve their numbers.
    const low = weekShape({ goalFocus: ['performance'], goalNotes: 'get faster and race', ctl: 12, trainingDays: 5 })
    const high = weekShape({ goalFocus: ['performance'], goalNotes: 'get faster and race', ctl: 70, trainingDays: 5 })
    expect(low.qualityDays).toBe(high.qualityDays)
    expect(low.intensityCeiling).toBe(high.intensityCeiling)
    expect(high.qualityDays).toBe(2) // a build goal is 2 quality regardless of fitness level
  })

  it('MASTERS (55+) build: ease the very top end (no VO2 ceiling)', () => {
    const s = weekShape({ goalFocus: ['performance'], goalNotes: 'race', ctl: 60, ageYears: 60, trainingDays: 6 })
    expect(s.loadBand).toBe('build')
    expect(s.intensityCeiling).not.toBe('vo2')
  })

  it('CYCLING FEMALE, non-pregnant, fresh follicular phase → normal build (not eased)', () => {
    const s = weekShape({ goalFocus: ['performance'], goalNotes: 'race', ctl: 60, trainingDays: 6, cyclePhase: 'follicular', cycleFresh: true })
    expect(s.qualityDays).toBe(2) // follicular is a GO phase — not down-weighted like luteal/PMS
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

// @ts-expect-error — plain JS server module, no types
import { CEILING_PCT } from '../server/week-shape.js'
describe('#615 CEILING_PCT enforces the dose', () => {
  it('is monotonic low→high', () => {
    const order = ['recovery','endurance','tempo','sweetspot','threshold','vo2']
    for (let i=1;i<order.length;i++) expect(CEILING_PCT[order[i]]).toBeGreaterThan(CEILING_PCT[order[i-1]])
  })
  it('a pregnancy ceiling (tempo) is BELOW sweet-spot/threshold — so those get clamped', () => {
    const preg = weekShape({ pregnant: true, trimester: 1 })
    expect(CEILING_PCT[preg.intensityCeiling]).toBeLessThan(CEILING_PCT.sweetspot)
    expect(CEILING_PCT[preg.intensityCeiling]).toBeLessThan(CEILING_PCT.threshold)
  })
})

describe('#710 explicit beginner/new-athlete → ramp-in shape (not an inferred data-gate)', () => {
  it('an athlete who says they are new gets a conservative shape even with an ambitious goal', () => {
    const s = weekShape({ goalNotes: "I'm a beginner, new to running, want to get faster eventually", trainingDays: 4 })
    expect(s.loadBand).toBe('flat')
    expect(s.qualityDays).toBeLessThanOrEqual(1)
    expect(s.intensityCeiling).toBe('tempo') // below sweet-spot/vo2
  })
  it('a stated performance goal with NO beginner language stays a build', () => {
    const s = weekShape({ goalNotes: 'raise my FTP and race a crit', trainingDays: 5 })
    expect(s.loadBand).toBe('build')
    expect(s.qualityDays).toBe(2)
  })
  it('"getting back into cycling after a while" ramps in', () => {
    const s = weekShape({ goalNotes: 'getting back into cycling after a while off', trainingDays: 3 })
    expect(s.loadBand).toBe('flat')
    expect(s.intensityCeiling).toBe('tempo')
  })
})

describe('#719 menstrual-cycle bias — only ease late-luteal/PMS, not the menstrual phase', () => {
  it('MENSTRUAL phase keeps the quality day (low-hormone window is a green light, not a de-load)', () => {
    const s = weekShape({ cyclePhase: 'menstrual', cycleFresh: true, goalNotes: 'raise my ftp', trainingDays: 5 })
    expect(s.qualityDays).toBe(2)
  })
  it('LATE-LUTEAL / PMS eases the top end (one fewer quality day)', () => {
    expect(weekShape({ cyclePhase: 'late_luteal', cycleFresh: true, goalNotes: 'raise ftp', trainingDays: 5 }).qualityDays).toBe(1)
    expect(weekShape({ cyclePhase: 'pms', cycleFresh: true, goalNotes: 'raise ftp', trainingDays: 5 }).qualityDays).toBe(1)
  })
  it('a STALE phase (not fresh) does not bias the shape', () => {
    expect(weekShape({ cyclePhase: 'late_luteal', cycleFresh: false, goalNotes: 'raise ftp', trainingDays: 5 }).qualityDays).toBe(2)
  })
})
