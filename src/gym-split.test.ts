import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module
import { assignWeeklyGym, patternFromExercise, GYM_PATTERNS, resolveGymFocus, repSchemeFor, gymBalanceLines } from '../server/gym-split.js'

const flat = (a: any) => a.days.flat()

describe('#636/#637 gym-split — frequency + focus aware balance, arms guaranteed', () => {
  it('1×/week endurance SUPPORT (cyclist) → FULL-BODY: the one session covers everything incl. arms', () => {
    const a = assignWeeklyGym({ sessionsPerWeek: 1, focus: 'support' })
    expect(a.splitName).toMatch(/full-body/i)
    expect(a.days.length).toBe(1)
    for (const p of ['squat', 'hinge', 'hpush', 'hpull', 'arms', 'carry']) expect(a.days[0]).toContain(p)
  })

  it('4×/week HYPERTROPHY (bodybuilder) → a SPLIT (not full-body every day), each muscle ~2×/week', () => {
    const a = assignWeeklyGym({ sessionsPerWeek: 4, focus: 'muscle' })
    expect(a.splitName).toMatch(/upper|push|pull|legs/i)
    expect(a.days.length).toBe(4)
    // not every session is the full pattern list (that would be full-body)
    expect(a.days.some((d: string[]) => d.length < GYM_PATTERNS.length)).toBe(true)
    // arms hit at least twice across the week (upper/push/pull days)
    expect(flat(a).filter((p: string) => p === 'arms').length).toBeGreaterThanOrEqual(2)
    // squat/chest hit ~2× (not once)
    expect(flat(a).filter((p: string) => p === 'squat').length).toBeGreaterThanOrEqual(2)
  })

  it('5×/week hypertrophy → PPL split', () => {
    expect(assignWeeklyGym({ sessionsPerWeek: 5, focus: 'bodybuilding' }).splitName).toMatch(/push.*pull.*legs/i)
  })

  it('ARMS are never dropped — present in every full-body / upper / push / pull day', () => {
    for (const spw of [1, 2, 3, 4, 5]) {
      const a = assignWeeklyGym({ sessionsPerWeek: spw, focus: 'muscle' })
      expect(flat(a)).toContain('arms')
    }
  })

  it('rotates each accessory to a FRESH option (skips recent — anti-boredom)', () => {
    const a = assignWeeklyGym({ sessionsPerWeek: 1, recentExercises: ['Dumbbell Row', 'Goblet Squat', 'Dumbbell Biceps Curl'] })
    expect(a.rotations.hpull.toLowerCase()).not.toBe('dumbbell row')
    expect(a.rotations.squat.toLowerCase()).not.toBe('goblet squat')
    expect(a.rotations.arms.toLowerCase()).not.toBe('dumbbell biceps curl')
  })

  it('patternFromExercise fingerprints exercises → patterns (incl. arms)', () => {
    expect(patternFromExercise('Dumbbell Biceps Curl')).toBe('arms')
    expect(patternFromExercise('Triceps Pushdown')).toBe('arms')
    expect(patternFromExercise('Romanian Deadlift')).toBe('hinge')
    expect(patternFromExercise('Seated Dumbbell Shoulder Press')).toBe('vpush')
    expect(patternFromExercise('Dumbbell Row')).toBe('hpull')
    expect(patternFromExercise('Pull-Up')).toBe('vpull')
    expect(patternFromExercise('Goblet Squat')).toBe('squat')
    expect(patternFromExercise('Farmer Carry')).toBe('carry')
    expect(patternFromExercise('Plank')).toBe('core')
  })

  it('GYM_PATTERNS has all 9 movement patterns', () => { expect(GYM_PATTERNS.length).toBe(9) })
})

describe('#648 rep scheme by focus — a cyclist gets HEAVY LOW-rep, not 3×10', () => {
  it('resolveGymFocus: endurance MAIN sport → support (never a hypertrophy default)', () => {
    expect(resolveGymFocus({ mainSport: 'cycling', goal: 'raise my FTP' })).toBe('support')
    expect(resolveGymFocus({ mainSport: 'running' })).toBe('support')
  })
  it('resolveGymFocus: endurance + muscle intent → support_build; gym-first → muscle/strength', () => {
    expect(resolveGymFocus({ mainSport: 'cycling', goal: 'build some lean muscle' })).toBe('support_build')
    expect(resolveGymFocus({ mainSport: 'gym', goal: 'get bigger' })).toBe('muscle')
    expect(resolveGymFocus({ mainSport: 'powerlifting', goal: 'increase my 1RM squat' })).toBe('strength')
  })
  it('a cyclist (support) prescribes PRIMARY lifts at 3-6 heavy reps, NOT 6-12', () => {
    const rs = repSchemeFor('support')
    expect(rs.mains).toBe('3-6')
    expect(rs.pctHigh).toBeGreaterThanOrEqual(85)          // heavy
    expect(rs.tempo).toBe('3-0-1-0')                        // fast/explosive concentric, not slow-eccentric
    expect(rs.intent.toLowerCase()).toMatch(/not.*failure|reps in reserve|force|economy/)
  })
  it('a bodybuilder (muscle) prescribes 6-12 with a slower eccentric', () => {
    const rs = repSchemeFor('muscle')
    expect(rs.mains).toBe('6-12')
    expect(rs.tempo).toBe('3-1-1-0')
  })
  it('assignWeeklyGym carries the focus + repScheme, and gymBalanceLines renders it', () => {
    const a = assignWeeklyGym({ sessionsPerWeek: 1, focus: resolveGymFocus({ mainSport: 'cycling' }) })
    expect(a.focus).toBe('support')
    expect(a.repScheme.mains).toBe('3-6')
    const lines = gymBalanceLines(a)
    expect(lines).toMatch(/REP SCHEME/)
    expect(lines).toMatch(/3-6 reps/)
    expect(lines).not.toMatch(/default everything to 8-12(?!)/) // it must TELL the coach not to default to 8-12
  })
})
