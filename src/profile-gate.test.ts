import { describe, it, expect } from 'vitest'
// @ts-expect-error — JS server module
import { requiredProfileGaps, profileComplete } from '../server/profile-gate.js'

// #A (audit #743/#748) — plan generation is gated on the 5 minimal non-sensitive basics ONLY.
const full = { sex: 'female', info: { dob: '1992-08-16', mainSport: 'run', goals: { focus: 'race' }, trainingDays: 4 } }

describe('requiredProfileGaps (#A)', () => {
  it('a complete profile has no gaps', () => {
    expect(requiredProfileGaps(full)).toEqual([])
    expect(profileComplete(full)).toBe(true)
  })
  it('flags every missing basic', () => {
    expect(requiredProfileGaps({}).sort()).toEqual(['dob', 'goal', 'mainSport', 'sex', 'trainingDays'])
  })
  it('a goal can come from goals.notes OR the coachProfile', () => {
    expect(requiredProfileGaps({ ...full, info: { ...full.info, goals: { focus: '', notes: 'get back into running' } } })).toEqual([])
    expect(requiredProfileGaps({ ...full, info: { ...full.info, goals: {} }, coachProfile: 'Masters cyclist, wants to hold power' })).toEqual([])
    expect(requiredProfileGaps({ ...full, info: { ...full.info, goals: { focus: '', notes: '' } }, coachProfile: '' })).toEqual(['goal'])
  })
  it('main sport is satisfied by mainSport OR a sports list', () => {
    expect(requiredProfileGaps({ ...full, info: { ...full.info, mainSport: '' }, sports: ['cycling'] })).toEqual([])
    expect(requiredProfileGaps({ ...full, info: { ...full.info, mainSport: '' }, sports: [] })).toEqual(['mainSport'])
  })
  it('training-days must be a positive number', () => {
    expect(requiredProfileGaps({ ...full, info: { ...full.info, trainingDays: 0 } })).toEqual(['trainingDays'])
  })
  it('#759 — PREGNANT is NEVER blocked on a date (consent): pregnancy adds NO gap', () => {
    // A private/medical field must not hard-block the app. A pregnant user with no date is complete → she gets the safe
    // envelope by default; the trimester/date is an optional fine-tune in Profile, not a gate.
    expect(requiredProfileGaps({ ...full, info: { ...full.info, pregnant: true } })).toEqual([])
    expect(profileComplete({ ...full, info: { ...full.info, pregnant: true } })).toBe(true)
    // and it still only flags the real missing basics for a pregnant user
    expect(requiredProfileGaps({ sex: 'female', info: { pregnant: true, dob: '', mainSport: '', goals: {}, trainingDays: 0 } }).sort()).toEqual(['dob', 'goal', 'mainSport', 'trainingDays'])
  })
})
