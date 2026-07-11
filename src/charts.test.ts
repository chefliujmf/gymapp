import { describe, it, expect } from 'vitest'
import { clampPopShift } from './charts'

// #5019 — pressing (i) on a graph opened an info box that overflowed off the screen. The dot sits at
// the right edge of a title, so the left-anchored popover ran past the viewport. clampPopShift returns
// the translateX that keeps the box on-screen (8px margin).
describe('clampPopShift — keep the InfoDot popover inside the viewport (#5019)', () => {
  const VW = 390 // a typical phone width

  it('leaves a box that already fits alone (shift 0)', () => {
    expect(clampPopShift(100, 340, VW)).toBe(0)
  })

  it('pulls a box that overflows the RIGHT edge back inside', () => {
    // dot near the right edge → 240px box would end at 440, past 390
    const s = clampPopShift(200, 440, VW)
    expect(s).toBeLessThan(0)
    expect(440 + s).toBe(VW - 8) // right edge now sits at the margin
  })

  it('nudges a box that overflows the LEFT edge to the right', () => {
    const s = clampPopShift(2, 242, VW)
    expect(s).toBe(6) // 8 - 2, so left edge lands at the 8px margin
  })

  it('keeps the LEFT edge visible when the box is wider than the viewport', () => {
    const s = clampPopShift(3, 500, VW) // box wider than the screen
    expect(3 + s).toBe(8) // left visible at the margin (readable start beats a hidden right tail)
  })

  it('respects a custom margin', () => {
    expect(clampPopShift(300, 500, VW, 16)).toBe(VW - 16 - 500)
  })
})
