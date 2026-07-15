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
import { rangeSummary, weeklySetsPerMuscle, mainLifts, exerciseHistory, nextTarget, strengthDigest, SETS_LOW } from './strength'
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

describe('weeklySetsPerMuscle (Schoenfeld 10–20 landmark)', () => {
  it('flags low / ok / high vs the target band', () => {
    const chest30 = [log(0, [{ name: 'Bench', sets: Array(30).fill([80, 8]) as [number, number][] }])]
    expect(weeklySetsPerMuscle(chest30, muscleOf, 14).find((v) => v.muscle === 'Chest')).toMatchObject({ perWeek: 15, status: 'ok' })
    const chest10 = [log(0, [{ name: 'Bench', sets: Array(10).fill([80, 8]) as [number, number][] }])]
    expect(weeklySetsPerMuscle(chest10, muscleOf, 14).find((v) => v.muscle === 'Chest')!.status).toBe('low')
    const chest25 = [log(0, [{ name: 'Bench', sets: Array(25).fill([80, 8]) as [number, number][] }])]
    expect(weeklySetsPerMuscle(chest25, muscleOf, 7).find((v) => v.muscle === 'Chest')!.status).toBe('high')
  })
  it('ignores exercises with no muscle mapping', () => {
    const logs = [log(0, [{ name: 'Mystery', sets: [[50, 5]] }])]
    expect(weeklySetsPerMuscle(logs, muscleOf, 14)).toEqual([])
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
    const d = strengthDigest([...stall, ...pr], muscleOf, 42)
    expect(d.needsAttention.some((x) => x.kind === 'stall' && x.name === 'Bench')).toBe(true)
    expect(d.needsAttention.some((x) => x.kind === 'low-volume')).toBe(true) // only a few sets/wk
    expect(d.wins.some((x) => x.name === 'Squat')).toBe(true)
    expect(SETS_LOW).toBe(10)
  })
})
