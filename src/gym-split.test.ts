import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module
import { assignWeeklyGym, patternFromExercise, GYM_PATTERNS } from '../server/gym-split.js'

describe('#636 gym-split — muscle-group balance + accessory rotation', () => {
  it('ALWAYS covers arms + carry (the gap JM + wife caught) — full pattern coverage every week', () => {
    const a = assignWeeklyGym({ focus: 'support' })
    expect(a.mustCover).toContain('arms')
    expect(a.mustCover).toContain('carry')
    for (const p of ['squat', 'hinge', 'hpush', 'vpush', 'hpull', 'vpull', 'core', 'arms', 'carry']) expect(a.mustCover).toContain(p)
  })

  it('rotates each accessory to a FRESH option (skips what was done recently — anti-boredom)', () => {
    const recent = ['Dumbbell Row', 'Goblet Squat', 'Dumbbell Biceps Curl']
    const a = assignWeeklyGym({ focus: 'hypertrophy', recentExercises: recent })
    expect(a.rotations.hpull.toLowerCase()).not.toBe('dumbbell row')
    expect(a.rotations.squat.toLowerCase()).not.toBe('goblet squat')
    expect(a.rotations.arms.toLowerCase()).not.toBe('dumbbell biceps curl') // arms rotate too
  })

  it('assigns a real arm exercise for the arms slot', () => {
    const a = assignWeeklyGym({})
    expect(/curl|tricep|pushdown|skull/i.test(a.rotations.arms)).toBe(true)
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

  it('GYM_PATTERNS has all 9 movement patterns', () => {
    expect(GYM_PATTERNS.length).toBe(9)
  })
})
