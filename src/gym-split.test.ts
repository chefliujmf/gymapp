import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module
import { assignWeeklyGym, patternFromExercise, GYM_PATTERNS } from '../server/gym-split.js'

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
