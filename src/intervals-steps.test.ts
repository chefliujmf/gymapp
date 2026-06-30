import { describe, it, expect } from 'vitest'
import { stepPctFtp, flattenIcuSteps } from './intervals'

// Regression for the "5 W" bug: intervals' `{units:'power_zone', value:2}` step ("ride in
// Zone 2 = endurance") was read as 2% FTP → ~5 W. It must resolve to a realistic %FTP.
describe('stepPctFtp', () => {
  it('%ftp ramp keeps start/end', () => expect(stepPctFtp({ start: 50, end: 65, units: '%ftp' })).toEqual({ start: 50, end: 65 }))
  it('steady %ftp uses value for both ends', () => expect(stepPctFtp({ value: 75, units: '%ftp' })).toEqual({ start: 75, end: 75 }))
  it('power_zone 2 → ~65% FTP flat (endurance), not 2%', () => {
    expect(stepPctFtp({ units: 'power_zone', value: 2 })).toEqual({ start: 65, end: 65, label: 'Z2' })
  })
  it('every zone 1–7 maps into a sane %FTP band', () => {
    for (let z = 1; z <= 7; z++) { const r = stepPctFtp({ units: 'power_zone', value: z }); expect(r.start).toBeGreaterThanOrEqual(50); expect(r.start).toBeLessThanOrEqual(160); expect(r.label).toBe(`Z${z}`) }
  })
  it('higher zone → higher %FTP', () => expect(stepPctFtp({ units: 'power_zone', value: 4 }).start).toBeGreaterThan(stepPctFtp({ units: 'power_zone', value: 2 }).start))
  it('missing power → 0/0 (not NaN)', () => expect(stepPctFtp(undefined)).toEqual({ start: 0, end: 0 }))
})

describe('flattenIcuSteps — tomorrow\'s real workout (was 175 W then 5 W)', () => {
  // exact shape pulled from intervals for the "Tuesday Cottage Ride"
  const steps = [
    { duration: 600, power: { start: 50, end: 65, units: '%ftp' } },
    { duration: 3300, power: { units: 'power_zone', value: 2 } },
    { duration: 600, power: { start: 48, end: 58, units: '%ftp' } },
  ]
  const segs = flattenIcuSteps(steps)
  it('warmup ramp intact', () => expect(segs[0]).toMatchObject({ duration: 600, powerStart: 50, powerEnd: 65 }))
  it('the Zone-2 block is a realistic endurance block, NOT 5 W', () => {
    expect(segs[1]).toMatchObject({ duration: 3300, powerStart: 65, powerEnd: 65, label: 'Z2' })
    expect(segs[1].powerStart).toBeGreaterThan(50) // i.e. ~169 W at 260 FTP, not ~5 W
  })
  it('cooldown ramp intact', () => expect(segs[2]).toMatchObject({ duration: 600, powerStart: 48, powerEnd: 58 }))
})

describe('flattenIcuSteps — repeats still expand', () => {
  it('expands a reps block', () => {
    const segs = flattenIcuSteps([{ reps: 3, steps: [{ duration: 60, power: { value: 100, units: '%ftp' } }, { duration: 60, power: { value: 50, units: '%ftp' } }] }])
    expect(segs.length).toBe(6)
    expect(segs.filter((s) => s.powerStart === 100).length).toBe(3)
  })
})
