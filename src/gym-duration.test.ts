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

  // #696 — heavy low-rep strength needs LONG rest; when rest isn't given, default by rep count so a real strength
  // session doesn't get undercounted (JM saw 42 min for a ~55-min session because rest defaulted to a flat 60s).
  it('heavy low-rep lifts (no explicit rest) estimate LONGER than hypertrophy — rest scales with load', () => {
    const heavy = estimateGymMinutes({ exercises: [{ name: 'Squat', sets: 3, reps: 5 }] })      // →150s rest default
    const hyper = estimateGymMinutes({ exercises: [{ name: 'Squat', sets: 3, reps: 12 }] })     // →90s rest default
    expect(heavy).toBeGreaterThan(hyper)
  })

  it('a realistic heavy-strength session (4 primaries @ 5 reps + accessories, no explicit rests) lands ~50–65 min', () => {
    const mins = estimateGymMinutes({ exercises: [
      { name: 'Warm-up A', mode: 'timed', seconds: 30 }, { name: 'Warm-up B', mode: 'timed', seconds: 30 },
      { name: 'Back Squat', sets: 3, reps: 5 }, { name: 'Romanian Deadlift', sets: 3, reps: 5 },
      { name: 'Bench Press', sets: 3, reps: 5 }, { name: 'Row', sets: 3, reps: 5 },
      { name: 'Biceps Curl', sets: 2, reps: 12 }, { name: 'Plank', mode: 'timed', seconds: 40, sets: 2 },
    ] })
    expect(mins).toBeGreaterThanOrEqual(48)
    expect(mins).toBeLessThanOrEqual(68)
  })

  it('timed mobility warm-ups are ONE round, not 3 (no rest over-count)', () => {
    const one = estimateGymMinutes({ exercises: [{ name: 'Cat-cow', mode: 'timed', seconds: 30 }] })
    expect(one).toBeLessThanOrEqual(6) // ~30s work + tiny transition + the 5-min buffer, NOT 3×(30+60)
  })
})
