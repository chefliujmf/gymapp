// Readiness math (#195) — Sleep · Freshness · Energy on a PERSONAL 1–5 scale, derived from
// intervals.icu wellness history + the daily check-in. Pure (no I/O) → unit-tested in
// src/readiness.test.ts. Research basis + every design decision: docs/readiness-scores.md
// ("WHOOP deep-dive", deep-research 2026-06-28). Core rules from that synthesis:
//   • HRV is a TREND, not a single-night truth — z-score lnRMSSD against a personal baseline, clamp, dampen.
//   • RHR is the hard-to-fake guard: high HRV + elevated RHR ⇒ parasympathetic saturation, don't credit the HRV.
//   • Keep a subjective term (HRV misses musculoskeletal soreness).
//   • Personalized Sleep need (hours ÷ need), never fixed hour bins; prefer a device sleep score.
//   • Cold start: too few baseline days ⇒ DON'T auto-derive Energy; fall back to the manual tap.
//   • WHOOP's exact weights are proprietary; ours (0.35/0.35/0.15/0.15) are a defensible engineering choice.

// --- low-level stats ------------------------------------------------------
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))
export const round1 = (x) => Math.round(x * 10) / 10
// ln-transform RMSSD (right-skewed) before any baselining/z-scoring. null if non-positive.
export const lnRMSSD = (rmssd) => (rmssd != null && rmssd > 0 ? Math.log(rmssd) : null)

export function meanSd(xs) {
  const v = xs.filter((x) => x != null && Number.isFinite(x))
  if (!v.length) return { mean: null, sd: null, n: 0 }
  const mean = v.reduce((a, b) => a + b, 0) / v.length
  if (v.length < 2) return { mean, sd: null, n: v.length }
  const variance = v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1)
  return { mean, sd: Math.sqrt(variance), n: v.length }
}
export const coefVar = (xs) => { const { mean, sd } = meanSd(xs); return mean && sd != null ? sd / Math.abs(mean) : null }
export const zscore = (x, mean, sd) => (sd && sd > 0 ? (x - mean) / sd : 0)

// z-score → 1–5 (z 0 = 3 "your normal"; +1.5σ → 5, −1.5σ → 1). dir=+1 higher-is-better, −1 inverse.
export const zTo5 = (z, dir = 1) => clamp(round1(3 + dir * z * (2 / 1.5)), 1, 5)
// 0–100 device score → 1–5.
export const score100To5 = (s) => clamp(round1(s / 20), 1, 5)
// Monotonic piecewise-linear map; clamps at the ends. pts = [[x,y]...] sorted by x.
export function lerpMap(x, pts) {
  if (x == null) return null
  if (x <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0) }
  }
  return pts[pts.length - 1][1]
}

export const MIN_BASELINE_DAYS = 14 // below this we can't trust a personal baseline → fall back to manual

// --- personal baselines from wellness history -----------------------------
// history: [{ date, hrv, restingHR }, ...] (older → newer). Excludes today's row ideally.
export function baselines(history = []) {
  const lnHrv = history.map((w) => lnRMSSD(w && w.hrv)).filter((x) => x != null)
  const rhr = history.map((w) => (w && w.restingHR != null ? w.restingHR : null)).filter((x) => x != null)
  return {
    hrvBaseline: lnHrv.length >= MIN_BASELINE_DAYS ? meanSd(lnHrv) : null,
    rhrBaseline: rhr.length >= MIN_BASELINE_DAYS ? meanSd(rhr) : null,
    hrvCV7: coefVar(history.slice(-7).map((w) => lnRMSSD(w && w.hrv))), // 7-day volatility (overtraining lever)
    nHrv: lnHrv.length, nRhr: rhr.length,
  }
}

// --- the three scores -----------------------------------------------------

// FRESHNESS (1–5) — training-load freshness from ACWR (ATL/CTL) + TSB/Form (CTL−ATL). Objective.
export function freshness({ atl, ctl, form } = {}) {
  const acwr = atl != null && ctl != null && ctl > 0 ? atl / ctl : null
  const tsb = form != null ? form : (ctl != null && atl != null ? ctl - atl : null)
  const a = acwr == null ? null : lerpMap(acwr, [[0.8, 5], [1.0, 4], [1.3, 3], [1.5, 2], [1.8, 1]])
  const t = tsb == null ? null : lerpMap(tsb, [[-30, 1], [-15, 2], [0, 3], [10, 4], [25, 5]])
  const parts = [a, t].filter((x) => x != null)
  if (!parts.length) return null
  let score = parts.reduce((s, x) => s + x, 0) / parts.length
  if (tsb != null && tsb < -30) score = Math.min(score, 1.5) // deep volume block → override down
  return { score: clamp(round1(score), 1, 5), acwr: acwr == null ? null : round1(acwr), tsb: tsb == null ? null : round1(tsb) }
}

// ENERGY (1–5) — acute autonomic readiness. Minimum dataset = HRV baseline + sleep; without an HRV
// baseline we return null (cold start) so the UI keeps the manual tap.
export function energy({ hrv, rhr, sleep, subjective, hrvBaseline, rhrBaseline } = {}) {
  const lnz = hrv != null && hrvBaseline && hrvBaseline.sd ? clamp(zscore(lnRMSSD(hrv), hrvBaseline.mean, hrvBaseline.sd), -2.5, 2.5) : null
  if (lnz == null) return null // no trustworthy HRV trend → don't fake Energy
  const rz = rhr != null && rhrBaseline && rhrBaseline.sd ? clamp(zscore(rhr, rhrBaseline.mean, rhrBaseline.sd), -2.5, 2.5) : null
  let hrvSub = zTo5(lnz, +1)
  const rhrSub = rz == null ? null : zTo5(rz, -1) // inverse: high RHR = worse
  // Parasympathetic-saturation guard: high HRV AND elevated RHR ⇒ suspect (fatigue masquerading), cap HRV's credit.
  const guard = lnz > 1 && rz != null && rz > 0.5
  if (guard) hrvSub = Math.min(hrvSub, 3.5)
  const comps = [], weights = []
  const add = (v, w) => { if (v != null) { comps.push(v * w); weights.push(w) } }
  add(hrvSub, 0.35); add(sleep, 0.35); add(rhrSub, 0.15); add(subjective, 0.15)
  const score = comps.reduce((a, b) => a + b, 0) / weights.reduce((a, b) => a + b, 0)
  return { score: clamp(round1(score), 1, 5), hrvZ: round1(lnz), rhrZ: rz == null ? null : round1(rz), guard }
}

// SLEEP (1–5) — prefer a device sleep score (0–100); else hours ÷ PERSONAL need (default 8h).
export function sleep({ sleepScore, sleepHours, sleepNeed = 8 } = {}) {
  if (sleepScore != null) return { score: score100To5(sleepScore), sleepScore }
  if (sleepHours != null) {
    const need = sleepNeed > 0 ? sleepNeed : 8
    const ratio = sleepHours / need
    return { score: clamp(round1(lerpMap(ratio, [[0.55, 1], [0.7, 2], [0.85, 3], [1.0, 4.5], [1.08, 5]])), 1, 5), sleepHours, sleepNeed: need }
  }
  return null
}

// --- top-level ------------------------------------------------------------
// history: wellness rows BEFORE today (for baselines). today: today's wellness row.
// opts: { sleepNeed, subjective } (subjective = the user's own tap 1–5, if given).
export function readiness(history = [], today = {}, { sleepNeed = 8, subjective } = {}) {
  const base = baselines(history)
  const sl = sleep({ sleepScore: today.sleepScore, sleepHours: today.sleepHours, sleepNeed })
  const fr = freshness({ atl: today.fatigue != null ? today.fatigue : today.atl, ctl: today.fitness != null ? today.fitness : today.ctl, form: today.form })
  const en = energy({ hrv: today.hrv, rhr: today.restingHR, sleep: sl && sl.score, subjective, hrvBaseline: base.hrvBaseline, rhrBaseline: base.rhrBaseline })
  return { sleep: sl, freshness: fr, energy: en, baseline: { nHrv: base.nHrv, nRhr: base.nRhr, hrvCV7: base.hrvCV7 == null ? null : round1(base.hrvCV7) } }
}
