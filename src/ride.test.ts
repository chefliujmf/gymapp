import { describe, it, expect, vi, afterEach } from 'vitest'
import { canPlayHere, isMobileDevice } from './ride'

// #139: a guided ride/run may start ONLY on a touch device, or on a desktop with the
// sensor bridge. The "Ride now" button must respect this — not just the player.
afterEach(() => vi.unstubAllGlobals())

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

  it('a narrow (<820) viewport counts as mobile', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), innerWidth: 500 })
    vi.stubGlobal('navigator', { maxTouchPoints: 0 })
    expect(isMobileDevice()).toBe(true)
  })
})
