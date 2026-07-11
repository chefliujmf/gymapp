import { describe, it, expect } from 'vitest'
import { findGymLogForPlan } from './plan'

// #326 — a COMPLETED gym session must open its RESULT (summary), never the "▶ Start workout"
// player. The card badges "✓ Completed" by title+day; the detail/summary must resolve the log the
// SAME way, else a done card lands back on the plan. These lock the shared matcher.

type Log = { workoutId: string; title?: string; date: string; completedAt?: number }
const plan = { id: 'abc123', title: 'Full-Body Strength', date: '2026-06-22' }

describe('findGymLogForPlan', () => {
  it('matches a log logged under plan-<id> (the normal path)', () => {
    const logs: Log[] = [{ workoutId: 'plan-abc123', title: 'Full-Body Strength', date: '2026-06-22', completedAt: 10 }]
    expect(findGymLogForPlan(plan, logs)?.workoutId).toBe('plan-abc123')
  })

  it('matches a log logged under the bare plan id', () => {
    const logs: Log[] = [{ workoutId: 'abc123', title: 'Full-Body Strength', date: '2026-06-22', completedAt: 10 }]
    expect(findGymLogForPlan(plan, logs)?.workoutId).toBe('abc123')
  })

  it('falls back to same title on the same day when the workoutId differs (template/catalog/ad-hoc)', () => {
    // This is the #326 regression: card said "Completed" (title+day) but the detail redirect missed.
    const logs: Log[] = [{ workoutId: 't-99', title: 'full-body strength', date: '2026-06-22', completedAt: 10 }]
    expect(findGymLogForPlan(plan, logs)?.workoutId).toBe('t-99')
  })

  it('does NOT match a same-title log on a different day', () => {
    const logs: Log[] = [{ workoutId: 't-99', title: 'Full-Body Strength', date: '2026-06-21', completedAt: 10 }]
    expect(findGymLogForPlan(plan, logs)).toBeNull()
  })

  it('resolves a plan-id match even if logged a day late (date-agnostic for the exact id)', () => {
    const logs: Log[] = [{ workoutId: 'plan-abc123', title: 'Full-Body Strength', date: '2026-06-23', completedAt: 10 }]
    expect(findGymLogForPlan(plan, logs)?.workoutId).toBe('plan-abc123')
  })

  it('returns null when nothing matches', () => {
    const logs: Log[] = [{ workoutId: 'plan-other', title: 'Leg Day', date: '2026-06-22', completedAt: 10 }]
    expect(findGymLogForPlan(plan, logs)).toBeNull()
  })

  it('prefers the exact plan-id match over a title fallback', () => {
    const logs: Log[] = [
      { workoutId: 't-99', title: 'Full-Body Strength', date: '2026-06-22', completedAt: 5 },
      { workoutId: 'plan-abc123', title: 'Full-Body Strength', date: '2026-06-22', completedAt: 1 },
    ]
    expect(findGymLogForPlan(plan, logs)?.workoutId).toBe('plan-abc123')
  })

  it('returns the most recent when several logs share the match', () => {
    const logs: Log[] = [
      { workoutId: 'plan-abc123', title: 'Full-Body Strength', date: '2026-06-22', completedAt: 5 },
      { workoutId: 'plan-abc123', title: 'Full-Body Strength', date: '2026-06-22', completedAt: 20 },
    ]
    expect(findGymLogForPlan(plan, logs)?.completedAt).toBe(20)
  })
})
