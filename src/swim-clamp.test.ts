import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain JS server module
import { enforceSwim, clampSwimSets, computeSwim, ceilingToSwimZone } from '../server/swim.js'

describe('#715 swim intensity clamp — first-class + code-enforced like ride/run', () => {
  it('a maintenance/pregnant swimmer (endurance ceiling) cannot be saved a sprint set — clamped to Z2', () => {
    const sets = [
      { section: 'warmup', reps: 1, distanceM: 200, zone: 1 },
      { section: 'main', reps: 8, distanceM: 50, zone: 5 },   // sprint → must clamp
      { section: 'main', reps: 4, distanceM: 100, zone: 3 },  // CSS → must clamp to 2
    ]
    const r = enforceSwim(sets, 'endurance', 100)
    expect(r.clamped).toBe(2)
    expect(r.sets.every((s: any) => s.zone <= 2)).toBe(true)
    expect(r.notes).not.toMatch(/sprint|CSS/i)   // the display text reflects the clamp
    expect(r.notes).toMatch(/aerobic/i)
  })
  it('a full-build swimmer (vo2 ceiling) is NOT clamped', () => {
    const sets = [{ section: 'main', reps: 6, distanceM: 100, zone: 5 }]
    expect(enforceSwim(sets, 'vo2', 100).clamped).toBe(0)
  })
  it('ceiling→zone map + load re-derives from the clamped sets', () => {
    expect(ceilingToSwimZone('endurance')).toBe(2)
    expect(ceilingToSwimZone('threshold')).toBe(3)
    expect(ceilingToSwimZone('vo2')).toBe(5)
    const hard = computeSwim([{ section: 'main', reps: 8, distanceM: 100, zone: 5 }], 90)
    const easy = computeSwim([{ section: 'main', reps: 8, distanceM: 100, zone: 2 }], 90)
    expect(easy.icu_training_load).toBeLessThan(hard.icu_training_load) // clamping down lowers the load
  })
})
