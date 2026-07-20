import { describe, it, expect } from 'vitest'
import { e1rm, e1rmRpe, e1rmConfidence } from './strength'

// #497 — RPE-adjusted e1RM (gym analog of "estimate from the effort you actually gave"). Science: docs/e1rm.md.
describe('e1rmRpe', () => {
  it('no RPE → identical to the plain e1rm (backward compatible)', () => {
    expect(e1rmRpe(100, 5)).toBeCloseTo(e1rm(100, 5), 6)
    expect(e1rmRpe(100, 5, null)).toBeCloseTo(e1rm(100, 5), 6)
  })
  it('RPE 10 (to failure) → same as plain; RPE < 10 (reps in reserve) → HIGHER 1RM', () => {
    expect(e1rmRpe(100, 5, 10)).toBeCloseTo(e1rm(100, 5), 6)
    expect(e1rmRpe(100, 5, 8)).toBeGreaterThan(e1rm(100, 5)) // 2 in reserve ⇒ true 1RM is higher
    expect(e1rmRpe(100, 5, 8)).toBeGreaterThan(e1rmRpe(100, 5, 9)) // more reserve ⇒ higher
  })
  it('a single rep at RPE 8 implies more than 1 rep (RIR) → above the bar weight', () => {
    expect(e1rmRpe(100, 1, 10)).toBe(100) // a true 1RM
    expect(e1rmRpe(100, 1, 8)).toBeGreaterThan(100)
  })
  it('guards: zero weight/reps → 0', () => {
    expect(e1rmRpe(0, 5, 8)).toBe(0)
    expect(e1rmRpe(100, 0, 8)).toBe(0)
  })
})

// #497 — honest confidence: an e1RM is only as trustworthy as the effort behind it.
describe('e1rmConfidence', () => {
  it('a heavy low-rep set reads strong; a high-rep set reads rough', () => {
    const heavy = e1rmConfidence({ reps: 3, rpe: 9 })
    const light = e1rmConfidence({ reps: 15, rpe: 6 })
    expect(heavy.pct).toBeGreaterThan(light.pct)
    expect(heavy.cls).toBe('strong')
    expect(light.cls).toBe('learn')
    expect(light.label).toMatch(/rough/i)
  })
  it('missing RPE is penalised (we had to assume near-failure)', () => {
    expect(e1rmConfidence({ reps: 5, rpe: 9 }).pct).toBeGreaterThan(e1rmConfidence({ reps: 5 }).pct)
  })
  it('a stale max is a weaker claim on today\'s strength', () => {
    expect(e1rmConfidence({ reps: 3, rpe: 9, ageDays: 5 }).pct).toBeGreaterThan(e1rmConfidence({ reps: 3, rpe: 9, ageDays: 90 }).pct)
  })
  it('pct stays within [30, 95]', () => {
    for (const t of [{ reps: 1, rpe: 10 }, { reps: 30 }, { reps: 20, ageDays: 200 }]) {
      const c = e1rmConfidence(t)
      expect(c.pct).toBeGreaterThanOrEqual(30)
      expect(c.pct).toBeLessThanOrEqual(95)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// #448 — strength Stats analytics (rangeSummary, sets/muscle, main lifts, digest,
// exercise history, next target). Science: docs/strength-analytics.md.
import { rangeSummary, weeklySetsPerMuscle, mainLifts, exerciseHistory, nextTarget, strengthDigest, SETS_LOW, inferGymFocus, intensityZone, GYM_FOCUS, weeklySetTargetFor } from './strength'

describe('weeklySetTargetFor (frequency-scaled target, #534 — "1 gym/week is not always low")', () => {
  it('a 1×/week trainer gets a small ACHIEVABLE target, not the 3–4×/week ideal', () => {
    const t = weeklySetTargetFor('muscle', 1)
    expect(t.high).toBeLessThanOrEqual(4)
    expect(t.low).toBeGreaterThanOrEqual(1)
    expect(t.low).toBeLessThanOrEqual(t.high)
  })
  it('3+ gym sessions/week unlock the goal ideal', () => {
    expect(weeklySetTargetFor('support_build', 3)).toEqual({ low: 6, high: 12 })
  })
})
import type { WorkoutLog } from './db'

const DAY = 864e5
// Build a strength log: `exs` = [{ name, exId?, sets:[[weight,reps],...] }]. dayOffset back from a fixed epoch.
const EPOCH = Date.parse('2026-07-01')
function log(dayOffset: number, exs: { name: string; exId?: string; sets: [number, number][] }[], duration = 45): WorkoutLog {
  const at = EPOCH - dayOffset * DAY
  const date = new Date(at).toISOString().slice(0, 10)
  const sets: Record<number, { weight: number; reps: number; done: boolean }[]> = {}
  exs.forEach((e, i) => { sets[i] = e.sets.map(([weight, reps]) => ({ weight, reps, done: true })) })
  return { workoutId: 'w', title: 'Session', discipline: 'strength', duration, date, completedAt: at, sets, exNames: exs.map((e) => e.name), exIds: exs.map((e) => e.exId) } as unknown as WorkoutLog
}
const muscleOf = (n: string) => (n === 'Bench' ? 'Chest' : n === 'Squat' ? 'Legs' : n === 'Row' ? 'Back' : undefined)

describe('rangeSummary (#251 — follows the filter, not vanity kg)', () => {
  it('counts sessions + total minutes + consistency over the SELECTED span', () => {
    const logs = [log(0, [{ name: 'Bench', sets: [[100, 5]] }], 50), log(7, [{ name: 'Bench', sets: [[100, 5]] }], 40), log(14, [{ name: 'Bench', sets: [[100, 5]] }], 60)]
    const r = rangeSummary(logs, 56) // 8-week filter
    expect(r.sessions).toBe(3)
    expect(r.totalMin).toBe(150)
    expect(r.perWeek).toBeCloseTo(0.4, 1) // 3 sessions / 8 weeks
  })
})

describe('weeklySetsPerMuscle (Schoenfeld 10–20 landmark, per TRAINING week)', () => {
  const chestOver = (perLog: number) => [log(0, [{ name: 'Bench', sets: Array(perLog).fill([80, 8]) as [number, number][] }]), log(14, [{ name: 'Bench', sets: Array(perLog).fill([80, 8]) as [number, number][] }])] // 2 distinct weeks
  it('averages over the weeks TRAINED, not calendar weeks in the filter (default focus = muscle)', () => {
    // 15 sets/week across 2 training weeks = 15/wk ok vs the 10–20 muscle band
    expect(weeklySetsPerMuscle(chestOver(15), muscleOf).find((v) => v.muscle === 'Chest')).toMatchObject({ perWeek: 15, status: 'ok' })
    expect(weeklySetsPerMuscle(chestOver(4), muscleOf).find((v) => v.muscle === 'Chest')!.status).toBe('low')   // 4/wk
    expect(weeklySetsPerMuscle(chestOver(25), muscleOf).find((v) => v.muscle === 'Chest')!.status).toBe('high') // 25/wk
  })
  it('is GOAL-AWARE: 4 sets/wk is "low" for muscle but "ok" for a sport-support athlete (#534)', () => {
    expect(weeklySetsPerMuscle(chestOver(4), muscleOf, 'muscle').find((v) => v.muscle === 'Chest')!.status).toBe('low')
    expect(weeklySetsPerMuscle(chestOver(4), muscleOf, 'support').find((v) => v.muscle === 'Chest')!.status).toBe('ok') // maintenance dose
  })
  it('ignores exercises with no muscle mapping', () => {
    const logs = [log(0, [{ name: 'Mystery', sets: [[50, 5]] }])]
    expect(weeklySetsPerMuscle(logs, muscleOf)).toEqual([])
  })
  it('counts BODYWEIGHT sets (no weight) toward sets-per-muscle (#591)', () => {
    // 12 done sets of a Chest move with weight 0 (bodyweight) across 2 training weeks = 12/wk, still counted.
    const bw = (n: number) => [log(0, [{ name: 'Bench', sets: Array(n).fill([0, 10]) as [number, number][] }]), log(14, [{ name: 'Bench', sets: Array(n).fill([0, 10]) as [number, number][] }])]
    expect(weeklySetsPerMuscle(bw(12), muscleOf).find((v) => v.muscle === 'Chest')).toMatchObject({ perWeek: 12, status: 'ok' })
  })
  it('EXCLUDES warm-up sets from working-set count (#591 JeFit "W")', () => {
    // 2 warm-up + 3 working Bench sets in one week → only the 3 working count toward Chest.
    const sets = [{ weight: 40, reps: 8, done: true, warmup: true }, { weight: 40, reps: 8, done: true, warmup: true }, { weight: 80, reps: 8, done: true }, { weight: 80, reps: 8, done: true }, { weight: 80, reps: 8, done: true }]
    const l = { workoutId: 'w', title: 'S', discipline: 'strength', duration: 45, date: new Date(EPOCH).toISOString().slice(0, 10), completedAt: EPOCH, sets: { 0: sets }, exNames: ['Bench'], exIds: [undefined] } as unknown as WorkoutLog
    expect(weeklySetsPerMuscle([l], muscleOf).find((v) => v.muscle === 'Chest')!.total).toBe(3)
  })
})

describe('inferGymFocus (main sport is the strongest signal, #534)', () => {
  it('cyclist who ALSO wants muscle → support_build (concurrent hypertrophy, not pure maintenance) — JM: "you can build lean muscle in cycling"', () => {
    expect(inferGymFocus({ mainSport: 'cycling', goal: 'Build lean muscle, lose fat' })).toBe('support_build')
    expect(inferGymFocus({ mainSport: 'cycling', goal: 'I want 300 FTP' })).toBe('support') // no muscle intent → pure support
  })
  it('NO main sport → the objective decides: a muscle goal → muscle', () => {
    expect(inferGymFocus({ goal: 'I want to build lean muscle' })).toBe('muscle')
  })
  it('a strength main sport + strength goal → strength', () => {
    expect(inferGymFocus({ mainSport: 'strength', goal: 'a 200kg deadlift' })).toBe('strength')
  })
  it('no main + first sport endurance → support; nothing → health', () => {
    expect(inferGymFocus({ sports: ['cycling'], goal: '' })).toBe('support')
    expect(inferGymFocus({})).toBe('health')
  })
})

describe('intensityZone (%1-RM → NSCA zone)', () => {
  it('classifies by load vs 1-RM', () => {
    expect(intensityZone(90, 100)!.key).toBe('strength')     // 90%
    expect(intensityZone(75, 100)!.key).toBe('hypertrophy')  // 75%
    expect(intensityZone(60, 100)!.key).toBe('endurance')    // 60%
    expect(intensityZone(0, 100)).toBeNull()
  })
})

describe('strengthDigest — NO app volume judgment (#534: the coach judges volume, not the app)', () => {
  const chest = (perLog: number) => [log(0, [{ name: 'Bench', sets: Array(perLog).fill([80, 8]) as [number, number][] }]), log(14, [{ name: 'Bench', sets: Array(perLog).fill([80, 8]) as [number, number][] }])]
  it('never emits low-volume / missing items — regardless of how little volume', () => {
    const d = strengthDigest(chest(1))
    expect(d.needsAttention.some((x) => x.kind === 'low-volume' || x.kind === 'missing')).toBe(false)
  })
  it('GYM_FOCUS bands are ordered support < muscle', () => {
    expect(GYM_FOCUS.support.low).toBeLessThan(GYM_FOCUS.muscle.low)
  })
})

describe('mainLifts (bounded, most-trained first)', () => {
  const logs = [
    ...[0, 7, 14, 21].map((d) => log(d, [{ name: 'Bench', sets: [[100, 5]] }, { name: 'Squat', sets: [[140, 5]] }])),
    log(3, [{ name: 'Curl', sets: [[20, 10]] }]),
  ]
  it('returns at most n, ranked by session count', () => {
    const ml = mainLifts(logs, muscleOf, 2)
    expect(ml).toHaveLength(2)
    expect(ml.map((l) => l.name).sort()).toEqual(['Bench', 'Squat']) // 4 sessions each > Curl's 1
    expect(ml[0].muscle).toBeDefined()
    expect(ml[0].confidencePct).toBeGreaterThan(0)
  })
})

describe('nextTarget (double progression)', () => {
  it('owns the top of the range → add the smallest load', () => {
    const n = nextTarget([{ weight: 100, reps: 8, at: EPOCH }], 8, 2.5)
    expect(n!.weightKg).toBe(102.5)
  })
  it('below the top → chase a rep first', () => {
    const n = nextTarget([{ weight: 100, reps: 5, at: EPOCH }], 8, 2.5)
    expect(n!.weightKg).toBe(100)
    expect(n!.reps).toBe(6)
  })
})

describe('exerciseHistory (#227 page data)', () => {
  const logs = [log(21, [{ name: 'Bench', sets: [[90, 5]] }]), log(14, [{ name: 'Bench', sets: [[95, 5]] }]), log(0, [{ name: 'Bench', sets: [[100, 3], [75, 10]] }])]
  it('builds a dated trend, rep-range bests, and a next target', () => {
    const h = exerciseHistory(logs, 'Bench')!
    expect(h.sessions).toBe(3)
    expect(h.pts).toHaveLength(3)
    expect(h.deltaPct).toBeGreaterThan(0) // 90 → ~100+ over the block
    expect(h.repBests.map((r) => r.reps)).toEqual([3, 5, 12]) // 3-rep + 5-rep + 12-rep (10 reps) buckets
    expect(h.next).not.toBeNull()
  })
  it('returns null for an untrained exercise', () => {
    expect(exerciseHistory(logs, 'Deadlift')).toBeNull()
  })
})

describe('strengthDigest (actionable feed)', () => {
  it('surfaces a stall + a low-volume muscle in needs-attention, and a PR in wins', () => {
    const benchW = [[100, 5], [95, 5], [94, 5], [93, 5], [92, 5]] as [number, number][]
    const stall = benchW.map((pair, i) => log(28 - i * 7, [{ name: 'Bench', sets: [pair] }]))
    const squatW = [[120, 5], [130, 5], [140, 5]] as [number, number][]
    const pr = squatW.map((pair, i) => log(14 - i * 7, [{ name: 'Squat', sets: [pair] }]))
    const d = strengthDigest([...stall, ...pr])
    expect(d.needsAttention.some((x) => x.kind === 'stall' && x.name === 'Bench')).toBe(true)
    expect(d.wins.some((x) => x.name === 'Squat')).toBe(true)
    expect(SETS_LOW).toBe(10)
  })
})

// #527/#251 — reliable session duration (wall-clock fragile → planned/intervals fallback).
import { reliableSessionMinutes } from './strength'
describe('reliableSessionMinutes (#527 gym duration)', () => {
  it('trusts a plausible wall-clock', () => {
    expect(reliableSessionMinutes({ wallMin: 62, setsCompleted: 20, plannedMin: 71 })).toBe(62)
  })
  it('JM case — 20 sets in "11 min" is impossible → uses the planned estimate (intervals-consistent)', () => {
    expect(reliableSessionMinutes({ wallMin: 11, setsCompleted: 20, plannedMin: 71 })).toBe(71)
  })
  it('broken timer with no plan → floors to sets×0.75', () => {
    expect(reliableSessionMinutes({ wallMin: 3, setsCompleted: 20 })).toBe(15)
  })
  it('never below 1', () => {
    expect(reliableSessionMinutes({ wallMin: 0, setsCompleted: 0 })).toBe(1)
  })
})
