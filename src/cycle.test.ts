import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { normalizePhase, phaseFromDay, cycleLoadModifier, cycleReadinessAdjust, cycleContext, phaseFromHistory, pregnancyStage, scrubPrivate } from '../server/cycle.js'

// #329 — menstrual-cycle factor for coaching + readiness.
describe('normalizePhase (intervals menstrualPhase text → canonical)', () => {
  it('maps common labels', () => {
    expect(normalizePhase('Period')).toBe('menstrual')
    expect(normalizePhase('follicular')).toBe('follicular')
    expect(normalizePhase('Ovulation')).toBe('ovulatory')
    expect(normalizePhase('luteal')).toBe('luteal')
    expect(normalizePhase('late luteal (PMS)')).toBe('late_luteal')
  })
  it('unknown/empty → null', () => { expect(normalizePhase('')).toBeNull(); expect(normalizePhase('xyz')).toBeNull() })
})

describe('phaseFromDay (28-day default + scaling)', () => {
  it('walks the phases across a 28-day cycle', () => {
    expect(phaseFromDay(1)).toBe('menstrual')
    expect(phaseFromDay(10)).toBe('follicular')
    expect(phaseFromDay(14)).toBe('ovulatory')
    expect(phaseFromDay(20)).toBe('luteal')
    expect(phaseFromDay(27)).toBe('late_luteal')
  })
  it('wraps days beyond the cycle length', () => { expect(phaseFromDay(29)).toBe('menstrual') })
  it('scales ovulation to a longer cycle', () => { expect(phaseFromDay(16, 32)).toBe('follicular') /* ovul ~day 18 in a 32d */ })
})

// #422 — derive today's phase from the last PERIOD marker when intervals only stamps the period start.
describe('phaseFromHistory (last PERIOD in wellness → current phase)', () => {
  // Xenia's real case: PERIOD logged 2026-07-03, every other day null → viewing 07-08 = cycle day 6.
  const xenia = [
    { date: '2026-07-01', menstrualPhase: null },
    { date: '2026-07-02', menstrualPhase: null },
    { date: '2026-07-03', menstrualPhase: 'PERIOD' },
    { date: '2026-07-04', menstrualPhase: null },
    { date: '2026-07-05', menstrualPhase: null },
    { date: '2026-07-06', menstrualPhase: null },
    { date: '2026-07-07', menstrualPhase: null },
    { date: '2026-07-08', menstrualPhase: null },
  ]
  it("derives follicular for Xenia's 07-08 from her 07-03 period (day 6)", () => {
    expect(phaseFromHistory(xenia, '2026-07-08')).toBe('follicular')
  })
  it('the period-start day itself is menstrual (day 1)', () => {
    expect(phaseFromHistory(xenia, '2026-07-03')).toBe('menstrual')
  })
  it('picks the MOST RECENT period marker, not an older one', () => {
    const rows = [{ date: '2026-06-05', menstrualPhase: 'PERIOD' }, { date: '2026-07-03', menstrualPhase: 'PERIOD' }]
    expect(phaseFromHistory(rows, '2026-07-04')).toBe('menstrual') // day 2 off the 07-03, not day ~29 off 06-05
  })
  it('returns null when there is no period marker', () => {
    expect(phaseFromHistory([{ date: '2026-07-01', menstrualPhase: null }], '2026-07-08')).toBeNull()
  })
  it('returns null when the last period is STALE (>1 cycle+10d ago) — do not project a phantom phase', () => {
    expect(phaseFromHistory([{ date: '2026-05-01', menstrualPhase: 'PERIOD' }], '2026-07-08')).toBeNull()
  })
  it('ignores markers AFTER the viewed date', () => {
    expect(phaseFromHistory([{ date: '2026-07-10', menstrualPhase: 'PERIOD' }], '2026-07-08')).toBeNull()
  })
})

// #427 — pregnancy gestational stage (gates the cycle logic OFF when pregnant).
describe('pregnancyStage (weeks + trimester)', () => {
  it('returns null when NOT pregnant (→ caller runs normal cycle logic)', () => {
    expect(pregnancyStage({}, '2026-07-08')).toBeNull()
    expect(pregnancyStage({ pregnant: false }, '2026-07-08')).toBeNull()
  })
  it('pregnant but no date → pregnant flag, weeks/trimester unknown (coach asks EDD)', () => {
    expect(pregnancyStage({ pregnant: true }, '2026-07-08')).toEqual({ pregnant: true, weeks: null, trimester: null, dueDate: null })
  })
  it('derives weeks + trimester from the due date (EDD)', () => {
    expect(pregnancyStage({ pregnant: true, dueDate: '2026-11-25' }, '2026-07-08')).toMatchObject({ weeks: 20, trimester: 2 })
  })
  it('derives weeks from LMP (pregnancyStart)', () => {
    expect(pregnancyStage({ pregnant: true, pregnancyStart: '2026-05-13' }, '2026-07-08')).toMatchObject({ weeks: 8, trimester: 1 })
  })
  it('trimester boundaries: <14=T1, 14-27=T2, >=28=T3', () => {
    expect(pregnancyStage({ pregnant: true, pregnancyStart: '2026-04-08' }, '2026-07-08')!.trimester).toBe(1) // 13 wk
    expect(pregnancyStage({ pregnant: true, pregnancyStart: '2026-03-11' }, '2026-07-08')!.trimester).toBe(2) // 17 wk
    expect(pregnancyStage({ pregnant: true, pregnancyStart: '2025-12-01' }, '2026-07-08')!.trimester).toBe(3) // 31 wk
  })
})

describe('load modifier — push in follicular, ease late-luteal', () => {
  it('follicular ≥ 1, late-luteal well below 1, ordering holds', () => {
    expect(cycleLoadModifier('follicular')).toBeGreaterThanOrEqual(1)
    expect(cycleLoadModifier('late_luteal')).toBeLessThan(cycleLoadModifier('luteal'))
    expect(cycleLoadModifier('luteal')).toBeLessThanOrEqual(1)
  })
})

describe('readiness adjust — luteal expects higher RHR / lower HRV (don\'t penalise)', () => {
  it('late-luteal shift is the largest', () => {
    expect(cycleReadinessAdjust('late_luteal').rhrBpm).toBeGreaterThan(cycleReadinessAdjust('luteal').rhrBpm)
    expect(cycleReadinessAdjust('follicular')).toEqual({ rhrBpm: 0, hrvPct: 0 })
  })
})

describe('cycleContext', () => {
  it('from an intervals phase string', () => {
    const c = cycleContext({ phase: 'Luteal' })
    expect(c.phase).toBe('luteal'); expect(c.loadModifier).toBe(0.95); expect(c.guidance).toMatch(/luteal/i)
  })
  it('from a cycle day when no phase text', () => {
    expect(cycleContext({ cycleDay: 3 }).phase).toBe('menstrual')
  })
  it('null when nothing known', () => expect(cycleContext({})).toBeNull())
})

describe('#650 scrubPrivate — pregnancy/postpartum never reaches a title or public text', () => {
  it('strips pregnancy terms and tidies the leftover', () => {
    expect(scrubPrivate('Prenatal Strength Circuit')).toBe('Strength Circuit')
    expect(scrubPrivate('Easy Z2 (safe in pregnancy)')).toBe('Easy Z2 (safe in)')
    expect(scrubPrivate('Second trimester maintenance ride')).toBe('Second maintenance ride') // only the sensitive word goes
    expect(scrubPrivate('Postpartum return run')).toBe('return run')
    expect(scrubPrivate('Trimester 2 tempo')).toBe('2 tempo')
  })
  it('leaves normal training copy untouched — no false positives', () => {
    expect(scrubPrivate('Sweet-Spot 3×12')).toBe('Sweet-Spot 3×12')
    expect(scrubPrivate('Bump up the pace on the last rep')).toBe('Bump up the pace on the last rep') // bare "bump" is safe
    expect(scrubPrivate('Expecting a hard effort today')).toBe('Expecting a hard effort today') // "expecting" not scrubbed
    expect(scrubPrivate('Easy Aerobic Run')).toBe('Easy Aerobic Run')
  })
  it('handles empty / non-strings safely', () => {
    expect(scrubPrivate('')).toBe('')
    expect(scrubPrivate(undefined)).toBe(undefined)
    expect(scrubPrivate(null)).toBe(null)
  })
})
