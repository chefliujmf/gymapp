import { describe, it, expect } from 'vitest'
// @ts-expect-error — JS server module
import { requiredProfileGaps, profileComplete } from '../server/profile-gate.js'

// #A (audit #743/#748) — plan generation is gated on a minimal mandatory profile; pregnancy makes the date mandatory too.
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
  it('PREGNANT → an EDD (dueDate) or LMP (pregnancyStart) is MANDATORY', () => {
    expect(requiredProfileGaps({ ...full, info: { ...full.info, pregnant: true } })).toEqual(['pregnancyDate'])
    expect(requiredProfileGaps({ ...full, info: { ...full.info, pregnant: true, dueDate: '2026-12-01' } })).toEqual([])
    expect(requiredProfileGaps({ ...full, info: { ...full.info, pregnant: true, pregnancyStart: '2026-03-01' } })).toEqual([])
  })
})
