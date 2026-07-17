// Swimming engine — CSS (Critical Swim Speed) benchmark → zones → sTSS load. Peer to running's
// threshold-pace/VDOT and cycling's FTP. Pure + unit-tested (src/swimming.test.ts). Method + sources:
// docs/swimming-coaching.md. All paces are SECONDS per 100 m (or 100 yd — the unit follows the pool).

export interface CssResult {
  cssSpeed: number // m per second (or yd/s) sustainable = the swim "threshold"
  cssPace100: number // seconds per 100 — the number we coach to
}

/** Critical Swim Speed from the standard 400 + 200 all-out time-trials (same day, well warmed up).
 *  CSS speed = (D400 − D200) / (t400 − t200) = the 200 m of distance covered over the TIME DIFFERENCE.
 *  Distances default to metres; pass 400/200 in yards for a yard pool (the ratio is identical either way). */
export function criticalSwimSpeed(t400Sec: number, t200Sec: number, d400 = 400, d200 = 200): CssResult | null {
  if (!(t400Sec > 0) || !(t200Sec > 0) || t400Sec <= t200Sec) return null // 400 must be slower (longer time)
  const cssSpeed = (d400 - d200) / (t400Sec - t200Sec)
  if (!(cssSpeed > 0)) return null
  return { cssSpeed, cssPace100: 100 / cssSpeed }
}

/** Pace (s/100) at a given fraction of CSS SPEED. Slower effort (fraction < 1) → bigger pace number. */
export const paceAtPct = (cssPace100: number, pctOfCssSpeed: number) => cssPace100 / pctOfCssSpeed

export interface SwimZone { zone: number; name: string; pctLow: number; pctHigh: number; paceSlow: number; paceFast: number }

/** The 5 CSS-anchored swim zones (mirrors run PACE_ANCHORS). Bounds are % of CSS SPEED; paceSlow/paceFast are the
 *  s/100 range (paceSlow = the slower/easier end). Keep in sync with docs/swimming-coaching.md §2. */
export function swimZones(cssPace100: number): SwimZone[] {
  const Z: Omit<SwimZone, 'paceSlow' | 'paceFast'>[] = [
    { zone: 1, name: 'Easy / recovery', pctLow: 0.60, pctHigh: 0.80 },
    { zone: 2, name: 'Aerobic / endurance', pctLow: 0.80, pctHigh: 0.90 },
    { zone: 3, name: 'Threshold (CSS)', pctLow: 0.95, pctHigh: 1.02 },
    { zone: 4, name: 'VO₂ / race-pace', pctLow: 1.02, pctHigh: 1.10 },
    { zone: 5, name: 'Sprint / speed', pctLow: 1.10, pctHigh: 1.30 },
  ]
  // paceSlow = at the LOW % (slower); paceFast = at the HIGH % (faster) → paceSlow >= paceFast.
  return Z.map((z) => ({ ...z, paceSlow: Math.round(paceAtPct(cssPace100, z.pctLow)), paceFast: Math.round(paceAtPct(cssPace100, z.pctHigh)) }))
}

/** Which zone a swum pace (s/100) falls in, relative to CSS. */
export function zoneForPace(cssPace100: number, pace100: number): number {
  if (!(pace100 > 0) || !(cssPace100 > 0)) return 0
  const pct = cssPace100 / pace100 // % of CSS speed this pace represents
  if (pct < 0.80) return 1
  if (pct < 0.90) return 2
  if (pct < 1.02) return 3
  if (pct < 1.10) return 4
  return 5
}

/** Swim TSS (sTSS) from duration + average pace vs CSS — analogous to run rTSS/Coggan TSS (FTP-independent: the
 *  intensity IS the ratio). IF = swim speed / CSS speed = cssPace100 / avgPace100. sTSS = duration_s × IF² / 36
 *  (so 1 h exactly at CSS ≈ 100). */
export function swimTSS(durationSec: number, avgPace100: number, cssPace100: number): number {
  if (!(durationSec > 0) || !(avgPace100 > 0) || !(cssPace100 > 0)) return 0
  const IF = cssPace100 / avgPace100
  return Math.round((durationSec * IF * IF) / 36)
}

/** Estimate CSS from a single sustained best effort (like eFTP from a ride) when no formal 400/200 test exists:
 *  a hard, steady swim of ≥ ~10 min at `pace100` reflects ~threshold. Longer efforts weight closer to CSS; a short
 *  hard effort is faster than CSS, so nudge the pace slightly slower. Rough — a real 400/200 test wins. */
export function estimateCssFromEffort(durationSec: number, pace100: number): CssResult | null {
  if (!(durationSec >= 480) || !(pace100 > 0)) return null // need ≥ ~8 min sustained
  // efforts 10–30 min ≈ CSS; a ~8–10 min effort is a touch above CSS → add a small pace penalty that fades by 20 min.
  const overMin = Math.max(0, (1200 - durationSec) / 1200) // 0 at ≥20 min, ~0.4 at 8 min
  const cssPace100 = pace100 * (1 + 0.05 * overMin)
  return { cssSpeed: 100 / cssPace100, cssPace100 }
}

/** Format s/100 as m:ss /100. */
export const fmtPace100 = (s?: number | null) => (s == null || !(s > 0) ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`)

/** SWOLF (swim golf) = seconds + strokes for a length; lower = more efficient. The technique benchmark. */
export const swolf = (lengthSec: number, strokes: number) => (lengthSec > 0 && strokes > 0 ? Math.round(lengthSec + strokes) : null)
