import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { generatePlanSkeleton, buildWorkoutSegments, sessionDuration, suggestIntensityZone, ZONES } from '../server/plan-skeleton.js'
// @ts-expect-error — plain JS server module, no types
import { plannedTss } from '../server/icu-steps.js'
// @ts-expect-error — plain JS server module, no types
import { isoMonday } from '../server/readiness.js'

// #516b — deterministic plan skeleton. The periodization math is already tested in readiness.test.ts;
// here we test the 4 new gap functions + the orchestrator's INVARIANTS (caps, spacing, load fidelity).

describe('buildWorkoutSegments — hits the target TSS + stays easy where labelled', () => {
  for (const [key, target] of [['endurance', 60], ['sweetspot', 90], ['threshold', 100], ['vo2', 80]] as const) {
    it(`${key}: plannedTss lands near ${target}`, () => {
      const { segments, tss, durationMin } = buildWorkoutSegments(key, target)
      expect(segments.length).toBeGreaterThan(0)
      expect(durationMin).toBeGreaterThan(15)
      // one proportional scale pass → within ~25% (interval sessions with fixed recoveries are coarser).
      expect(Math.abs(tss - target)).toBeLessThanOrEqual(Math.max(15, target * 0.25))
    })
  }
  it('warm-up ramps up and never exceeds easy; cool-down is a flat easy spin', () => {
    const { segments } = buildWorkoutSegments('threshold', 100)
    const warm = segments[0], cool = segments[segments.length - 1]
    expect(warm.label).toMatch(/warm/i)
    expect(warm.powerEnd).toBeLessThanOrEqual(80)          // easy ceiling (clampEasyEfforts)
    expect(warm.powerEnd).toBeGreaterThanOrEqual(warm.powerStart) // ramps UP (normalizeRamps)
    expect(cool.label).toMatch(/cool/i)
    expect(cool.powerStart).toBe(cool.powerEnd)            // flat
    expect(cool.powerStart).toBeLessThanOrEqual(80)
  })
  it('the WORK segments carry the zone intensity', () => {
    const { segments } = buildWorkoutSegments('vo2', 80)
    const work = segments.filter((s: any) => s.label === ZONES.vo2.name)
    expect(work.length).toBe(ZONES.vo2.reps)
    for (const w of work) expect(w.powerStart).toBe(ZONES.vo2.pct)
  })
})

describe('sessionDuration', () => {
  it('is shorter for higher intensity at the same TSS', () => {
    expect(sessionDuration(80, 65)).toBeGreaterThan(sessionDuration(80, 99))
  })
  it('clamps to a sane band', () => {
    expect(sessionDuration(500, 65)).toBeLessThanOrEqual(210)
    expect(sessionDuration(5, 65)).toBeGreaterThanOrEqual(20)
    expect(sessionDuration(0, 65)).toBe(0)
  })
})

describe('suggestIntensityZone', () => {
  it('rest → null, long/easy → endurance, quality → a phase quality zone', () => {
    expect(suggestIntensityZone('rest', 'build')).toBeNull()
    expect(suggestIntensityZone('long', 'build')).toBe('endurance')
    expect(suggestIntensityZone('easy', 'peak')).toBe('endurance')
    expect(['threshold', 'sweetspot']).toContain(suggestIntensityZone('quality', 'build', 0, 0))
    expect(['vo2', 'threshold']).toContain(suggestIntensityZone('quality', 'peak', 0, 0))
  })
})

describe('generatePlanSkeleton — a full 14-day plan', () => {
  const opts = { today: '2026-07-13', days: 14, sports: ['cycling'], trainingDays: 5, restDows: [1], ctl: 60, atl: 55 }
  const plan = generatePlanSkeleton(opts)

  it('covers exactly the horizon', () => {
    expect(plan.days.length).toBe(14)
    expect(plan.days[0].date).toBe('2026-07-13')
    expect(plan.days[13].date).toBe('2026-07-26')
  })

  it('has rest days and at least one long day', () => {
    expect(plan.days.some((d: any) => d.cls === 'rest')).toBe(true)
    expect(plan.days.some((d: any) => d.cls === 'long')).toBe(true)
  })

  it('NEVER exceeds the HARD weekly training-days cap', () => {
    const byWeek: Record<string, number> = {}
    for (const d of plan.days) if (d.dayType !== 'rest') byWeek[isoMonday(d.date)] = (byWeek[isoMonday(d.date)] || 0) + 1
    for (const wk of Object.keys(byWeek)) expect(byWeek[wk]).toBeLessThanOrEqual(5)
  })

  it('never schedules two QUALITY days back-to-back within a week', () => {
    const weeks: Record<string, any[]> = {}
    for (const d of plan.days) (weeks[isoMonday(d.date)] = weeks[isoMonday(d.date)] || []).push(d)
    for (const wk of Object.keys(weeks)) {
      const ds = weeks[wk].sort((a, b) => a.date.localeCompare(b.date))
      for (let i = 1; i < ds.length; i++) {
        if (ds[i].cls === 'quality') expect(ds[i - 1].cls).not.toBe('quality')
      }
    }
  })

  it('every built endurance/quality session carries the assigned training load', () => {
    for (const d of plan.days) {
      if (!d.segments.length || d.dayType === 'gym') continue
      const t = plannedTss(d.segments)
      expect(t).not.toBeNull()
      expect(Math.abs(t.tss - d.targetTss)).toBeLessThanOrEqual(Math.max(18, d.targetTss * 0.3))
    }
  })

  it('an EASY day is genuinely lighter than the LONG day (hard-easy contrast)', () => {
    const weeks: Record<string, any[]> = {}
    for (const d of plan.days) (weeks[isoMonday(d.date)] = weeks[isoMonday(d.date)] || []).push(d)
    for (const wk of Object.keys(weeks)) {
      const long = weeks[wk].find((d) => d.cls === 'long')
      if (!long) continue
      for (const d of weeks[wk]) if (d.cls === 'easy') expect(d.targetTss).toBeLessThan(long.targetTss)
    }
  })

  it('work intervals are clean 30-second multiples (no 736s oddities)', () => {
    for (const d of plan.days) for (const s of d.segments) expect(s.duration % 30).toBe(0)
  })

  it('rest days have no session; training days name a sport', () => {
    for (const d of plan.days) {
      if (d.cls === 'rest') { expect(d.sport).toBeNull(); expect(d.segments.length).toBe(0) }
      else expect(d.sport).toBeTruthy()
    }
  })
})

describe('generatePlanSkeleton — multi-sport', () => {
  it('rotates cycling/running and gives the long day to the primary; ~1 gym/week', () => {
    const plan = generatePlanSkeleton({ today: '2026-07-13', days: 14, sports: ['cycling', 'running', 'gym'], trainingDays: 6, restDows: [1], ctl: 55 })
    const sports = new Set(plan.days.filter((d: any) => d.sport).map((d: any) => d.sport))
    expect(sports.has('cycling')).toBe(true)
    expect(sports.has('running')).toBe(true)
    const long = plan.days.find((d: any) => d.cls === 'long')
    expect(long.sport).toBe('cycling') // primary endurance sport
    const gymDays = plan.days.filter((d: any) => d.dayType === 'gym').length
    expect(gymDays).toBeGreaterThanOrEqual(1)
    expect(gymDays).toBeLessThanOrEqual(3)
  })

  it('a tighter cap (3 days/wk) is still respected', () => {
    const plan = generatePlanSkeleton({ today: '2026-07-13', days: 14, sports: ['running'], trainingDays: 3, restDows: [1], ctl: 40 })
    const byWeek: Record<string, number> = {}
    for (const d of plan.days) if (d.dayType !== 'rest') byWeek[isoMonday(d.date)] = (byWeek[isoMonday(d.date)] || 0) + 1
    for (const wk of Object.keys(byWeek)) expect(byWeek[wk]).toBeLessThanOrEqual(3)
  })

  it('#609 pregnancy: NO threshold/sweetspot/vo2 quality days — easy/endurance only, capped load', () => {
    const plan = generatePlanSkeleton({ today: '2026-07-20', days: 14, sports: ['running', 'strength'], trainingDays: 4, ctl: 12, atl: 14, pregnant: true })
    const runZones = plan.days.filter((d: any) => d.sport && d.sport !== 'gym').map((d: any) => d.zone)
    expect(runZones.length).toBeGreaterThan(0) // she still trains
    for (const z of runZones) expect(['threshold', 'sweetspot', 'vo2']).not.toContain(z) // but never HARD
    expect(plan.days.every((d: any) => d.targetTss <= 45)).toBe(true) // maintenance ceiling
    // control: a non-pregnant athlete DOES get quality intensity
    const normal = generatePlanSkeleton({ today: '2026-07-20', days: 14, sports: ['running'], trainingDays: 4, ctl: 40 })
    expect(normal.days.some((d: any) => ['threshold', 'sweetspot', 'vo2'].includes(d.zone))).toBe(true)
  })
})
