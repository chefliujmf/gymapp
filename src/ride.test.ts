import { describe, it, expect, vi, afterEach } from 'vitest'
import { canPlayHere, isMobileDevice, segPct, wattsAt } from './ride'

// #139: a guided ride/run may start ONLY on a touch device, or on a desktop with the
// sensor bridge. The "Ride now" button must respect this — not just the player.
afterEach(() => vi.unstubAllGlobals())

// No inferred ramps (JM 2026-06-30): each segment is a FLAT block at the mean of its {start,end}.
// A backwards cooldown ({48,58}) must NOT render/play as a ramp — it holds a steady mid target.
describe('flat segment target — no inferred ramp (#221)', () => {
  it('segPct = mean of start/end (steady block keeps its value)', () => {
    expect(segPct({ powerStart: 91, powerEnd: 91 })).toBe(91)
    expect(segPct({ powerStart: 48, powerEnd: 58 })).toBe(53) // the backwards cooldown → flat mid
    expect(segPct({ powerStart: 50, powerEnd: 75 })).toBe(63) // warmup → flat mid, not the peak
  })
  it('wattsAt is FLAT — same watts at the start, middle, and end of a segment', () => {
    const cooldown = { duration: 900, powerStart: 48, powerEnd: 58 }
    const ftp = 260
    const at = (t: number) => wattsAt(cooldown, t, ftp)
    expect(at(0)).toBe(at(450))
    expect(at(450)).toBe(at(900))
    expect(at(0)).toBe(Math.round((53 / 100) * ftp)) // 138 W, the mean — never ramps up
  })
})

describe('ride/run gate — mobile-first (#139)', () => {
  it('desktop with NO bridge CANNOT start (the bug)', () => {
    expect(isMobileDevice()).toBe(false) // node test env = no window = desktop-like
    expect(canPlayHere(false)).toBe(false)
    expect(canPlayHere(undefined)).toBe(false)
  })

  it('the sensor bridge unlocks desktop', () => {
    expect(canPlayHere(true)).toBe(true)
  })

  it('a touch / mobile viewport can start with no bridge', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }), innerWidth: 390 })
    expect(isMobileDevice()).toBe(true)
    expect(canPlayHere(false)).toBe(true)
  })

  it('a NARROW DESKTOP window (fine pointer, no touch) is NOT mobile — #139/#145: no "Ride now" leak', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), innerWidth: 500 })
    vi.stubGlobal('navigator', { maxTouchPoints: 0 })
    expect(isMobileDevice()).toBe(false) // narrow ≠ mobile; a Mac desktop resized small must stay desktop
  })

  it('a touch device is mobile regardless of width (coarse pointer OR touch points)', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), innerWidth: 1400 })
    vi.stubGlobal('navigator', { maxTouchPoints: 5 })
    expect(isMobileDevice()).toBe(true)
  })
})
