// #407 — season comparison for the stats pages: overlay 2 seasons on the power/pace curve + a compare table
// (This season | a season you pick | Δ) with the derived metrics. PURE helpers here (durations, best-at-duration,
// pace sanity-filter, Δ); the fetch lives in intervals.ts, the UI in SeasonCompare.tsx. Unit-tested.
//
// DATA NOTE (#407/#415): intervals' power/pace-curve API only returns TRAILING windows (`curves=Nd`) or all-time —
// it can't return a bounded calendar year. So "seasons" are trailing windows (This=YTD · Last=365d · 2-ago=730d ·
// All=10000d), which happen to MATCH intervals' own season columns. Exact-year + custom-range (server-computed
// from activity streams) is the #415 follow-up.

export interface SeasonSpec { key: string; label: string; days: number }

/** The compare seasons, as trailing-day windows. `this` uses days-since-Jan-1 (passed in — keeps this pure). */
export function seasonSpecs(daysSinceJan1: number): SeasonSpec[] {
  return [
    { key: 'this', label: 'This season', days: Math.max(1, Math.round(daysSinceJan1)) },
    { key: 'last', label: 'Last season', days: 365 },
    { key: 's2', label: '2 seasons ago', days: 730 },
    { key: 'all', label: 'All time', days: 10000 },
  ]
}
/** Days elapsed since Jan 1 of `now`'s year (for the YTD "This season" window). */
export function daysSinceJan1(now: Date): number {
  const jan1 = new Date(now.getFullYear(), 0, 1)
  return Math.max(1, Math.floor((now.getTime() - jan1.getTime()) / 86400000) + 1)
}

// Power (cycling) durations and Pace (running) distances shown as table rows / curve x-ticks.
export const POWER_DURATIONS: { secs: number; label: string }[] = [
  { secs: 5, label: '5s' }, { secs: 60, label: '60s' }, { secs: 300, label: '5m' }, { secs: 1200, label: '20m' },
  { secs: 3600, label: '1h' }, { secs: 7200, label: '2h' }, { secs: 10800, label: '3h' }, { secs: 14400, label: '4h' },
  { secs: 18000, label: '5h' }, { secs: 21600, label: '6h' }, { secs: 28800, label: '8h' },
]
export const PACE_DISTANCES: { m: number; label: string }[] = [
  { m: 400, label: '400m' }, { m: 1000, label: '1k' }, { m: 5000, label: '5k' }, { m: 10000, label: '10k' },
  { m: 21097, label: 'half' }, { m: 42195, label: 'M' },
]

/** Best value on a mean-max curve at (or just past) a target duration. secs ASCENDING, vals aligned. Returns the
 *  value at the first sample ≥ target (the athlete DID hold ≥ that long); null if the curve doesn't reach it. */
export function bestAt(secs: number[], vals: number[], targetSec: number): number | null {
  if (!secs?.length || !vals?.length) return null
  for (let i = 0; i < secs.length; i++) if (secs[i] >= targetSec && vals[i] != null) return vals[i]
  return null
}

/** Pace sanity-filter (#400): intervals returns garbage for short all-time distances (e.g. 400 m in 0:02 → 5 s/km).
 *  A real sustained pace is ~2:30–12:00 /km (150–720 s/km). Reject anything outside that. */
export function paceOkay(secPerKm: number | null): boolean {
  return secPerKm != null && secPerKm >= 150 && secPerKm <= 720
}

/** Signed gap between This season (a) and the compared season (b). Positive = This is BETTER.
 *  Power: higher is better → a−b. Pace time: LOWER is better → b−a. null if either is missing. */
export function seasonDelta(a: number | null, b: number | null, higherIsBetter: boolean): number | null {
  if (a == null || b == null) return null
  return higherIsBetter ? a - b : b - a
}
