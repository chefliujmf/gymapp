import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS build script module
import { deriveExerciseType } from '../scripts/derive-exercise-type.mjs'

const d = (name: string, extra: Record<string, unknown> = {}) => deriveExerciseType({ name, ...extra })

describe('#664 deriveExerciseType — machine-readable type so the coach/player/guard derive, not guess', () => {
  it('mobility / holds / dynamic warm-ups → timed (with a default duration)', () => {
    expect(d('Plank Saw').timed).toBe(true)
    expect(d('Standing quad stretch').timed).toBe(true)
    expect(d('Leg swings').timed).toBe(true)
    expect(d('Forward arm circles').timed).toBe(true)
    expect(d('Cat cow').timed).toBe(true)
    expect(d('Farmer Carry').timed).toBe(true)
    expect(d('Plank Saw').seconds).toBeGreaterThan(0)
  })
  it('strength lifts are NOT timed — incl. the trap "Kettlebell Swing" (a rep hinge, not a hold)', () => {
    expect(d('Kettlebell Swing', { equipment: 'Kettlebell' }).timed).toBeUndefined()
    expect(d('Barbell Back Squat', { equipment: 'Barbell' }).timed).toBeUndefined()
    expect(d('Dumbbell Bench Press', { equipment: 'Dumbbell' }).timed).toBeUndefined()
  })
  it('unilateral moves → eachSide', () => {
    expect(d('Dumbbell Single Arm Row').eachSide).toBe(true)
    expect(d('Bulgarian Split Squat').eachSide).toBe(true)
    expect(d('Walking Lunge').eachSide).toBe(true)
    expect(d('Leg swings').eachSide).toBe(true)
    expect(d('90-90 hip stretch (left)').eachSide).toBe(true)
    expect(d('Barbell Back Squat').eachSide).toBeUndefined() // bilateral
  })
  it('loaded moves → loaded, incl. Bodyweight-mis-tagged goblet/sandbag (the #639 class)', () => {
    expect(d('Goblet squat + step-out', { equipment: 'Bodyweight' }).loaded).toBe(true)
    expect(d('Sled Push', { equipment: 'Bodyweight' }).loaded).toBe(true)
    expect(d('Dumbbell Curl', { equipment: 'Dumbbell' }).loaded).toBe(true)
    expect(d('Push-Up', { equipment: 'Bodyweight' }).loaded).toBeUndefined() // genuine bodyweight
  })
})
