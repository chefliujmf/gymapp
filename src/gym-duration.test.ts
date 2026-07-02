import { describe, it, expect } from 'vitest'
import { estimateGymMinutes } from './plan'

// #317 — gym plans must show a time estimate (they didn't). The estimator sums reps×tempo work +
// rest between sets + a small per-exercise + warm-up buffer.
describe('estimateGymMinutes (#317)', () => {
  it('empty plan → 0', () => expect(estimateGymMinutes({ exercises: [] })).toBe(0))

  it('a realistic 4-exercise session lands in a sane range (~25–55 min)', () => {
    const mins = estimateGymMinutes({ exercises: [
      { name: 'Squat', sets: 4, reps: 8, rest: 90, tempo: '3-1-1-0' },
      { name: 'Bench Press', sets: 3, reps: 10, rest: 75 },
      { name: 'Row', sets: 3, reps: 12, rest: 60, tempo: '2-0-1-0' },
      { name: 'Plank', sets: 3, mode: 'timed', seconds: 45, rest: 45 },
    ] })
    expect(mins).toBeGreaterThanOrEqual(25)
    expect(mins).toBeLessThanOrEqual(55)
  })

  it('more sets ⇒ longer', () => {
    const base = estimateGymMinutes({ exercises: [{ name: 'Squat', sets: 3, reps: 8, rest: 90 }] })
    const more = estimateGymMinutes({ exercises: [{ name: 'Squat', sets: 6, reps: 8, rest: 90 }] })
    expect(more).toBeGreaterThan(base)
  })

  it('rounds multiply the session', () => {
    const one = estimateGymMinutes({ exercises: [{ name: 'Squat', sets: 3, reps: 10, rest: 60 }], rounds: 1 })
    const three = estimateGymMinutes({ exercises: [{ name: 'Squat', sets: 3, reps: 10, rest: 60 }], rounds: 3 })
    expect(three).toBeGreaterThan(one)
  })

  it('missing fields fall back to sane defaults (never 0 for a non-empty plan)', () => {
    expect(estimateGymMinutes({ exercises: [{ name: 'Mystery move' }] })).toBeGreaterThan(0)
  })
})
