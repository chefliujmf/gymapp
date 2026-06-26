import { describe, it, expect } from 'vitest'
import { ICU_FIELDS, ICU_FIELD_CODES, GYM_FIELDS, FIELDS } from './pages/PostWorkout'

// #147 — post-workout feedback fields must MATCH the athlete's intervals.icu custom
// ACTIVITY_FIELDs exactly (fetched 2026-06-26 from /athlete/{id}/custom-item). This test
// locks the contract so we can never regress to the old short lists (e.g. Legs After =
// [fresh, tired OK, cooked]) or drop the fields JM reported missing.

const byLabel = Object.fromEntries(ICU_FIELDS)

describe('post-workout feedback matches intervals custom fields (#147)', () => {
  it('has exactly the six intervals ACTIVITY_FIELDs, in order', () => {
    expect(ICU_FIELDS.map(([label]) => label)).toEqual([
      'Legs Before', 'Legs After', 'Fuel/GI', 'Pain/Niggles', 'Life Constraint', 'Mental State',
    ])
  })

  it('includes the two fields JM reported MISSING', () => {
    expect(byLabel['Life Constraint']).toBeDefined()
    expect(byLabel['Mental State']).toBeDefined()
  })

  it('Legs After has the full intervals option list (the reported bug)', () => {
    // was [fresh, tired OK, cooked]; intervals has 7 incl. strong / barely tired / sore.
    expect(byLabel['Legs After']).toEqual([
      'strong', 'normal', 'tired OK', 'barely tired', 'heavy', 'sore', 'cooked',
    ])
  })

  it('every option set matches the intervals defs exactly', () => {
    expect(byLabel['Legs Before']).toEqual(['fresh', 'normal', 'relaxed', 'heavy', 'sore', 'flat', 'tired'])
    expect(byLabel['Fuel/GI']).toEqual(['not needed', 'water only OK', 'carbs OK', 'underfueled', 'GI issue', 'too much fuel'])
    expect(byLabel['Pain/Niggles']).toEqual(['none', 'knee', 'back', 'neck/shoulder', 'foot', 'saddle', 'other'])
    expect(byLabel['Life Constraint']).toEqual(['none', 'time cap', 'family', 'work', 'poor sleep', 'stress', 'weather', 'other'])
    expect(byLabel['Mental State']).toEqual(['calm', 'focused', 'impatient', 'overexcited', 'doubtful', 'frustrated', 'checked out'])
  })

  it('every label maps to its intervals field code (for future write-back)', () => {
    for (const [label] of ICU_FIELDS) expect(ICU_FIELD_CODES[label]).toBeTruthy()
    expect(ICU_FIELD_CODES['Legs After']).toBe('LegsAfter')
  })

  it('ride + run use the intervals set; GYM is its own (#152)', () => {
    expect(FIELDS.ride).toBe(ICU_FIELDS)
    expect(FIELDS.run).toBe(ICU_FIELDS)
    expect(FIELDS.gym).toBe(GYM_FIELDS)
    expect(FIELDS.gym).not.toBe(ICU_FIELDS)
  })

  it('gym has its OWN gym-specific fields, not cycling Legs/Fuel (#152)', () => {
    const gymLabels = GYM_FIELDS.map(([l]) => l)
    expect(gymLabels).toContain('Soreness/pump')
    expect(gymLabels).toContain('Form')
    expect(gymLabels).not.toContain('Legs After')
    expect(gymLabels).not.toContain('Fuel/GI')
  })
})
