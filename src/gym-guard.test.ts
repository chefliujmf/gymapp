import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS module shared with the MCP coach server
import { validateGymWorkout, isUnilateral, eachSideSatisfied } from '../mcp/gym-guard.js'

// A compliant session: warm-up + main + cool-down, unilateral move flagged eachSide.
const good = [
  { name: 'Arm circles', section: 'warmup', mode: 'timed', seconds: 30 },
  { name: 'Band pull-apart', section: 'warmup', sets: 2, reps: 15 },
  { name: 'Barbell Bench Press', section: 'main', sets: 4, reps: 8 },
  { name: 'Pallof Press', section: 'main', sets: 3, reps: 10, eachSide: true },
  { name: "Child's pose", section: 'cooldown', mode: 'timed', seconds: 60 },
]

describe('#168 gym workout guard', () => {
  it('accepts a compliant workout (warm-up + cool-down + unilateral both sides)', () => {
    expect(validateGymWorkout(good)).toBeNull()
  })

  it('rejects a workout with no warm-up', () => {
    const msg = validateGymWorkout(good.filter((x) => x.section !== 'warmup'))
    expect(msg).toMatch(/WARM-UP/)
  })

  it('rejects a workout with no cool-down', () => {
    const msg = validateGymWorkout(good.filter((x) => x.section !== 'cooldown'))
    expect(msg).toMatch(/COOL-DOWN/)
  })

  it('rejects an unmarked single-side move and names it', () => {
    const exs = good.map((x) => (x.name === 'Pallof Press' ? { ...x, eachSide: false } : x))
    const msg = validateGymWorkout(exs)
    expect(msg).toMatch(/Pallof Press/)
    expect(msg).toMatch(/both sides/i)
  })

  it('lists every issue at once so the coach fixes in one re-call', () => {
    const msg = validateGymWorkout([{ name: 'Bulgarian Split Squat', section: 'main', sets: 3, reps: 8 }])
    expect(msg).toMatch(/WARM-UP/)
    expect(msg).toMatch(/COOL-DOWN/)
    expect(msg).toMatch(/Bulgarian Split Squat/)
  })

  it('detects unilateral moves by name', () => {
    expect(isUnilateral('Pallof Press')).toBe(true)
    expect(isUnilateral('Single-Arm Dumbbell Row')).toBe(true)
    expect(isUnilateral('Bulgarian Split Squat')).toBe(true)
    expect(isUnilateral('Barbell Back Squat')).toBe(false)
    expect(isUnilateral('Bench Press')).toBe(false)
  })

  it('accepts per-side dose written in the text (not just the flag)', () => {
    expect(eachSideSatisfied({ name: 'Side Plank', reps: 30, tip: 'hold 30s each side' })).toBe(true)
    expect(eachSideSatisfied({ name: 'Suitcase Carry — left' })).toBe(true)
    expect(eachSideSatisfied({ name: 'Copenhagen Plank' })).toBe(false)
  })

  it('does not flag warm-up mobility that happens to read as single-side', () => {
    // a warm-up leg swing is per-side but we don't gate warm-up moves
    const exs = [
      { name: 'Single-leg glute bridge', section: 'warmup', sets: 1, reps: 10 },
      { name: 'Goblet Squat', section: 'main', sets: 3, reps: 10 },
      { name: 'Stretch', section: 'cooldown', mode: 'timed', seconds: 30 },
    ]
    expect(validateGymWorkout(exs)).toBeNull()
  })
})
