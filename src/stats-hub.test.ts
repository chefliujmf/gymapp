import { describe, it, expect } from 'vitest'
import { statsGroups } from './pages/hubs'

// #193 — Stats hub splits GLOBAL (cross-sport) from PER SPORT, gated by the user's sports.
const labels = (xs: { label: string }[]) => xs.map((x) => x.label)

describe('Stats hub groups (#193)', () => {
  it('strength-only: no endurance Form, no cycling card; Strength under per-sport', () => {
    const { global, perSport } = statsGroups(['strength'])
    expect(labels(global)).toEqual(['Wellness', 'History']) // no "Training load & Form" (no endurance)
    expect(labels(perSport)).toEqual(['Strength'])
  })

  it('cycling + strength + meditation: global has Form + Wellness + History; per-sport = Cycling + Strength (Mind stats deactivated #492)', () => {
    const { global, perSport } = statsGroups(['cycling', 'strength', 'meditation'])
    expect(labels(global)).toEqual(['Load & Form', 'Wellness', 'History'])
    expect(labels(perSport)).toEqual(['Cycling', 'Strength']) // #492 — Mind removed from Stats
  })

  it('no sports set: shows Form + Wellness + History globally, no per-sport cards', () => {
    const { global, perSport } = statsGroups([])
    expect(labels(global)).toEqual(['Load & Form', 'Wellness', 'History'])
    expect(perSport).toHaveLength(0)
  })

  it('triathlon unlocks both Cycling and Running', () => {
    const { perSport } = statsGroups(['triathlon'])
    expect(labels(perSport)).toEqual(['Cycling', 'Running'])
  })

  it('History is always global; routes are correct', () => {
    const { global, perSport } = statsGroups(['cycling', 'strength'])
    expect(global.find((s) => s.label === 'History')?.to).toBe('/logs')
    expect(perSport.find((s) => s.label === 'Strength')?.to).toBe('/progress')
    expect(perSport.find((s) => s.label === 'Cycling')?.to).toBe('/cycling-stats')
  })
})
