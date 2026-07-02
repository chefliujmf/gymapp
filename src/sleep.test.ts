import { describe, it, expect } from 'vitest'
import { estimateSleepNeed } from './sleep'

const day = (sleepHours: number | null, hrv: number | null, load = 30) => ({ sleepHours, hrv, load })
const many = (n: number, fn: (i: number) => { sleepHours: number | null; hrv: number | null; load?: number }) => Array.from({ length: n }, (_, i) => fn(i))

describe('estimateSleepNeed (#304)', () => {
  it('reports nights still needed when data is thin', () => {
    const e = estimateSleepNeed(many(10, () => day(7.5, 40)))
    expect(e.nights).toBe(10)
    expect(e.needMore).toBe(11) // 21 - 10
    expect(e.suggested).toBeNull()
    expect(e.avgSleep).toBe(7.5)
  })
  it('ignores garbage nights (no sleep / no HRV / absurd values)', () => {
    const e = estimateSleepNeed([day(null, 40), day(7, null), day(0, 40), day(20, 40), day(8, 45)])
    expect(e.nights).toBe(1)
  })
  it('learns a higher need when best-recovery nights are longer', () => {
    // 30 nights: HRV rises with sleep → the top-HRV third sleeps ~9h, so it should suggest ~9
    const e = estimateSleepNeed(many(30, (i) => { const s = 7 + (i % 5) * 0.5; return day(s, 20 + s * 4) }))
    expect(e.needMore).toBe(0)
    expect(e.suggested).not.toBeNull()
    expect(e.suggested!).toBeGreaterThanOrEqual(8.5)
  })
  it('flags trainOften on high average load', () => {
    expect(estimateSleepNeed(many(25, () => day(7.5, 40, 70))).trainOften).toBe(true)
    expect(estimateSleepNeed(many(25, () => day(7.5, 40, 10))).trainOften).toBe(false)
  })
})
