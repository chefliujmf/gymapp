import { describe, it, expect } from 'vitest'
import { matchExercise } from './plan'

// #296 — common lifts must resolve to a demo (the old score>=2 gate rejected all single-word names),
// and should prefer a VIDEO demo when one exists for that movement (two-pass matcher).
const COMMON = ['Squat', 'Deadlift', 'Plank', 'Pull-up', 'Push-up', 'Lunge', 'Bench Press', 'Overhead Press', 'Romanian Deadlift', 'Bicep Curl', 'Barbell Row', 'Hip Thrust']

describe('matchExercise (#296)', () => {
  it('resolves every common lift to a library demo (no more emoji-only)', () => {
    for (const n of COMMON) expect(matchExercise(n), n).toBeTruthy()
  })
  it('prefers a video demo for common movements', () => {
    const withVideo = COMMON.filter((n) => matchExercise(n)?.video)
    // essentially all should land on a video variation
    expect(withVideo.length).toBeGreaterThanOrEqual(COMMON.length - 1)
  })
  it('does not match on a single weak token (junk guard)', () => {
    // a query sharing only a padding word with a combo shouldn't match it
    const m = matchExercise('zzzq nonexercise')
    expect(m).toBeUndefined()
  })
  it('handles singular/plural + parenthetical notes (audit — no recurrence)', () => {
    // #296 audit: these previously fell to image-only. All should land on a video demo now.
    for (const n of ['Biceps curl', 'Triceps pushdown', 'Calf raises', 'Dumbbell bench press (or machine chest press)', 'Pallof press (both sides)', 'Lat pulldown (or assisted pull-up)']) {
      expect(matchExercise(n)?.video, n).toBeTruthy()
    }
  })
})
