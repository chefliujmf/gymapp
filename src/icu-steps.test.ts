import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module, no types
import { encodeStep, flattenIcuStepsSrv, MAX_DOC_STEP_SECONDS } from '../server/icu-steps.js'

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
