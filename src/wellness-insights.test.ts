import { describe, it, expect } from 'vitest'
import { wellnessInsights } from './wellness-insights'

// #249 — coach-voice wellness insights.
const rising = [40, 42, 45, 48, 52, 55]
const falling = [...rising].reverse()
const flat = [50, 50, 50, 50, 50, 50]

describe('wellnessInsights', () => {
  it('sleep shortfall vs need → debt explanation + tip', () => {
    const i = wellnessInsights({ sleep: [6, 6.2, 6.1, 6.3], hrv: [], rhr: [], weight: [], sleepNeed: 8 }).find((x) => x.metric === 'Sleep')!
    expect(i.text).toMatch(/shortfall|debt/)
    expect(i.tip).toBeTruthy()
  })
  it('sleep at need → positive, no debt', () => {
    const i = wellnessInsights({ sleep: [8, 8.2, 8.1], hrv: [], rhr: [], weight: [], sleepNeed: 8 }).find((x) => x.metric === 'Sleep')!
    expect(i.text).toMatch(/solid|at or above/)
  })
  it('HRV rising = adapting; falling = fatigue + tip', () => {
    expect(wellnessInsights({ sleep: [], hrv: rising, rhr: [], weight: [] }).find((x) => x.metric === 'HRV')!.text).toMatch(/up|adapting/)
    const f = wellnessInsights({ sleep: [], hrv: falling, rhr: [], weight: [] }).find((x) => x.metric === 'HRV')!
    expect(f.text).toMatch(/down|fatigue/); expect(f.tip).toBeTruthy()
  })
  it('rising resting HR flags fatigue/illness', () => {
    expect(wellnessInsights({ sleep: [], hrv: [], rhr: rising, weight: [] }).find((x) => x.metric === 'Resting HR')!.text).toMatch(/up|fatigue|illness/)
  })
  it('stable weight reads stable', () => {
    expect(wellnessInsights({ sleep: [], hrv: [], rhr: [], weight: flat }).find((x) => x.metric === 'Weight')!.text).toMatch(/stable/)
  })
  it('too few points → metric skipped', () => {
    expect(wellnessInsights({ sleep: [], hrv: [50, 51], rhr: [], weight: [] }).find((x) => x.metric === 'HRV')).toBeUndefined()
  })
})
