import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module
import { periodizationPhase, BLOCK_PHASES } from '../server/periodization.js'

describe('#626 periodization — the meso-cycle the coach progresses through', () => {
  it('rolls build → build → peak → recovery across the 4-week block', () => {
    const phases = [0, 1, 2, 3].map((w) => periodizationPhase({ ctl: 60, weeksSinceAnchor: w }).phase)
    expect(phases).toEqual(['build', 'build', 'peak', 'recovery'])
  })

  it('wraps — week 4 is a new build week (block repeats)', () => {
    expect(periodizationPhase({ ctl: 60, weeksSinceAnchor: 4 }).phase).toBe('build')
    expect(periodizationPhase({ ctl: 60, weeksSinceAnchor: 7 }).phase).toBe('recovery')
  })

  it('load PROGRESSES then RECOVERS: the two build weeks RAMP, peak is biggest, recovery smallest', () => {
    const build1 = periodizationPhase({ ctl: 60, weeksSinceAnchor: 0 }).target
    const build2 = periodizationPhase({ ctl: 60, weeksSinceAnchor: 1 }).target
    const peak = periodizationPhase({ ctl: 60, weeksSinceAnchor: 2 }).target
    const recovery = periodizationPhase({ ctl: 60, weeksSinceAnchor: 3 }).target
    expect(build2).toBeGreaterThan(build1) // #629 — real week-over-week ramp, not two identical build weeks
    expect(peak).toBeGreaterThanOrEqual(build2)
    expect(recovery).toBeLessThan(build1)
  })

  it('an A-race within 2 weeks OVERRIDES the cycle with a taper (volume drops toward race week)', () => {
    const twoOut = periodizationPhase({ ctl: 60, weeksSinceAnchor: 2, weeksToRace: 2 })
    const oneOut = periodizationPhase({ ctl: 60, weeksSinceAnchor: 2, weeksToRace: 1 })
    const raceWk = periodizationPhase({ ctl: 60, weeksSinceAnchor: 2, weeksToRace: 0 })
    expect([twoOut.phase, oneOut.phase, raceWk.phase]).toEqual(['taper', 'taper', 'taper'])
    expect(oneOut.target).toBeLessThan(twoOut.target) // volume keeps dropping
    expect(raceWk.target).toBeLessThan(oneOut.target) // race week is the lightest
  })

  it('a race still 3+ weeks out does NOT taper — normal cycle applies', () => {
    expect(periodizationPhase({ ctl: 60, weeksSinceAnchor: 0, weeksToRace: 4 }).phase).toBe('build')
  })

  it('masters/teen get a GENTLER peak (submaximal) + a DEEPER recovery than an adult', () => {
    const adultPeak = periodizationPhase({ ctl: 60, weeksSinceAnchor: 2 }).target
    const mastersPeak = periodizationPhase({ ctl: 60, weeksSinceAnchor: 2, ageYears: 60 }).target
    const teenPeak = periodizationPhase({ ctl: 60, weeksSinceAnchor: 2, ageYears: 15 }).target
    expect(mastersPeak).toBeLessThan(adultPeak) // no true overload week for masters
    expect(teenPeak).toBeLessThan(adultPeak)
    const adultRec = periodizationPhase({ ctl: 60, weeksSinceAnchor: 3 }).target
    const mastersRec = periodizationPhase({ ctl: 60, weeksSinceAnchor: 3, ageYears: 60 }).target
    expect(mastersRec).toBeLessThan(adultRec) // deeper recovery week
  })

  it('no CTL → phases still compute (targets null, so the coach reasons from Form instead)', () => {
    const p = periodizationPhase({ ctl: null, weeksSinceAnchor: 2 })
    expect(p.phase).toBe('peak')
    expect(p.target).toBeNull()
  })

  it('BLOCK_PHASES documents the 4-week shape', () => {
    expect(BLOCK_PHASES).toEqual(['build', 'build', 'peak', 'recovery'])
  })
})
