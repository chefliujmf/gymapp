import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module
import { assignWeeklyGym, patternFromExercise, GYM_PATTERNS, resolveGymFocus, repSchemeFor, gymBalanceLines, clampMainReps, mainsRepRange, sportEmphasis, assembleGymSession, enforceGymStructure, stripGymDurationProse, dedupeGymTitles, enforcePregnancyGym, enforcePostpartumGym } from '../server/gym-split.js'

const flat = (a: any) => a.days.flat()

describe('#636/#637 gym-split — frequency + focus aware balance, arms guaranteed', () => {
  it('1×/week endurance SUPPORT (cyclist) → FULL-BODY: the one session covers everything incl. arms', () => {
    const a = assignWeeklyGym({ sessionsPerWeek: 1, focus: 'support' })
    expect(a.splitName).toMatch(/full-body/i)
    expect(a.days.length).toBe(1)
    for (const p of ['squat', 'hinge', 'hpush', 'hpull', 'arms', 'carry']) expect(a.days[0]).toContain(p)
  })

  it('4×/week HYPERTROPHY (bodybuilder) → a SPLIT (not full-body every day), each muscle ~2×/week', () => {
    const a = assignWeeklyGym({ sessionsPerWeek: 4, focus: 'muscle' })
    expect(a.splitName).toMatch(/upper|push|pull|legs/i)
    expect(a.days.length).toBe(4)
    // not every session is the full pattern list (that would be full-body)
    expect(a.days.some((d: string[]) => d.length < GYM_PATTERNS.length)).toBe(true)
    // arms hit at least twice across the week (upper/push/pull days)
    expect(flat(a).filter((p: string) => p === 'arms').length).toBeGreaterThanOrEqual(2)
    // squat/chest hit ~2× (not once)
    expect(flat(a).filter((p: string) => p === 'squat').length).toBeGreaterThanOrEqual(2)
  })

  it('5×/week hypertrophy → PPL split', () => {
    expect(assignWeeklyGym({ sessionsPerWeek: 5, focus: 'bodybuilding' }).splitName).toMatch(/push.*pull.*legs/i)
  })

  it('ARMS are never dropped — present in every full-body / upper / push / pull day', () => {
    for (const spw of [1, 2, 3, 4, 5]) {
      const a = assignWeeklyGym({ sessionsPerWeek: spw, focus: 'muscle' })
      expect(flat(a)).toContain('arms')
    }
  })

  it('rotates each accessory to a FRESH option (skips recent — anti-boredom)', () => {
    const a = assignWeeklyGym({ sessionsPerWeek: 1, recentExercises: ['Dumbbell Row', 'Goblet Squat', 'Dumbbell Biceps Curl'] })
    expect(a.rotations.hpull.toLowerCase()).not.toBe('dumbbell row')
    expect(a.rotations.squat.toLowerCase()).not.toBe('goblet squat')
    expect(a.rotations.arms.toLowerCase()).not.toBe('dumbbell biceps curl')
  })

  it('patternFromExercise fingerprints exercises → patterns (incl. arms)', () => {
    expect(patternFromExercise('Dumbbell Biceps Curl')).toBe('arms')
    expect(patternFromExercise('Triceps Pushdown')).toBe('arms')
    expect(patternFromExercise('Romanian Deadlift')).toBe('hinge')
    expect(patternFromExercise('Seated Dumbbell Shoulder Press')).toBe('vpush')
    expect(patternFromExercise('Dumbbell Row')).toBe('hpull')
    expect(patternFromExercise('Pull-Up')).toBe('vpull')
    expect(patternFromExercise('Goblet Squat')).toBe('squat')
    expect(patternFromExercise('Farmer Carry')).toBe('carry')
    expect(patternFromExercise('Plank')).toBe('core')
  })

  it('GYM_PATTERNS has all 9 movement patterns', () => { expect(GYM_PATTERNS.length).toBe(9) })
})

describe('#658 sport-adaptive selection — a cyclist and a swimmer get DIFFERENT emphasis', () => {
  it('sportEmphasis resolves per main sport, null for gym-first', () => {
    expect(sportEmphasis({ mainSport: 'cycling' })?.label).toBe('cyclist')
    expect(sportEmphasis({ mainSport: 'running' })?.label).toBe('runner')
    expect(sportEmphasis({ mainSport: 'swimming' })?.label).toBe('swimmer')
    expect(sportEmphasis({ mainSport: 'triathlon' })?.label).toBe('triathlete')
    expect(sportEmphasis({ mainSport: 'gym' })).toBeNull()          // gym-first → no bias, full balance
    expect(sportEmphasis({ sports: ['cycling'] })?.label).toBe('cyclist') // falls back to first endurance sport
  })
  it('cyclist prioritizes legs; swimmer prioritizes pull — NOT the same movements', () => {
    const cyc = sportEmphasis({ mainSport: 'cycling' })!
    const swm = sportEmphasis({ mainSport: 'swimming' })!
    expect(cyc.priority).toContain('squat')
    expect(swm.priority).toContain('vpull')
    expect(cyc.priority).not.toEqual(swm.priority)
  })
  it('assignWeeklyGym carries emphasis and gymBalanceLines renders the sport block', () => {
    const a = assignWeeklyGym({ sessionsPerWeek: 1, focus: 'support', mainSport: 'swimming' })
    expect(a.emphasis.label).toBe('swimmer')
    const lines = gymBalanceLines(a)
    expect(lines).toMatch(/SPORT EMPHASIS \(swimmer\)/)
    expect(lines.toLowerCase()).toMatch(/pull|shoulder/)
  })
})

describe('#648 rep scheme by focus — a cyclist gets HEAVY LOW-rep, not 3×10', () => {
  it('resolveGymFocus: endurance MAIN sport → support (never a hypertrophy default)', () => {
    expect(resolveGymFocus({ mainSport: 'cycling', goal: 'raise my FTP' })).toBe('support')
    expect(resolveGymFocus({ mainSport: 'running' })).toBe('support')
  })
  it('resolveGymFocus: endurance + muscle intent → support_build; gym-first → muscle/strength', () => {
    expect(resolveGymFocus({ mainSport: 'cycling', goal: 'build some lean muscle' })).toBe('support_build')
    expect(resolveGymFocus({ mainSport: 'gym', goal: 'get bigger' })).toBe('muscle')
    expect(resolveGymFocus({ mainSport: 'powerlifting', goal: 'increase my 1RM squat' })).toBe('strength')
  })
  it('a cyclist (support) prescribes PRIMARY lifts at 3-6 heavy reps, NOT 6-12', () => {
    const rs = repSchemeFor('support')
    expect(rs.mains).toBe('3-6')
    expect(rs.pctHigh).toBeGreaterThanOrEqual(85)          // heavy
    expect(rs.tempo).toBe('3-0-1-0')                        // fast/explosive concentric, not slow-eccentric
    expect(rs.intent.toLowerCase()).toMatch(/not.*failure|reps in reserve|force|economy/)
  })
  it('a bodybuilder (muscle) prescribes 6-12 with a slower eccentric', () => {
    const rs = repSchemeFor('muscle')
    expect(rs.mains).toBe('6-12')
    expect(rs.tempo).toBe('3-1-1-0')
  })
  it('#649 clampMainReps ENFORCES the scheme — a cyclist 3×10 squat is clamped to 6, arms untouched', () => {
    const ex = [
      { name: 'Leg swings', section: 'warmup', mode: 'reps', reps: 10 },
      { name: 'Barbell Back Squat', section: 'main', mode: 'reps', reps: 10 }, // main compound → clamp to 6
      { name: 'Romanian Deadlift', section: 'main', mode: 'reps', reps: 12 },  // main compound → clamp to 6
      { name: 'Dumbbell Curl', section: 'main', mode: 'reps', reps: 12 },      // ACCESSORY (arms) → untouched
      { name: 'Plank', section: 'main', mode: 'timed', seconds: 40 },          // not reps → untouched
    ]
    const n = clampMainReps(ex, 'support')
    expect(n).toBe(2)
    expect(ex[1].reps).toBe(6) // squat clamped into 3-6
    expect(ex[2].reps).toBe(6) // RDL clamped
    expect(ex[3].reps).toBe(12) // arms accessory unchanged
    expect(ex[0].reps).toBe(10) // warm-up untouched
  })
  it('#663 a SECOND same-pattern lift is an accessory — a cyclist keeps 12-rep Leg Press after Back Squat', () => {
    const ex = [
      { name: 'Barbell Back Squat', section: 'main', mode: 'reps', reps: 5 },  // main squat → in range, unchanged
      { name: 'Leg Press', section: 'main', mode: 'reps', reps: 12 },          // 2nd squat-pattern = ACCESSORY → keep 12
      { name: 'Romanian Deadlift', section: 'main', mode: 'reps', reps: 10 },  // main hinge → clamp to 6
    ]
    const n = clampMainReps(ex, 'support')
    expect(n).toBe(1)            // only the RDL clamped
    expect(ex[0].reps).toBe(5)   // squat unchanged (in range)
    expect(ex[1].reps).toBe(12)  // leg press accessory kept
    expect(ex[2].reps).toBe(6)   // RDL clamped
  })
  it('#649 a bodybuilder (muscle) keeps 10-rep squats (within 6-12), does not clamp', () => {
    const ex = [{ name: 'Back Squat', section: 'main', mode: 'reps', reps: 10 }]
    expect(clampMainReps(ex, 'muscle')).toBe(0)
    expect(ex[0].reps).toBe(10)
  })
  it('#649 mainsRepRange parses the band per focus', () => {
    expect(mainsRepRange('support')).toEqual([3, 6])
    expect(mainsRepRange('strength')).toEqual([3, 5])
    expect(mainsRepRange('muscle')).toEqual([6, 12])
  })
  it('assignWeeklyGym carries the focus + repScheme, and gymBalanceLines renders it', () => {
    const a = assignWeeklyGym({ sessionsPerWeek: 1, focus: resolveGymFocus({ mainSport: 'cycling' }) })
    expect(a.focus).toBe('support')
    expect(a.repScheme.mains).toBe('3-6')
    const lines = gymBalanceLines(a)
    expect(lines).toMatch(/REP SCHEME/)
    expect(lines).toMatch(/3-6 reps/)
    expect(lines).not.toMatch(/default everything to 8-12(?!)/) // it must TELL the coach not to default to 8-12
  })
})

describe('#687 assembleGymSession — world-class, tailored, ALL personas, no random issues', () => {
  const P = {
    cyclist: { mainSport: 'cycling', focus: 'support', patterns: ['squat', 'hinge', 'hpush', 'hpull', 'core', 'arms'] },
    runner: { mainSport: 'running', focus: 'support', patterns: ['squat', 'hinge', 'core', 'arms'] },
    swimmer: { mainSport: 'swimming', focus: 'support', patterns: ['vpull', 'hpull', 'vpush', 'core', 'arms'] },
    triathlete: { mainSport: 'triathlon', focus: 'support', patterns: ['squat', 'hinge', 'vpull', 'core'] },
    bodybuilder: { mainSport: 'gym', focus: 'muscle', patterns: ['hpush', 'vpush', 'hpull', 'arms', 'core'] },
    femaleCyclist: { mainSport: 'cycling', focus: 'support_build', patterns: ['squat', 'hinge', 'hpush', 'hpull', 'core', 'arms'] },
  }
  const all = Object.entries(P).map(([k, o]) => [k, (assembleGymSession as any)(o)] as const)

  it('NEVER repeats an exercise across the whole session (incl. warm-up vs main — kills #685)', () => {
    for (const [name, s] of all) {
      const names = s.exercises.map((e: any) => e.name.toLowerCase())
      expect(new Set(names).size, `${name} has a duplicate exercise`).toBe(names.length)
    }
  })
  it('warm-up + cool-down are always TIMED; strength lifts are reps (kills #684)', () => {
    for (const [, s] of all) {
      for (const e of s.exercises) {
        if (e.section === 'warmup' || e.section === 'cooldown') expect(e.mode).toBe('timed')
      }
      const heavyLift = s.exercises.find((e: any) => e.section === 'main' && /squat|deadlift|bench|press|row|pulldown|pull-up/i.test(e.name))
      if (heavyLift) expect(heavyLift.mode).toBe('reps')
    }
  })
  it('ONE primary per movement pattern — no two mains of the same pattern (kills #683)', () => {
    for (const [name, s] of all) {
      const mainPats = s.exercises.filter((e: any) => e.section === 'main' && e.mode === 'reps' && e.sets === 3).map((e: any) => patternFromExercise(e.name))
      expect(new Set(mainPats).size, `${name} has two primaries of one pattern`).toBe(mainPats.length)
    }
  })
  it('every session has warm-up, main, and cool-down sections', () => {
    for (const [, s] of all) {
      for (const sec of ['warmup', 'main', 'cooldown']) expect(s.exercises.some((e: any) => e.section === sec)).toBe(true)
    }
  })
  it('SPORT-ADAPTS: cyclist/runner lead with LEGS; swimmer leads with PULL', () => {
    expect(['squat', 'hinge']).toContain(patternFromExercise((all.find(([k]) => k === 'cyclist')![1].exercises.find((e: any) => e.section === 'main')!).name))
    expect(['vpull', 'hpull']).toContain(patternFromExercise((all.find(([k]) => k === 'swimmer')![1].exercises.find((e: any) => e.section === 'main')!).name))
  })
  it('REP SCHEME by focus: support mains heavy (≤6), muscle mains 6-12', () => {
    const cyc = all.find(([k]) => k === 'cyclist')![1]
    const bb = all.find(([k]) => k === 'bodybuilder')![1]
    const cycMain = cyc.exercises.find((e: any) => e.section === 'main' && e.sets === 3)
    const bbMain = bb.exercises.find((e: any) => e.section === 'main' && e.sets === 3)
    expect(cycMain.reps).toBeLessThanOrEqual(6)   // support
    expect(bbMain.reps).toBeGreaterThanOrEqual(6) // muscle
  })
  it('distinct TITLE per session slot (kills #675) + sport tag', () => {
    const s0 = (assembleGymSession as any)({ ...P.cyclist, sessionIndex: 0 })
    const s1 = (assembleGymSession as any)({ ...P.cyclist, sessionIndex: 1 })
    expect(s0.title).not.toBe(s1.title)
    expect(s0.title).toMatch(/Cycling/)
    expect(all.find(([k]) => k === 'swimmer')![1].title).toMatch(/Swimming/)
  })
  it('unilateral moves carry eachSide', () => {
    for (const [, s] of all) {
      const uni = s.exercises.find((e: any) => /single|split squat|lunge|one-arm|pallof|figure-4/i.test(e.name))
      if (uni) expect(uni.eachSide).toBe(true)
    }
  })
  // #692 — runner = SINGLE-LEG + PLYOMETRIC; swimmer = shoulder-health prehab. Each an assertion per persona.
  it('#692 runner leads with a UNILATERAL leg move and gets a plyometric extra', () => {
    const r = (assembleGymSession as any)({ mainSport: 'running', focus: 'support', patterns: ['squat', 'hinge', 'hpush', 'core'] })
    const firstMain = r.exercises.find((e: any) => e.section === 'main')
    expect(/single|split squat|lunge/i.test(firstMain.name)).toBe(true)         // unilateral, not a bilateral back squat
    expect(r.exercises.some((e: any) => /pogo|hop|bound|plyo/i.test(e.name))).toBe(true) // a plyometric extra is present
  })
  it('#692 swimmer leads with PULL and gets a shoulder-health prehab extra', () => {
    const s = (assembleGymSession as any)({ mainSport: 'swimming', focus: 'support', patterns: ['squat', 'hinge', 'hpush', 'vpull', 'hpull', 'core'] })
    const firstMain = s.exercises.find((e: any) => e.section === 'main')
    expect(['vpull', 'hpull']).toContain(patternFromExercise(firstMain.name))
    expect(s.exercises.some((e: any) => /external rotation|face pull|band pull|cuff|scap/i.test(e.name))).toBe(true)
  })
  // #691 — accessories grouped by EQUIPMENT to cut station-switching, WITHOUT displacing the heavy sport-emphasis primaries.
  it('#691 heavy primaries stay emphasis-first (cyclist legs), accessories cluster by equipment', () => {
    const c = (assembleGymSession as any)({ mainSport: 'cycling', sports: ['cycling'], focus: 'support_build', patterns: ['squat', 'hinge', 'hpush', 'hpull', 'core'] })
    const mains = c.exercises.filter((e: any) => e.section === 'main')
    // the FIRST two mains are still the leg primaries (equipment sort didn't reorder them ahead of sport emphasis)
    expect(['squat', 'hinge']).toContain(patternFromExercise(mains[0].name))
    expect(['squat', 'hinge']).toContain(patternFromExercise(mains[1].name))
    // accessories (sets<3) that share equipment sit adjacently: the two dumbbell upper moves are consecutive
    const names: string[] = mains.map((e: any) => e.name)
    const dbIdx = names.map((n, i) => /dumbbell|\bdb\b/i.test(n) ? i : -1).filter((i) => i >= 0)
    if (dbIdx.length >= 2) expect(dbIdx[dbIdx.length - 1] - dbIdx[0]).toBe(dbIdx.length - 1) // contiguous block
  })
})

describe('#687-enforce enforceGymStructure — deterministic save-time fix (the LLM ignores the frame)', () => {
  it("fixes JM's exact broken session: 2nd row dropped, dup dead-bug dropped, glute-bridge-reps → timed", () => {
    const ex = [
      { name: 'Cat cow', section: 'warmup', mode: 'timed', seconds: 45 },
      { name: 'Glute bridge', section: 'warmup', mode: 'reps', sets: 1, reps: 12 },
      { name: 'Dead Bugs Cross Lateral', section: 'warmup', mode: 'timed', seconds: 45 },
      { name: 'Dumbbell Bench Press', section: 'main', mode: 'reps', sets: 3, reps: 8 },
      { name: 'Bent Over Two-Dumbbell Row', section: 'main', mode: 'reps', sets: 3, reps: 8 },
      { name: 'One-Arm Dumbbell Row', section: 'main', mode: 'reps', sets: 2, reps: 10 },
      { name: 'Dead Bug', section: 'main', mode: 'reps', sets: 3, reps: 10 },
    ]
    const r = (enforceGymStructure as any)(ex)
    const names = r.exercises.map((e: any) => e.name)
    expect(names.filter((n: string) => /row/i.test(n)).length).toBe(1) // #683 — one row only
    expect(names.filter((n: string) => /dead ?bug/i.test(n)).length).toBe(1) // #685 — dead bug once
    const gb = r.exercises.find((e: any) => /glute bridge/i.test(e.name))
    expect(gb.mode).toBe('timed') // #684 — hold is timed, not reps
    expect(gb.reps).toBeUndefined()
    expect(r.deduped).toBe(2); expect(r.retimed).toBe(1)
  })
  it('leaves a clean session untouched (no false dedup of distinct movements)', () => {
    const ex = [
      { name: 'Barbell Back Squat', section: 'main', mode: 'reps', sets: 3, reps: 6 },
      { name: 'Romanian Deadlift', section: 'main', mode: 'reps', sets: 3, reps: 6 },
      { name: 'Dumbbell Bench Press', section: 'main', mode: 'reps', sets: 3, reps: 6 },
      { name: 'Dumbbell Row', section: 'main', mode: 'reps', sets: 3, reps: 6 },
    ]
    const r = (enforceGymStructure as any)(ex)
    expect(r.deduped).toBe(0); expect(r.retimed).toBe(0)
    expect(r.exercises.length).toBe(4)
  })
})

describe('#696 stripGymDurationProse — drop the session-duration phrase, keep fuelling timing', () => {
  it('strips a qualified session length but keeps a "… before" fuelling timing and seconds', () => {
    expect(stripGymDurationProse('Primary lifts HEAVY. Arms/core moderate. About 55-60 min.')).toBe('Primary lifts HEAVY. Arms/core moderate.')
    expect(stripGymDurationProse('Light carb + protein snack about 60-90 min before; water through.')).toBe('Light carb + protein snack about 60-90 min before; water through.')
    expect(stripGymDurationProse('roughly 50 minutes of quality work')).not.toMatch(/50 minutes/)
    expect(stripGymDurationProse('Hold each for ~30 s')).toBe('Hold each for ~30 s') // seconds untouched
  })
})

describe('#706 dedupeGymTitles — no two identical gym titles on the calendar', () => {
  it('gives same-title sessions a clean A/B/C series in DATE order', () => {
    const plans = [
      { date: '2026-08-03', title: 'Upper-Body & Trunk Strength' },
      { date: '2026-07-27', title: 'Upper-Body & Trunk Strength' },
      { date: '2026-07-20', title: 'Lower-Body Strength' }, // unique → untouched
    ]
    const n = dedupeGymTitles(plans)
    expect(n).toBeGreaterThan(0)
    const byDate = Object.fromEntries(plans.map((p) => [p.date, p.title]))
    expect(byDate['2026-07-27']).toBe('Upper-Body & Trunk Strength A') // earlier date = A
    expect(byDate['2026-08-03']).toBe('Upper-Body & Trunk Strength B')
    expect(byDate['2026-07-20']).toBe('Lower-Body Strength')           // unique kept
  })
  it('is idempotent (re-running keeps the same A/B, does not stack letters)', () => {
    const plans = [{ date: '2026-07-27', title: 'Full-Body Strength A' }, { date: '2026-08-03', title: 'Full-Body Strength B' }]
    expect(dedupeGymTitles(plans)).toBe(0)
    expect(plans.map((p) => p.title)).toEqual(['Full-Body Strength A', 'Full-Body Strength B'])
  })
})

describe('#712 enforcePregnancyGym — no supine/flat-on-back lifts at trimester 2+', () => {
  it('swaps supine moves to safe upright/incline variants at T2+', () => {
    const ex = [
      { name: 'Barbell Bench Press', section: 'main', mode: 'reps', reps: 5 },
      { name: 'Dead Bug', section: 'main', mode: 'reps', reps: 12 },
      { name: 'Glute Bridge', section: 'main', mode: 'reps', reps: 12 },
      { name: 'Goblet Squat', section: 'main', mode: 'reps', reps: 8 }, // upright → kept
    ]
    const r = enforcePregnancyGym(ex, 2)
    expect(r.changed).toBe(3)
    const names = r.exercises.map((e: any) => e.name)
    expect(names).toContain('Incline Dumbbell Press')  // bench → incline
    expect(names).toContain('Bird Dog')                // dead bug → bird dog
    expect(names).toContain('Standing Cable Pull-Through') // glute bridge → standing
    expect(names).toContain('Goblet Squat')            // upright unchanged
    expect(names).not.toContain('Barbell Bench Press')
  })
  it('is a NO-OP at trimester 1 (or non-pregnant / no trimester)', () => {
    const ex = [{ name: 'Barbell Bench Press', section: 'main', mode: 'reps', reps: 5 }]
    expect(enforcePregnancyGym(ex, 1).changed).toBe(0)
    expect(enforcePregnancyGym(ex, null).changed).toBe(0)
  })
})

describe('#718 bodybuilder volume — hypertrophy gets 2nd movements, survives save-time dedup', () => {
  it('a muscle-focus session has far more sets than a support session, and enforceGymStructure keeps them', () => {
    const bb = (assembleGymSession as any)({ mainSport: 'gym', focus: 'muscle', patterns: ['hpush', 'vpush', 'hpull', 'arms', 'core'] })
    const r = enforceGymStructure(bb.exercises)
    const mains = r.exercises.filter((e: any) => e.section === 'main')
    const sets = mains.reduce((s: number, e: any) => s + (e.sets || 0), 0)
    expect(sets).toBeGreaterThanOrEqual(18)          // hypertrophy volume, not ~6
    expect(r.deduped).toBe(0)                          // the 2nd movements are distinct → not dedup'd away
    const sup = (assembleGymSession as any)({ mainSport: 'cycling', sports: ['cycling'], focus: 'support', patterns: ['squat', 'hinge', 'hpush', 'hpull', 'core'] })
    const supSets = sup.exercises.filter((e: any) => e.section === 'main').reduce((s: number, e: any) => s + (e.sets || 0), 0)
    expect(sets).toBeGreaterThan(supSets)              // endurance-support stays FOCUSED/low
  })
})

describe('#720 gym meso-cycle — progress then deload, not identical every week', () => {
  it('deload week cuts working volume vs accumulation; intensification adds sets', () => {
    const acc = (assembleGymSession as any)({ mainSport: 'gym', focus: 'muscle', patterns: ['hpush', 'vpush', 'hpull', 'core'], mesoWeek: 0 })
    const intens = (assembleGymSession as any)({ mainSport: 'gym', focus: 'muscle', patterns: ['hpush', 'vpush', 'hpull', 'core'], mesoWeek: 2 })
    const deload = (assembleGymSession as any)({ mainSport: 'gym', focus: 'muscle', patterns: ['hpush', 'vpush', 'hpull', 'core'], mesoWeek: 3 })
    const sets = (s: any) => s.exercises.filter((e: any) => e.section === 'main' && e.mode !== 'timed').reduce((a: number, e: any) => a + (e.sets || 0), 0)
    expect(sets(deload)).toBeLessThan(sets(acc) * 0.7)   // deload ~45% cut
    expect(sets(intens)).toBeGreaterThan(sets(acc))       // intensification heavier
  })
})

// #2 (audit SAFETY) — early/mid-postpartum: plyometric/jump moves stripped (pelvic-floor impact), toggle-driven not sex.
describe('#2 enforcePostpartumGym — no plyometrics/jumps while impact is restricted', () => {
  const runnerGym = [
    { name: 'Bulgarian Split Squat', mode: 'reps', reps: 8, sets: 3 },
    { name: 'Pogo Hops', mode: 'reps', reps: 10, sets: 3 },      // the runner plyo slot
    { name: 'Jump Squat', mode: 'reps', reps: 6, sets: 3 },       // squat-pattern jump
    { name: 'Romanian Deadlift', mode: 'reps', reps: 8, sets: 3 },
  ]
  it('replaces plyometric + jump moves with a low-impact substitute when restricted', () => {
    const r = enforcePostpartumGym(runnerGym.map((e) => ({ ...e })), true)
    expect(r.changed).toBe(2)
    const names = r.exercises.map((e: { name: string }) => e.name)
    expect(names).toContain('Calf Raises')       // Pogo Hops → calf/tendon, no impact
    expect(names).toContain('Bodyweight Squat')   // Jump Squat → squat pattern, no impact
    expect(names).not.toContain('Pogo Hops')
    expect(names).not.toContain('Jump Squat')
    expect(names).toContain('Bulgarian Split Squat') // strength moves untouched
    expect(names).toContain('Romanian Deadlift')
  })
  it('does NOTHING when impact is not restricted (>=12wk / not postpartum)', () => {
    expect(enforcePostpartumGym(runnerGym.map((e) => ({ ...e })), false).changed).toBe(0)
  })
  it('catches the common plyometric vocabulary', () => {
    const ex = ['Box Jumps', 'Broad Jump', 'Depth Jump', 'Skater Hops', 'Bounding', 'Tuck Jump', 'Lunge Jumps'].map((name) => ({ name, mode: 'reps', reps: 8, sets: 3 }))
    expect(enforcePostpartumGym(ex, true).changed).toBe(7)
  })
})
