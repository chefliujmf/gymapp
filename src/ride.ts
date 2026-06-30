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
        out.push({ duration: iv.duration, powerStart: iv.rawPower, powerEnd: iv.rawPower, label: iv.power, hr: iv.heartRate })
      }
    }
  }
  return out
}

/** Flat %FTP target for a segment — the mean of its {start,end} (NO inferred ramp, JM 2026-06-29:
 *  "mirror intervals, no ramp for now"). Coach-defined ramps can reinstate the slope later. */
export const segPct = (seg: { powerStart: number; powerEnd: number }) => Math.round((seg.powerStart + seg.powerEnd) / 2)

/** Watts target within a segment, given FTP. Flat (no ramp): holds the segment's mean target. */
export function wattsAt(seg: Segment, _elapsedSec: number, ftp: number): number {
  return Math.round((segPct(seg) / 100) * ftp)
}

// Mobile-first (#109/#139): a guided ride/run only starts on a touch device — OR on a
// desktop when the sensor bridge is connected. Gate the "Ride/Run now" BUTTON with this
// (not just the player), so you can't even try from a sensor-less desktop.
export const isMobileDevice = () => typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 || window.innerWidth < 820)
export const canPlayHere = (hasBridge?: boolean) => isMobileDevice() || !!hasBridge
