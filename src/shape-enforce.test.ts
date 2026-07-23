import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server modules, no types
import { enforceShape, isModerate, honestTitle, QUALITY_TITLE, qualityEnduranceDates, concurrentGymCollisions } from '../server/shape-enforce.js'
// @ts-expect-error
import { weekShape } from '../server/week-shape.js'

// Simulate reenforceShapeAll: run enforceShape over every same-week ride/run in DATE order, sharing the (mutating)
// sibling array — so as an over-budget session is relabeled to easy, later ones see fewer moderate siblings.
function sweep(shape: any, plans: any[]) {
  const sorted = [...plans].sort((a, b) => String(a.date).localeCompare(String(b.date)))
  for (const p of sorted) enforceShape(shape, p, sorted)
  return sorted
}
const topOf = (p: any) => Math.max(0, ...(p.segments || []).map((s: any) => Math.max(s.powerStart || 0, s.powerEnd || 0)))
const seg = (pct: number) => ({ segments: [{ powerStart: pct, powerEnd: pct }] })

describe('#620 shape-enforce — the pregnant-runner "all tempo/sweet-spot" fix (the reported bug)', () => {
  const shape = weekShape({ pregnant: true, trimester: null, goalFocus: 'consistency', trainingDays: 4 })

  it('weekShape gives a pregnant runner MAINTENANCE: 0 quality + at most 1 moderate, ceiling ≤ tempo', () => {
    expect(shape.loadBand).toBe('maintenance')
    expect(shape.qualityDays).toBe(0)
    expect(shape.moderateDays).toBeLessThanOrEqual(1)
    expect(['recovery', 'endurance', 'tempo']).toContain(shape.intensityCeiling)
  })

  it('a week the coach filled with TWO sweet-spots + a tempo collapses to EXACTLY ONE moderate day; the rest go easy', () => {
    const week = [
      { id: 'a', date: '2026-07-21', sport: 'run', title: 'Sweet Spot Run 3×3:30', ...seg(88) },
      { id: 'b', date: '2026-07-23', sport: 'run', title: 'Easy Aerobic Run', ...seg(62) },
      { id: 'c', date: '2026-07-28', sport: 'run', title: 'Sweet Spot Run 3×4:30', ...seg(88) },
    ]
    const out = sweep(shape, week)
    expect(out.filter((p) => isModerate(p)).length).toBeLessThanOrEqual(1) // the core dose fix
  })

  it('title-only tempo runs (no segments) are counted + capped — 3 "Tempo Run"s do NOT all survive (the exact asymmetry bug)', () => {
    const week = [
      { id: 'a', date: '2026-07-21', sport: 'run', title: 'Tempo Run' }, // no segments — the case that slipped through
      { id: 'b', date: '2026-07-23', sport: 'run', title: 'Tempo Run' },
      { id: 'c', date: '2026-07-25', sport: 'run', title: 'Tempo Run' },
    ]
    const out = sweep(shape, week)
    const stillTempo = out.filter((p) => /tempo/i.test(p.title)).length
    expect(stillTempo).toBeLessThanOrEqual(1) // was 3 before the fix (each looked "not moderate" to the old clamp)
  })

  it('no surviving segment exceeds the tempo ceiling, and no sweet-spot/threshold TITLE remains', () => {
    const week = [
      { id: 'a', date: '2026-07-21', sport: 'run', title: 'Sweet Spot Run', ...seg(88) },
      { id: 'c', date: '2026-07-28', sport: 'run', title: 'Threshold Run', ...seg(100) },
    ]
    const out = sweep(shape, week)
    for (const p of out) expect(topOf(p)).toBeLessThanOrEqual(85) // tempo ceiling
    for (const p of out) expect(QUALITY_TITLE.test(p.title)).toBe(false) // no "Sweet Spot"/"Threshold" left
  })
})

describe('#620 shape-enforce — the rest of the athlete matrix (commercialization gate)', () => {
  it('pregnant T3 (endurance ceiling, 0 moderate) → EVERY run forced easy, none moderate', () => {
    const shape = weekShape({ pregnant: true, trimester: 3, goalFocus: 'consistency', trainingDays: 4 })
    const week = [
      { id: 'a', date: '2026-07-21', sport: 'run', title: 'Tempo Run', ...seg(85) },
      { id: 'b', date: '2026-07-23', sport: 'run', title: 'Easy Run', ...seg(62) },
    ]
    const out = sweep(shape, week)
    expect(out.filter((p) => isModerate(p)).length).toBe(0)
    for (const p of out) expect(topOf(p)).toBeLessThanOrEqual(75)
  })

  it('BUILD cyclist (vo2 ceiling, 2 quality) → keeps 2 hard days untouched, clamps only a 3rd', () => {
    const shape = weekShape({ goalFocus: ['performance'], ctl: 60, trainingDays: 6 })
    expect(shape.qualityDays).toBeGreaterThanOrEqual(2)
    const week = [
      { id: 'a', date: '2026-07-21', sport: 'ride', title: 'VO2 5×3', ...seg(115) },
      { id: 'b', date: '2026-07-23', sport: 'ride', title: 'Threshold 4×10', ...seg(100) },
      { id: 'c', date: '2026-07-25', sport: 'ride', title: 'Sweet-Spot 3×12', ...seg(90) },
      { id: 'd', date: '2026-07-27', sport: 'ride', title: 'Easy Spin', ...seg(60) },
    ]
    const out = sweep(shape, week)
    const moderate = out.filter((p) => isModerate(p))
    expect(moderate.length).toBe(shape.qualityDays) // budget fully used, never exceeded (3 quality → capped at 2)
    for (const p of moderate) expect(topOf(p)).toBeGreaterThanOrEqual(90) // the surviving quality days stay hard (not clamped)
  })

  it('TEEN runner (capped ceiling) → a VO2 grind is clamped below vo2 (no maximal work)', () => {
    const shape = weekShape({ ageYears: 15, goalFocus: 'performance', trainingDays: 4 })
    const week = [{ id: 'a', date: '2026-07-21', sport: 'run', title: 'VO2 Intervals', ...seg(125) }]
    sweep(shape, week)
    expect(topOf(week[0])).toBeLessThan(115) // never a maximal VO2 session for a teen
  })

  it('#3 TRIATHLETE (build) → a KEY quality session PER discipline (Friel), NOT a global 2 that deletes the 3rd sport', () => {
    const shape = weekShape({ goalFocus: ['performance'], goalNotes: 'race triathlon', ctl: 60, trainingDays: 6 })
    expect(shape.qualityDays).toBe(3) // one per discipline (swim + bike + run)
    const week = [
      { id: 'a', date: '2026-07-21', sport: 'swim', title: 'CSS Intervals', ...seg(100) },
      { id: 'b', date: '2026-07-22', sport: 'ride', title: 'Threshold 4×10', ...seg(100) },
      { id: 'c', date: '2026-07-24', sport: 'run', title: 'VO2 Intervals', ...seg(118) },
      { id: 'd', date: '2026-07-26', sport: 'ride', title: 'Easy Spin', ...seg(60) },
    ]
    const out = sweep(shape, week)
    expect(out.filter((p) => isModerate(p)).length).toBe(3) // all 3 discipline key sessions survive (a 4th hard would clamp)
  })

  it('PREGNANT: a fartlek/surge run is relabeled to steady (no surges in maintenance, #632)', () => {
    const shape = weekShape({ pregnant: true, trimester: 1, goalFocus: 'consistency', trainingDays: 4 })
    const week = [{ id: 'a', date: '2026-08-04', sport: 'run', title: 'Fartlek Run', ...seg(80) }]
    const out = sweep(shape, week)
    expect(/fartlek|surge|pick.?up/i.test(out[0].title)).toBe(false) // no fartlek/surge title survives on a maintenance week
  })

  it('SWIMMER, pregnant → a hard CSS swim is clamped to the tempo ceiling (swim is enforced too, not skipped)', () => {
    const shape = weekShape({ pregnant: true, trimester: 1, goalFocus: 'consistency', trainingDays: 4 })
    const week = [
      { id: 'a', date: '2026-07-21', sport: 'swim', title: 'CSS Intervals 8×100', ...seg(100) },
      { id: 'b', date: '2026-07-23', sport: 'swim', title: 'Threshold Swim', ...seg(98) },
      { id: 'c', date: '2026-07-25', sport: 'swim', title: 'Easy Technique Swim', ...seg(65) },
    ]
    const out = sweep(shape, week)
    for (const p of out) expect(topOf(p)).toBeLessThanOrEqual(85) // no swim segment above the tempo ceiling
    expect(out.filter((p) => isModerate(p)).length).toBeLessThanOrEqual(1) // ≤1 moderate swim/week
  })
})

describe('#620 honestTitle — varied easy relabels, honest downgrades', () => {
  it('an easy-ceiling relabel is NOT the flat "Easy Aerobic Run" every time (rotates by date)', () => {
    const t1 = honestTitle(70, 'run', '2026-07-21')
    const t2 = honestTitle(70, 'run', '2026-07-24')
    expect(t1).not.toBe(t2) // distinct cues on different days
  })
  it('downgrades to the true level (a clamp to sweet-spot yields a Sweet-Spot title, not Threshold)', () => {
    expect(honestTitle(93, 'ride')).toBe('Sweet-Spot Ride')
    expect(honestTitle(85, 'run')).toBe('Tempo Run')
  })
})

describe('#672 scrubSurgeProse — description matches the relabeled steady title', () => {
  // @ts-expect-error plain JS
  const { scrubSurgeProse } = require('../server/shape-enforce.js')
  it('neutralizes surge/burst prose on a maintenance session', () => {
    expect(scrubSurgeProse('31 min easy run with 5 unstructured effort bursts of ~40s by feel.')).not.toMatch(/burst|surge|fartlek/i)
    expect(scrubSurgeProse('Include 6 short surges of 20s.')).not.toMatch(/surge/i)
  })
  it('leaves steady/easy prose untouched', () => {
    expect(scrubSurgeProse('Easy Z2 endurance, keep it conversational.')).toBe('Easy Z2 endurance, keep it conversational.')
  })
})

describe('#717 concurrent-training separation — detect heavy gym adjacent to a quality endurance day', () => {
  it('flags a heavy gym the day before/after a quality endurance session; ignores light gym', () => {
    const plans = [
      { date: '2026-08-01', sport: 'run', title: 'Threshold 4x10', segments: [{ duration: 600, powerStart: 95 }] },
      { date: '2026-07-31', sport: 'gym', exercises: [{ mode: 'reps', reps: 5, sets: 3, name: 'Back Squat' }] }, // heavy, day BEFORE → collision
      { date: '2026-08-05', sport: 'gym', exercises: [{ mode: 'reps', reps: 12, sets: 3, name: 'Curl' }] },        // light, no collision
    ]
    expect(qualityEnduranceDates(plans, '2026-07-30', 14)).toEqual(['2026-08-01'])
    expect(concurrentGymCollisions(plans, '2026-07-30', 14).map((p: any) => p.date)).toEqual(['2026-07-31'])
  })
})

// #745 (audit) — POSTPARTUM impact is CODE-ENFORCED at save, not prompt-only.
describe('postpartum impact clamp (#745)', () => {
  it('early postpartum (<6wk, impact:none) → a hard RUN becomes a Gentle Walk, clamped to easy', () => {
    const plan = { id: 'r', date: '2026-07-21', sport: 'run', title: 'Tempo Run 5×3', ...seg(100) }
    const r = enforceShape({ impact: 'none', loadBand: 'flat', qualityDays: 1, moderateDays: 0, intensityCeiling: 'endurance' }, plan, [plan])
    expect(r.changed).toBe(true)
    expect(plan.title).toBe('Gentle Walk')
    expect(plan.segments[0].powerStart).toBeLessThanOrEqual(75) // endurance ceiling
  })
  it('weeks 6-12 (impact:walk_run) → an Easy Walk-Run, capped to easy', () => {
    const plan = { id: 'r', date: '2026-07-21', sport: 'run', title: 'Threshold Run', ...seg(100) }
    enforceShape({ impact: 'walk_run', loadBand: 'flat', qualityDays: 1, moderateDays: 1, intensityCeiling: 'endurance' }, plan, [plan])
    expect(plan.title).toBe('Easy Walk-Run')
  })
  it('a RIDE is untouched by the run-impact clamp', () => {
    const plan = { id: 'b', date: '2026-07-21', sport: 'ride', title: 'Easy Spin', ...seg(60) }
    enforceShape({ impact: 'none', loadBand: 'flat', qualityDays: 1, moderateDays: 0, intensityCeiling: 'endurance' }, plan, [plan])
    expect(plan.title).toBe('Easy Spin')
  })
})
