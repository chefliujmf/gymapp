// A normalized "ride to play" handed to the player. Both the JOIN library and
// the intervals.icu plan produce this shape. Stashed in sessionStorage so the
// player survives a refresh.
import type { Segment } from './intervals'
import type { EnduranceWorkout } from './types'

export interface RidePlan {
  title: string
  sport: 'cycling' | 'running'
  segments: Segment[]
  ftp: number
  source: string
}

const KEY = 'currentRide'

export function setCurrentRide(p: RidePlan) {
  sessionStorage.setItem(KEY, JSON.stringify(p))
}
export function getCurrentRide(): RidePlan | null {
  try {
    const s = sessionStorage.getItem(KEY)
    return s ? (JSON.parse(s) as RidePlan) : null
  } catch {
    return null
  }
}

/** Flatten a JOIN workout (blocks × repeats) into flat player segments. */
export function segmentsFromEndurance(w: EnduranceWorkout): Segment[] {
  const out: Segment[] = []
  for (const b of w.blocks) {
    for (let r = 0; r < (b.numRepeats || 1); r++) {
      for (const iv of b.intervals) {
        out.push({ duration: iv.duration, powerStart: iv.rawPower, powerEnd: iv.rawPower })
      }
    }
  }
  return out
}

/** Watts target at a point within a segment (linear ramp), given FTP. */
export function wattsAt(seg: Segment, elapsedSec: number, ftp: number): number {
  const t = seg.duration ? Math.min(1, Math.max(0, elapsedSec / seg.duration)) : 0
  const pct = seg.powerStart + (seg.powerEnd - seg.powerStart) * t
  return Math.round((pct / 100) * ftp)
}
