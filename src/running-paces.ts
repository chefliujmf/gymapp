// Daniels/Gilbert VDOT running model — the runner's equivalent of cycling FTP.
// Pure functions, unit-tested in src/running-paces.test.ts. Same basis Garmin/Coros
// use for race predictions. #209 (threshold pace → VDOT/zones) + #211 (race predictions).

// Oxygen cost of running at velocity v (m/min), in ml/kg/min (Daniels & Gilbert).
const vo2 = (v: number) => -4.6 + 0.182258 * v + 0.000104 * v * v
// Fraction of VO₂max sustainable for a race of t minutes (the aerobic-drift curve).
const pctMax = (t: number) => 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t)
// Invert vo2(): velocity (m/min) that costs a given amount of oxygen.
const velForVo2 = (o2: number) => {
  const a = 0.000104, b = 0.182258, c = -(o2 + 4.6)
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
}

// Daniels Threshold pace sits at ~88% VO₂max (≈ the pace you can hold ~1 h).
export const T_PCT = 0.88

/** Threshold pace (sec/km) → VDOT (≈ running VO₂max). */
export function vdotFromThresholdPace(secPerKm: number): number {
  if (!(secPerKm > 0)) return NaN
  const v = 60000 / secPerKm // m/min
  return vo2(v) / T_PCT
}

/** VDOT → Threshold pace (sec/km). */
export function thresholdPaceFromVdot(vdot: number): number {
  return 60000 / velForVo2(vdot * T_PCT)
}

/** Pace (sec/km) at a target fraction of VO₂max. */
function paceForPct(vdot: number, pct: number): number {
  return 60000 / velForVo2(vdot * pct)
}

/** #512 — VDOT from a RACE performance (Daniels): the runner's GOLD-STANDARD fitness read, straight from a real
 *  all-out effort — not an HR extrapolation (overshoots) nor an easy-run pace-curve (under-reads). distM metres,
 *  timeSec seconds. VDOT = the VO₂ cost of the race velocity, divided by the fraction of VO₂max held for that duration. */
export function vdotFromRace(distM: number, timeSec: number): number {
  if (!(distM > 0) || !(timeSec > 0)) return NaN
  const v = distM / (timeSec / 60) // m/min
  return vo2(v) / pctMax(timeSec / 60)
}

/** #512 — robust VDOT from the athlete's BEST times across distances. GPS glitches make an impossibly-fast short race
 *  read a fantasy VDOT (JM's 1.5k → VDOT 86), so: reject anything past world-class (>82), then drop any lone value
 *  more than 12% above the median before taking the best — so one bad point can't inflate the number. Null if none. */
export function bestVdotFromRaces(races: { distM: number; timeSec: number }[]): number | null {
  const vs = (races || []).map((r) => vdotFromRace(r.distM, r.timeSec)).filter((v) => Number.isFinite(v) && v >= 20 && v <= 82).sort((a, b) => a - b)
  if (!vs.length) return null
  const med = vs[Math.floor(vs.length / 2)]
  const clean = vs.filter((v) => v <= med * 1.12)
  return Math.round(Math.max(...(clean.length ? clean : vs)) * 10) / 10
}

/** #512 — Critical Speed as a pace (sec/km) from VDOT — the sustainable ceiling, just ABOVE threshold (~90% VO₂max vs
 *  the 88% threshold), so threshold ≤ CS holds BY CONSTRUCTION (a threshold can never be faster than CS). This kills the
 *  under-read-CS bug where the pace-curve fit CS slower than the athlete's real threshold. */
export function csPaceFromVdot(vdot: number): number {
  return Math.round(paceForPct(vdot, 0.90))
}

/** #512 — running TTE at THRESHOLD, from Daniels' pctMax curve: the duration at which sustainable %VO₂max falls to
 *  threshold intensity (T_PCT). Threshold is BY DEFINITION your ~1-hour pace, so this is the AEROBIC ceiling (~67 min)
 *  and — correctly — VDOT-INDEPENDENT (a fitter runner's threshold is FASTER, but the TIME they hold it is the same).
 *  Used as the running-TTE model when threshold ≤ CS (the VDOT read), where the CS/D′ "above-critical" formula gives
 *  no depletion. The PERSONAL number is still the observed longest hold; this is the inferred fallback (never a test).
 *  Returns SECONDS. */
export function tteAtThresholdSec(): number {
  let lo = 1, hi = 240 // minutes
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (pctMax(m) > T_PCT) lo = m; else hi = m }
  return Math.round(((lo + hi) / 2) * 60)
}

export interface PaceZones {
  easy: [number, number] // [fast, slow] sec/km
  marathon: number
  threshold: number
  interval: number
  rep: number
}

/** Daniels training-pace zones (sec/km) from VDOT. E is a range; M = marathon race pace. */
export function paceZones(vdot: number): PaceZones {
  return {
    easy: [paceForPct(vdot, 0.74), paceForPct(vdot, 0.65)],
    marathon: racePredict(vdot, 42195).pace,
    threshold: paceForPct(vdot, T_PCT),
    interval: paceForPct(vdot, 1.0), // velocity at VO₂max
    rep: paceForPct(vdot, 1.08), // faster than interval (anaerobic)
  }
}

/** Predict finish time (sec) + pace (sec/km) for a race distance (m) from VDOT. */
export function racePredict(vdot: number, meters: number): { sec: number; pace: number } {
  // Bisect race time t (min): f(t) = vo2(velocity) − VDOT·pctMax(t) is decreasing in t.
  let lo = 1, hi = 1000
  for (let i = 0; i < 60; i++) {
    const t = (lo + hi) / 2
    const f = vo2(meters / t) - vdot * pctMax(t)
    if (f > 0) lo = t; else hi = t
  }
  const sec = ((lo + hi) / 2) * 60
  return { sec, pace: sec / (meters / 1000) }
}

export const RACE_DISTANCES: [string, number][] = [
  ['5K', 5000],
  ['10K', 10000],
  ['Half', 21097.5],
  ['Marathon', 42195],
]

/** 5K / 10K / Half / Marathon predictions (Garmin/Coros-style) from VDOT. */
export function racePredictions(vdot: number) {
  return RACE_DISTANCES.map(([label, meters]) => ({ label, meters, ...racePredict(vdot, meters) }))
}

// ── #216 — marathon realism ───────────────────────────────────────────────────
// The Daniels VDOT marathon prediction is a *potential*: it assumes you've done the
// marathon-specific endurance work (long runs, fueling), so it ignores "the wall" and
// runs optimistic vs Coros/Garmin (which weight real training load). We surface the
// marathon as a RANGE — potential → a durability-adjusted realistic time — where the
// penalty comes from the athlete's own long-run base. NB: the penalty is modest (≤~12%);
// the bulk of any big gap is the VDOT itself reading too fast (→ #215 grounds it).

const clamp01 = (x: number) => (x > 1 ? 1 : x < 0 ? 0 : x)

export interface RunVolume {
  longestKm: number // longest single run in the recent window (km)
  weeklyKm: number // average weekly running volume (km)
}

/** A marathon-trained base: ~32 km longest run + ~70 km/week → ~0 penalty. */
export const MARATHON_READY = { longestKm: 32, weeklyKm: 70 }
/** Cap on the durability penalty (fraction of the potential marathon time). */
export const MAX_DURABILITY_PENALTY = 0.12
/** Used when we have no volume data (intervals not connected / no recent runs). */
export const DEFAULT_DURABILITY_PENALTY = 0.08

/**
 * Marathon durability penalty (fraction 0..MAX_DURABILITY_PENALTY) from the athlete's
 * endurance base. Longest long-run weighted higher than weekly volume; both saturate at
 * the marathon-ready anchors. More base → smaller penalty (closer to the Daniels potential).
 */
export function marathonDurabilityPenalty(v: RunVolume): number {
  const longReady = clamp01((v.longestKm || 0) / MARATHON_READY.longestKm)
  const volReady = clamp01((v.weeklyKm || 0) / MARATHON_READY.weeklyKm)
  const readiness = 0.6 * longReady + 0.4 * volReady // 0 (untrained) .. 1 (race-ready)
  return +((1 - readiness) * MAX_DURABILITY_PENALTY).toFixed(4)
}

export interface MarathonRealism {
  potentialSec: number
  realisticSec: number
  potentialPace: number // sec/km
  realisticPace: number // sec/km
  penalty: number // fraction applied
  hasVolume: boolean // true = penalty derived from real runs; false = default
  volume?: RunVolume // echoed for the "why" line
}

/**
 * Marathon potential→realistic range from VDOT. With `volume` (from intervals runs) the
 * penalty is personal; without it we apply DEFAULT_DURABILITY_PENALTY so the band still shows.
 */
export function marathonRealism(vdot: number, volume?: RunVolume): MarathonRealism {
  const pot = racePredict(vdot, 42195)
  const hasVolume = !!volume && (volume.longestKm > 0 || volume.weeklyKm > 0)
  const penalty = hasVolume ? marathonDurabilityPenalty(volume!) : DEFAULT_DURABILITY_PENALTY
  const realisticSec = pot.sec * (1 + penalty)
  return {
    potentialSec: pot.sec,
    realisticSec,
    potentialPace: pot.pace,
    realisticPace: realisticSec / 42.195,
    penalty,
    hasVolume,
    volume: hasVolume ? volume : undefined,
  }
}

/** VDOT is itself a VO₂max-equivalent (Daniels). Alias for clarity at call sites. */
export const runningVo2max = (vdot: number) => vdot

/**
 * #207 Phase 2b — estimate VO₂max (ml/kg/min) from the best aerobic measure we have: cycling
 * eFTP÷weight (Coggan `10.8·W/kg + 7`) and/or running VDOT (a VO₂max itself). Returns the HIGHER
 * (your best-trained engine reflects central capacity best) + which source, or null if no inputs.
 * Recomputes as FTP/weight/VDOT change → it "refines over time"; manual entry always overrides.
 */
export function estimateVo2max({ ftp, weightKg, vdot }: { ftp?: number | null; weightKg?: number | null; vdot?: number | null }): { value: number; from: string } | null {
  const cands: { value: number; from: string }[] = []
  if (ftp && weightKg && weightKg > 0) cands.push({ value: Math.round((10.8 * ftp / weightKg + 7) * 10) / 10, from: 'your cycling power ÷ weight' })
  if (vdot && vdot > 0) cands.push({ value: Math.round(vdot), from: 'your running pace (VDOT)' })
  if (!cands.length) return null
  return cands.reduce((a, b) => (b.value > a.value ? b : a))
}

/**
 * Target pace (sec/km) for a workout segment given as a % of threshold (the RunPlayer's
 * `powerStart`). Maps the effort band to a Daniels zone so the player's pace matches the
 * Profile's pace-zone table. <78 Easy · <88 Marathon · <100 Threshold · <110 Interval · else Rep.
 */
export function zonePaceForPct(vdot: number, pct: number): number {
  const z = paceZones(vdot)
  if (pct < 78) return z.easy[1]
  if (pct < 88) return z.marathon
  if (pct < 100) return z.threshold
  if (pct < 110) return z.interval
  return z.rep
}

/** "4:15" from sec/km. */
export const fmtPace = (secPerKm: number) => {
  const s = Math.round(secPerKm)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** "1:31:35" / "19:57" from seconds. */
export const fmtTime = (sec: number) => {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`
}

/** Parse "4:15" or "4:15.5" (min:sec) → sec/km. Returns null on junk. */
export function parsePace(text: string): number | null {
  const m = text.trim().match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/)
  if (!m) return null
  const sec = Number(m[1]) * 60 + Number(m[2])
  return sec > 0 && sec < 1800 ? sec : null
}

// #331 — the coach authors run intensity as POWER-style % (Z2≈65%). Running PACE compresses hard:
// 58% of threshold pace ≈ 9:30/km (walking), which is absurd. Remap a power-% to a REALISTIC % of
// threshold pace so run targets are sane. MUST match server/icu-steps.js paceFromPowerPct.
// #343 — DERIVED FROM DANIELS FOUNDATIONS (see server/icu-steps.js): zone pace as % of threshold SPEED,
// computed from the oxygen-cost curves below + stable across VDOT. Effort-% → pace-% of threshold. KEEP
// IN SYNC with server/icu-steps.js PACE_ANCHORS.
const PACE_ANCHORS: [number, number][] = [[20, 70], [30, 73], [40, 77], [55, 81], [65, 84], [75, 89], [85, 93], [95, 98], [100, 100], [108, 111], [120, 119]]
// Returns a FLOAT (not rounded) so a ramped segment plots a smooth line, not a jagged integer staircase
// (#331b — the run chart's warm-up ramp looked bad; round only at the final display/push).
export function paceFromPowerPct(p: number): number {
  const n = Number(p) || 0
  if (n <= PACE_ANCHORS[0][0]) return PACE_ANCHORS[0][1]
  if (n >= PACE_ANCHORS[PACE_ANCHORS.length - 1][0]) return PACE_ANCHORS[PACE_ANCHORS.length - 1][1]
  for (let i = 1; i < PACE_ANCHORS.length; i++) {
    if (n <= PACE_ANCHORS[i][0]) { const [x0, y0] = PACE_ANCHORS[i - 1], [x1, y1] = PACE_ANCHORS[i]; return y0 + (y1 - y0) * (n - x0) / (x1 - x0) }
  }
  return 90
}
