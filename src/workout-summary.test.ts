import { describe, it, expect } from 'vitest'
import { workoutSummary, structureRows, powerZone, segTarget, plannedSeries, plannedLoad } from './workout-summary'

const flat = (pct: number, dur: number) => ({ duration: dur, powerStart: pct, powerEnd: pct })
// warm-up 15m@65, 3×(10m@95 / 3m@55), cooldown 9m@60
const threshold3x10 = [
  flat(65, 900),
  flat(95, 600), flat(55, 180),
  flat(95, 600), flat(55, 180),
  flat(95, 600), flat(55, 180),
  flat(60, 540),
]

describe('powerZone / segTarget', () => {
  it('maps %FTP to Coggan zones', () => {
    expect(powerZone(50)).toBe('Z1'); expect(powerZone(65)).toBe('Z2'); expect(powerZone(85)).toBe('Z3')
    expect(powerZone(95)).toBe('Z4'); expect(powerZone(110)).toBe('Z5')
  })
  it('segTarget is the flat mean', () => { expect(segTarget({ duration: 60, powerStart: 90, powerEnd: 100 })).toBe(95) })
})

describe('workoutSummary', () => {
  it('total duration + main sustained effort', () => {
    const s = workoutSummary(threshold3x10, 260)!
    expect(s.durationMin).toBe(Math.round((900 + 3 * (600 + 180) + 540) / 60)) // 63
    expect(s.mainPct).toBe(95)
    expect(s.mainZone).toBe('Z4')
    expect(s.mainWatts).toBe(Math.round(0.95 * 260)) // 247
  })
  it('no ftp → watts null; empty → null', () => {
    expect(workoutSummary(threshold3x10)!.mainWatts).toBeNull()
    expect(workoutSummary([])).toBeNull()
  })
})

describe('structureRows', () => {
  it('collapses the repeated effort/recovery into N× rows', () => {
    const rows = structureRows(threshold3x10, 260)
    // warm-up, 3× effort, 3× recovery, cooldown  → 4 rows
    expect(rows).toHaveLength(4)
    const effort = rows.find((r) => r.pct === 95)!
    expect(effort.count).toBe(3)
    expect(effort.durationSec).toBe(600)
    expect(effort.label).toBe('Effort')
    expect(rows[0].label).toBe('Warm-up')
    expect(rows[rows.length - 1].label).toBe('Cooldown')
  })
  it('merges consecutive equal-target steps', () => {
    const rows = structureRows([flat(65, 300), flat(65, 300), flat(90, 600)], 200)
    expect(rows).toHaveLength(2)
    expect(rows[0].durationSec).toBe(600)
  })
})

describe('plannedSeries / plannedLoad', () => {
  it('plannedSeries samples target watts per 10s (flat block = constant)', () => {
    const s = plannedSeries([flat(50, 60)], 260) // 60s @ 50% of 260 = 130 W
    expect(s.length).toBe(6)
    expect(s.every((w) => w === 130)).toBe(true)
  })
  it('plannedLoad gives a sane IF + TSS for the 3×10 threshold', () => {
    const l = plannedLoad(threshold3x10, 260)!
    // IF should sit in a realistic threshold range, TSS scales with duration×IF²
    expect(l.if).toBeGreaterThan(0.7)
    expect(l.if).toBeLessThan(0.95)
    expect(l.tss).toBeGreaterThan(45)
    expect(l.tss).toBeLessThan(110)
  })
  it('no ftp → null', () => { expect(plannedLoad(threshold3x10)).toBeNull() })
})
