import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { encodeStep, flattenIcuStepsSrv, MAX_DOC_STEP_SECONDS, paceFromPowerPct, clampEasyEfforts, normalizeRamps, nativeWorkoutText, detectRepeat, plannedTss, plannedGymTss, estimateGymSeconds, stripPlatyplusLinks, stripDerivedWorkout, isPlatyplusPushedEvent } from '../server/icu-steps.js'

// #434 — gym plans carry a LOAD so intervals Form/CTL counts strength (was pushed as 0).
describe('plannedGymTss — gym LOAD from exercises (KB Friel ~45 TSS/h)', () => {
  const plan = { rounds: 1, exercises: [
    { name: 'Squat', sets: 3, reps: 8, rest: 90 }, { name: 'Bench', sets: 3, reps: 8, rest: 90 },
    { name: 'Row', sets: 3, reps: 10, rest: 60 }, { name: 'Plank', mode: 'timed', seconds: 45, sets: 3, rest: 45 }] }
  it('a real 4-move session scores a sensible non-zero TSS (~15-40)', () => {
    const tss = plannedGymTss(plan)
    expect(tss).toBeGreaterThan(10)
    expect(tss).toBeLessThan(45)
  })
  it('is ~ minutes/60 × 45 (the Friel standard factor)', () => {
    const min = estimateGymSeconds(plan) / 60
    expect(plannedGymTss(plan)).toBe(Math.round((min / 60) * 45))
  })
  it('empty / no-exercise gym → 0 (no phantom load)', () => {
    expect(plannedGymTss({ exercises: [] })).toBe(0)
    expect(plannedGymTss({})).toBe(0)
  })
  it('rounds multiply the volume', () => {
    expect(plannedGymTss({ ...plan, rounds: 2 })).toBeGreaterThan(plannedGymTss(plan))
  })
})

// #384 — cool-downs flatten (no backwards "150-117" range); warm-ups always ramp up.
describe('normalizeRamps — flat cool-downs, warm-ups ramp up', () => {
  it('flattens a cool-down ramp-down to a single easy value (the eased-down power)', () => {
    const [cd] = normalizeRamps([{ duration: 600, powerStart: 58, powerEnd: 45, label: 'Cool-down' }])
    expect(cd.powerStart).toBe(45)
    expect(cd.powerEnd).toBe(45) // flat → intervals shows "45%", not "58-45%"
  })
  it('leaves a warm-up ramping UP alone (reads low-to-high)', () => {
    const [wu] = normalizeRamps([{ duration: 600, powerStart: 50, powerEnd: 63, label: 'Warm-up' }])
    expect([wu.powerStart, wu.powerEnd]).toEqual([50, 63])
  })
  it('flips a warm-up authored descending into an ascending ramp', () => {
    const [wu] = normalizeRamps([{ duration: 600, powerStart: 63, powerEnd: 50, label: 'Warm-up' }])
    expect([wu.powerStart, wu.powerEnd]).toEqual([50, 63])
  })
  it('leaves a WORK segment as authored (intentional ramps survive)', () => {
    const [w] = normalizeRamps([{ duration: 1200, powerStart: 88, powerEnd: 94, label: 'Sweet Spot' }])
    expect([w.powerStart, w.powerEnd]).toEqual([88, 94])
  })
})

// #312 — a RUN must target PACE (%pace), a RIDE POWER (%ftp). The bug: every ride/run emitted
// power → intervals (and the Garmin workout it syncs) showed WATTS on runs.
describe('encodeStep — run targets pace, ride targets power', () => {
  const seg = { duration: 600, powerStart: 75, powerEnd: 90, label: 'build' }

  it('ride → power/%ftp, never pace', () => {
    const [s] = encodeStep(seg, false)
    expect(s.power).toEqual({ start: 75, end: 90, units: '%ftp' })
    expect(s.pace).toBeUndefined()
    expect(s.text).toBe('build')
  })

  it('run → pace/%pace, never power', () => {
    const [s] = encodeStep(seg, true)
    expect(s.pace).toEqual({ start: 75, end: 90, units: '%pace' })
    expect(s.power).toBeUndefined()
  })

  it('a steady run step keeps both ends equal, as pace', () => {
    const [s] = encodeStep({ duration: 300, powerStart: 80, powerEnd: 80 }, true)
    expect(s.pace).toEqual({ start: 80, end: 80, units: '%pace' })
  })

  it('splitting an over-long step preserves the target type (run→pace on every chunk)', () => {
    const chunks = encodeStep({ duration: MAX_DOC_STEP_SECONDS * 2 + 100, powerStart: 70, powerEnd: 70 }, true)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((c: { pace?: unknown; power?: unknown }) => c.pace && !c.power)).toBe(true)
    expect(chunks.reduce((t: number, c: { duration: number }) => t + c.duration, 0)).toBe(MAX_DOC_STEP_SECONDS * 2 + 100)
  })
})

describe('flattenIcuStepsSrv — reads pace (runs) or power (rides), never collapses to 0', () => {
  it('a run round-trips its pace target back to a non-zero segment', () => {
    const flat = flattenIcuStepsSrv([{ duration: 600, pace: { start: 95, end: 105, units: '%pace' }, text: 'threshold' }])
    expect(flat).toEqual([{ duration: 600, powerStart: 95, powerEnd: 105, label: 'threshold' }])
  })

  it('a ride still reads its power target', () => {
    const flat = flattenIcuStepsSrv([{ duration: 300, power: { start: 60, end: 60, units: '%ftp' } }])
    expect(flat[0]).toMatchObject({ duration: 300, powerStart: 60, powerEnd: 60 })
  })

  it('power_zone still resolves (the "5 W" regression stays fixed)', () => {
    const flat = flattenIcuStepsSrv([{ duration: 600, power: { units: 'power_zone', value: 2 } }])
    expect(flat[0]).toMatchObject({ powerStart: 65, powerEnd: 65, label: 'Z2' })
  })

  it('expands a nested repeat block', () => {
    const flat = flattenIcuStepsSrv([{ reps: 3, steps: [{ duration: 60, pace: { start: 110, end: 110, units: '%pace' } }] }])
    expect(flat).toHaveLength(3)
    expect(flat[0]).toMatchObject({ duration: 60, powerStart: 110 })
  })
})

// #331c — the coach's easy/recovery effort must NEVER map near threshold. Two layers:
// (a) paceFromPowerPct now reaches Z1 pace (~73–78%) for recovery efforts (30–40); (b) clampEasyEfforts
// is a hard guard that caps any easy-LABELLED segment prescribed above threshold-adjacent %.
describe('paceFromPowerPct — Daniels zones incl. recovery Z1', () => {
  it('recovery effort (30–40) lands in Z1 pace (~73–77%), below easy Z2', () => {
    expect(paceFromPowerPct(30)).toBe(73) // Daniels recovery ≈ 72.5% of threshold speed
    expect(paceFromPowerPct(40)).toBe(77)
    expect(paceFromPowerPct(30)).toBeLessThan(paceFromPowerPct(55)) // recovery slower than easy
  })
  it('easy/endurance (55–65) = Z2 (81–84%)', () => {
    expect(paceFromPowerPct(55)).toBe(81)
    expect(paceFromPowerPct(65)).toBe(84)
  })
  it('threshold = 100%, intervals/reps above it (Daniels I≈111%T, R≈118%T)', () => {
    expect(paceFromPowerPct(100)).toBe(100)
    expect(paceFromPowerPct(108)).toBe(111) // interval = velocity at VO₂max
    expect(paceFromPowerPct(120)).toBe(119)
  })
})

describe('clampEasyEfforts — "95% is never easy" hard guard (both sports)', () => {
  it('clamps a Recovery run authored at 94–95% down to a real recovery effort', () => {
    const segs = [
      { duration: 300, powerStart: 94, powerEnd: 94, label: 'Warm-up walk/jog' },
      { duration: 900, powerStart: 95, powerEnd: 95, label: 'Easy jog' },
      { duration: 300, powerStart: 94, powerEnd: 94, label: 'Cool-down easy' },
    ]
    const { segments, clamped } = clampEasyEfforts('Recovery Shakeout Run', segs)
    expect(clamped).toBe(3)
    for (const s of segments) expect(s.powerStart).toBeLessThanOrEqual(55)
    // recovery-titled → Z1 pace after remap
    expect(paceFromPowerPct(segments[0].powerStart)).toBeLessThanOrEqual(80)
  })
  it('leaves intentional work (tempo/threshold/strides) untouched', () => {
    const segs = [
      { duration: 600, powerStart: 85, powerEnd: 85, label: 'Tempo' },
      { duration: 30, powerStart: 110, powerEnd: 110, label: 'Stride' },
      { duration: 1200, powerStart: 98, powerEnd: 98, label: 'Threshold' },
    ]
    const { segments, clamped } = clampEasyEfforts('Aerobic Run + Strides', segs)
    expect(clamped).toBe(0)
    expect(segments).toEqual(segs)
  })
  it('applies to rides too — a "recovery spin" at 95% FTP is clamped', () => {
    const { segments, clamped } = clampEasyEfforts('Recovery Spin', [{ duration: 1800, powerStart: 95, powerEnd: 95, label: 'Easy spin' }])
    expect(clamped).toBe(1)
    expect(segments[0].powerStart).toBeLessThanOrEqual(55)
  })
  it('leaves an already-easy warm-up ramp (50→70) alone', () => {
    const segs = [{ duration: 600, powerStart: 50, powerEnd: 70, label: 'Warm-up' }]
    const { segments, clamped } = clampEasyEfforts('Endurance', segs)
    expect(clamped).toBe(0)
    expect(segments).toEqual(segs)
  })
})

// #157 — native intervals workout text: Warmup / Nx / Cooldown, so the pushed text reads like a real
// workout (round-trip verified: intervals parses "2x" + "% pace" into steps).
describe('nativeWorkoutText (#157)', () => {
  const ride = [
    { duration: 600, powerStart: 50, powerEnd: 65, label: 'Warm-up' },
    { duration: 300, powerStart: 100, powerEnd: 100 },
    { duration: 180, powerStart: 55, powerEnd: 55 },
    { duration: 300, powerStart: 100, powerEnd: 100 },
    { duration: 180, powerStart: 55, powerEnd: 55 },
    { duration: 600, powerStart: 55, powerEnd: 55, label: 'Cool-down' },
  ]
  it('groups a ride into Warmup / Nx / Cooldown blocks', () => {
    const t = nativeWorkoutText(ride, false)
    expect(t).toContain('Warmup')
    expect(t).toContain('2x') // the repeated [5m 100% / 3m 55%] block
    expect(t).toContain('Cooldown')
    expect(t).not.toContain('## Workout') // no more markdown wall
    // the 2x block collapses the 4 work steps into 2 lines
    expect((t.match(/100%/g) || []).length).toBe(1)
  })
  it('runs keep the "% pace" target on every step', () => {
    const run = [{ duration: 300, powerStart: 35, powerEnd: 45, label: 'Warm-up' }, { duration: 180, powerStart: 108, powerEnd: 108 }, { duration: 300, powerStart: 35, powerEnd: 35, label: 'Cool-down' }]
    const t = nativeWorkoutText(run, true)
    expect(t).toMatch(/\d+% pace/)
    expect(t).not.toMatch(/\d+\s*W\b/) // never watts on a run
    expect(t).not.toMatch(/\d+%(?!\s*pace)/) // every % target is a pace
  })
  it('no false repeat when the work is not periodic', () => {
    expect(detectRepeat([{ duration: 300, powerStart: 100, powerEnd: 100 }, { duration: 180, powerStart: 90, powerEnd: 90 }, { duration: 120, powerStart: 80, powerEnd: 80 }])).toBeNull()
  })
  it('empty segments → empty string', () => expect(nativeWorkoutText([], false)).toBe(''))
})

describe('#372 plannedTss — supply the planned load so intervals Form projects', () => {
  it('a flat 1h @ 90% ≈ 81 TSS (IF 0.9)', () => {
    const t = plannedTss([{ duration: 3600, powerStart: 90, powerEnd: 90 }])
    expect(t.if).toBeCloseTo(0.9, 1); expect(t.tss).toBeGreaterThan(78); expect(t.tss).toBeLessThan(84)
  })
  it('a 2h endurance @ 65% is a real load (~80+ TSS), not flat', () => {
    expect(plannedTss([{ duration: 7200, powerStart: 65, powerEnd: 65 }]).tss).toBeGreaterThan(80)
  })
  it('FTP-independent — % is the intensity factor', () => {
    expect(plannedTss([{ duration: 1200, powerStart: 100, powerEnd: 100 }]).tss).toBeCloseTo(33, 0) // 20min @ threshold ≈ 33 TSS
  })
  it('null on empty', () => expect(plannedTss([])).toBeNull())
})

describe('#378 stripPlatyplusLinks — the auto deep-link must never accumulate in notes', () => {
  it('strips BOTH a prod + a QA link, keeps the real note', () => {
    const polluted = '🏋️ Open workout in Platyplus → https://platyplus.duckdns.org/coach/x\n\n🏋️ Open workout in Platyplus → https://platyplus-qa.duckdns.org/coach/x\n\nMoved here from last week. TEMPO 3-1-1-0.'
    const out = stripPlatyplusLinks(polluted)
    expect(out).not.toMatch(/Open workout in Platyplus/)
    expect(out).toBe('Moved here from last week. TEMPO 3-1-1-0.')
  })
  it('leaves clean notes untouched + handles empty', () => {
    expect(stripPlatyplusLinks('Easy spin, keep it Z2.')).toBe('Easy spin, keep it Z2.')
    expect(stripPlatyplusLinks('')).toBe(''); expect(stripPlatyplusLinks(null)).toBe('')
  })
})

describe('#388 stripDerivedWorkout — the native workout text must never persist in notes (it doubled rides)', () => {
  const native = 'Warmup\n- 12m 50-72% Warm-up\n\n2x\n- 15m 90% Sweet Spot\n- 5m 58% Recovery\n\nCooldown\n- 8m 55-42% Cool-down'
  it('strips a full native block (headers + step lines)', () => {
    expect(stripDerivedWorkout(native)).toBe('')
  })
  it('strips the leaked native but KEEPS real prose notes', () => {
    const polluted = native + '\n\nFocus on smooth pedaling and stay aero on the sweet-spot blocks.'
    expect(stripDerivedWorkout(polluted)).toBe('Focus on smooth pedaling and stay aero on the sweet-spot blocks.')
  })
  it('run pace steps + legacy header too', () => {
    expect(stripDerivedWorkout('## Workout\n- 10m 90% pace\n- 5m 110% pace')).toBe('')
  })
  it('leaves a plain note alone + handles empty', () => {
    expect(stripDerivedWorkout('Recovery week — keep it easy, listen to your legs.')).toBe('Recovery week — keep it easy, listen to your legs.')
    expect(stripDerivedWorkout('')).toBe(''); expect(stripDerivedWorkout(null)).toBe('')
  })
})

// #414 — the orphan-GC safety gate. MUST be true for events Platyplus pushed, and — critically — MUST be false
// for an athlete's OWN intervals event, or the GC could delete real workouts (JM: a user's workouts can be 100%
// coach-made, so this is the last line of defence together with the "a plan claims it" checks + the count cap).
describe('isPlatyplusPushedEvent (#414)', () => {
  it('true when we set external_id (any sport)', () => {
    expect(isPlatyplusPushedEvent({ type: 'Ride', external_id: 'mcp-ab12', description: '' })).toBe(true)
    expect(isPlatyplusPushedEvent({ type: 'Run', external_id: 'plan_9', description: 'x' })).toBe(true)
    expect(isPlatyplusPushedEvent({ type: 'WeightTraining', external_id: 'g1' })).toBe(true)
  })
  it('true for our gym via the deep-link even without external_id', () => {
    expect(isPlatyplusPushedEvent({ type: 'WeightTraining', description: '🏋️ Open workout in Platyplus → https://platyplus.duckdns.org/coach/g1' })).toBe(true)
  })
  it('FALSE for an athlete-created event (no external_id, no deep-link) — never delete their own', () => {
    expect(isPlatyplusPushedEvent({ type: 'Ride', description: 'Morning spin' })).toBe(false)
    expect(isPlatyplusPushedEvent({ type: 'WeightTraining', description: 'Leg day at the gym' })).toBe(false)
    expect(isPlatyplusPushedEvent({ type: 'Run', external_id: '' })).toBe(false)
    expect(isPlatyplusPushedEvent({ type: 'Run', external_id: '   ' })).toBe(false)
  })
  it('FALSE on junk input', () => {
    expect(isPlatyplusPushedEvent(null)).toBe(false)
    expect(isPlatyplusPushedEvent(undefined)).toBe(false)
    expect(isPlatyplusPushedEvent('nope')).toBe(false)
  })
})
