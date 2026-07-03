// #333 — completed-RUN analytics: a run shows PACE, never watts. Pure + unit-tested (run-analysis.test.ts).
// Mirrors the ride power-curve/time-in-zone maths, but on speed→pace. intervals streams give
// velocity_smooth (m/s); pace = 1000 / speed (sec/km).

export const CURVE_DURATIONS = [1, 5, 15, 30, 60, 300, 600, 1200, 1800, 3600]

/** Pace (sec/km) from speed (m/s). Ignore <0.4 m/s (stopped / GPS noise) and cap at 20:00/km. */
export function paceOf(v: number | null | undefined): number | null {
  const s = Number(v)
  return s > 0.4 ? Math.min(Math.round(1000 / s), 1200) : null
}

/** Best AVERAGE pace sustained over each duration (the running "power curve"): mean-max on speed → pace. */
export function bestPaceCurve(vel: (number | null)[]): { secs: number[]; pace: number[] } {
  const v = vel.map((x) => (x == null ? 0 : Math.max(0, Number(x))))
  const n = v.length, pre = [0]
  for (let i = 0; i < n; i++) pre.push(pre[i] + v[i])
  const secs: number[] = [], pace: number[] = []
  for (const d of CURVE_DURATIONS) {
    if (d > n) continue
    let best = 0
    for (let i = 0; i + d <= n; i++) { const avg = (pre[i + d] - pre[i]) / d; if (avg > best) best = avg }
    if (best > 0.4) { secs.push(d); pace.push(Math.round(1000 / best)) }
  }
  return { secs, pace }
}

// Daniels PACE zones as % of threshold SPEED (matches intervals run zones): higher % = faster.
export const PZONES = ['Recovery', 'Easy', 'Marathon', 'Threshold', 'Interval', 'Rep']
export const PZONE_BOUND = [77.5, 87.7, 94.3, 100, 106, 999]
export const PZONE_PCT = [50, 68, 85, 98, 108, 120] // representative %, for zoneColor
export const paceZoneIdx = (pctSpeed: number): number => {
  for (let i = 0; i < PZONE_BOUND.length; i++) if (pctSpeed <= PZONE_BOUND[i]) return i
  return 5
}

/** Seconds spent in each pace zone (index of PZONES), from the speed stream + threshold pace (sec/km). */
export function paceZoneSecs(vel: (number | null)[], thrPace: number): number[] {
  const z = [0, 0, 0, 0, 0, 0], vThr = 1000 / thrPace // threshold speed, m/s
  for (const raw of vel) { const v = Number(raw); if (!(v > 0.4)) continue; z[paceZoneIdx((v / vThr) * 100)]++ }
  return z
}
