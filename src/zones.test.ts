import { describe, it, expect } from 'vitest'
import { zoneColor, zoneName, zoneIndex, segPower } from './zones'

const GREEN = '#43d9a3', BLUE = '#7fd1ff'

describe('power zones — Coggan boundaries (#72)', () => {
  it('56% FTP is Endurance (green), NOT Recovery — the bug', () => {
    expect(zoneName(56)).toBe('Endurance')
    expect(zoneColor(56)).toBe(GREEN)
  })
  it('55% and below is Recovery (blue)', () => {
    expect(zoneName(55)).toBe('Recovery')
    expect(zoneColor(50)).toBe(BLUE)
  })
  it('zone indices across the range', () => {
    expect([40, 70, 85, 100, 110, 130].map(zoneIndex)).toEqual([0, 1, 2, 3, 4, 5])
  })
})

describe('segment coloring: thumbnail must match the detail (#72)', () => {
  it('colors by the segment PEAK (max of start/end), like the detail profile', () => {
    expect(segPower({ powerStart: 48, powerEnd: 55 })).toBe(55)
    expect(segPower({ powerStart: 56, powerEnd: 56 })).toBe(56)
  })
  it('Saturday Recovery Spin renders blue / GREEN / blue — not all blue', () => {
    const segs = [{ powerStart: 48, powerEnd: 55 }, { powerStart: 56, powerEnd: 56 }, { powerStart: 50, powerEnd: 50 }]
    expect(segs.map((s) => zoneName(segPower(s)))).toEqual(['Recovery', 'Endurance', 'Recovery'])
  })
})
