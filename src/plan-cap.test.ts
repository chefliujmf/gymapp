import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { planCapViolation } from '../server/plan-cap.js'

// #371/#454/#5014 — the coach must respect maxPerDay + the weekly training-days cap, on CREATE *and* MOVE.
describe('planCapViolation', () => {
  const info = { maxPerDay: 1, trainingDays: 6 }
  const oneRide = [{ id: 'a', date: '2026-07-11', sport: 'ride', title: 'Sweet-Spot 3×15' }]

  it('allows the first session on a FREE day', () => {
    expect(planCapViolation(oneRide, { id: 'b', date: '2026-07-12', sport: 'run' }, info)).toBeNull()
  })
  it('REJECTS a 2nd (different-sport) session on a full day', () => {
    const r = planCapViolation(oneRide, { id: 'b', date: '2026-07-11', sport: 'run' }, info)
    expect(r?.status).toBe(409)
    expect(r?.body.error).toMatch(/already has 1 session/)
  })
  it('a same-day UPDATE of the SAME plan is fine (excludes self, not a stack)', () => {
    expect(planCapViolation(oneRide, { id: 'a', date: '2026-07-11', sport: 'ride' }, info)).toBeNull()
  })
  it('#5014 GAP — a coach MOVE of a session ONTO a full day is REJECTED', () => {
    const two = [...oneRide, { id: 'b', date: '2026-07-12', sport: 'run', title: 'Easy run' }]
    // move plan "b" from Jul 12 onto Jul 11 (which already has the ride) → must be blocked
    const r = planCapViolation(two, { id: 'b', date: '2026-07-11', sport: 'run' }, info)
    expect(r?.status).toBe(409)
  })
  it('a MOVE onto a FREE day is allowed', () => {
    const two = [...oneRide, { id: 'b', date: '2026-07-12', sport: 'run', title: 'Easy run' }]
    expect(planCapViolation(two, { id: 'b', date: '2026-07-13', sport: 'run' }, info)).toBeNull()
  })
  it('maxPerDay 2 allows a second session', () => {
    expect(planCapViolation(oneRide, { id: 'b', date: '2026-07-11', sport: 'run' }, { maxPerDay: 2 })).toBeNull()
  })
  it('unset maxPerDay defaults to 1', () => {
    expect(planCapViolation(oneRide, { id: 'b', date: '2026-07-11', sport: 'run' }, {})?.status).toBe(409)
  })

  // weekly training-days HARD cap (Mon–Sun). 2026-07-06 is a Monday.
  it('rejects a session on a NEW day once the week is at the training-days cap', () => {
    const week = [
      { id: 'm', date: '2026-07-06', sport: 'ride' }, // Mon
      { id: 't', date: '2026-07-08', sport: 'run' },  // Wed
      { id: 'f', date: '2026-07-10', sport: 'ride' }, // Fri
    ]
    const r = planCapViolation(week, { id: 'x', date: '2026-07-11', sport: 'run' }, { maxPerDay: 1, trainingDays: 3 })
    expect(r?.status).toBe(409)
    expect(r?.body.error).toMatch(/weekly cap/)
  })
  it('allows adding onto a day that is ALREADY a training day (no new day)', () => {
    const week = [{ id: 'm', date: '2026-07-06', sport: 'ride' }, { id: 't', date: '2026-07-08', sport: 'run' }]
    // same day already trains → maxPerDay 2 lets it through, weekly cap not exceeded (still 2 days)
    expect(planCapViolation(week, { id: 'x', date: '2026-07-08', sport: 'ride' }, { maxPerDay: 2, trainingDays: 2 })).toBeNull()
  })
})
