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
// #436 — a coach review score (/10, or null) → intervals' coach's-tick INTEGER rating 1–5 (what checks the
// "Coach ✓" on the activity). Must be a whole 1–5; a null score (reviewed, no number) → a neutral 3.
export const coachTick = (score10) => (score10 == null || Number.isNaN(Number(score10))) ? 3 : clamp(Math.round(Number(score10) / 2), 1, 5)
// Monotonic piecewise-linear map; clamps at the ends. pts = [[x,y]...] sorted by x.
export function lerpMap(x, pts) {
  if (x == null) return null
  if (x <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0) }
  }
  return pts[pts.length - 1][1]
}

import { cycleReadinessAdjust } from './cycle.js' // #329 — luteal RHR↑/HRV↓ correction
export const MIN_BASELINE_DAYS = 14 // below this we can't trust a personal baseline → fall back to manual

// --- personal baselines from wellness history -----------------------------
// history: [{ date, hrv, restingHR }, ...] (older → newer). Excludes today's row ideally.
export function baselines(history = []) {
  const lnHrv = history.map((w) => lnRMSSD(w && w.hrv)).filter((x) => x != null)
  const rawHrv = history.map((w) => (w && w.hrv != null ? Number(w.hrv) : null)).filter((x) => x != null && x > 0) // raw rmssd ms, for the range shown to the athlete (#373)
  const rhr = history.map((w) => (w && w.restingHR != null ? w.restingHR : null)).filter((x) => x != null)
  const tsb = history.map((w) => (!w ? null : w.form != null ? w.form : (w.fitness != null && w.fatigue != null ? w.fitness - w.fatigue : null))).filter((x) => x != null)
  return {
    hrvBaseline: lnHrv.length >= MIN_BASELINE_DAYS ? meanSd(lnHrv) : null,
    rhrBaseline: rhr.length >= MIN_BASELINE_DAYS ? meanSd(rhr) : null,
    tsbBaseline: tsb.length >= MIN_BASELINE_DAYS ? meanSd(tsb) : null, // #207 personal load range
    hrvCV7: coefVar(history.slice(-7).map((w) => lnRMSSD(w && w.hrv))), // 7-day volatility (overtraining lever)
    // #373 — the actual KNOWN range (raw ms), so the Energy ⓘ can show "HRV 42 (your range 28–58)".
    hrvMin: rawHrv.length ? Math.round(Math.min(...rawHrv)) : null, hrvMax: rawHrv.length ? Math.round(Math.max(...rawHrv)) : null,
    rhrMin: rhr.length ? Math.round(Math.min(...rhr)) : null, rhrMax: rhr.length ? Math.round(Math.max(...rhr)) : null,
    nHrv: lnHrv.length, nRhr: rhr.length, nTsb: tsb.length,
  }
}

// --- the three scores -----------------------------------------------------

// FRESHNESS (1–5) — training-load freshness from ACWR (ATL/CTL) + TSB/Form (CTL−ATL). Objective.
export function freshness({ atl, ctl, form, tsbBaseline } = {}) {
  const acwr = atl != null && ctl != null && ctl > 0 ? atl / ctl : null
  const tsb = form != null ? form : (ctl != null && atl != null ? ctl - atl : null)
  // Recalibrated 2026-06-29 (JM: the research table was too conservative — it scored the normal
  // PRODUCTIVE-training zone as the middle). Anchored to TrainingPeaks Form zones + the ACWR injury
  // "sweet spot" 0.8–1.3 (low risk = good): a BALANCED state (Form ~0 / ACWR ~1) reads ~4 ("fresh
  // enough"); 5 is reserved for tapered/fresh (Form ≥ +12); it only drops to 2–1 as real fatigue
  // accumulates (Form < −10, ACWR > 1.3).
  const a = acwr == null ? null : lerpMap(acwr, [[0.8, 5], [1.0, 4.3], [1.25, 3.5], [1.5, 2.5], [1.8, 1.5], [2.2, 1]])
  const t = tsb == null ? null : lerpMap(tsb, [[-35, 1], [-22, 2], [-10, 3], [0, 4], [12, 5]])
  const parts = [a, t].filter((x) => x != null)
  if (!parts.length) return null
  let score = parts.reduce((s, x) => s + x, 0) / parts.length
  // #207 PERSONALIZATION: the zone score above is the absolute anchor (keeps "positive Form = fresh"
  // + the less-conservative neutral). On top, learn from the athlete's OWN load range — z-score today's
  // TSB vs their rolling baseline and nudge ±1: a day that's unusually LOADED *for you* reads lower, an
  // unusually RESTED one reads higher, while your typical day stays at the anchor (~4). sd is floored so
  // a very steady athlete isn't over-amplified. Mirrors how Energy already personalizes HRV/RHR.
  let personalZ = null
  if (tsb != null && tsbBaseline && tsbBaseline.sd) {
    personalZ = clamp(zscore(tsb, tsbBaseline.mean, Math.max(tsbBaseline.sd, 3)), -2.5, 2.5)
    score = score + clamp(personalZ * 0.5, -1, 1)
  }
  if (tsb != null && tsb < -30) score = Math.min(score, 1.5) // deep volume block → override down
  return { score: clamp(round1(score), 1, 5), acwr: acwr == null ? null : round1(acwr), tsb: tsb == null ? null : round1(tsb), personalZ: personalZ == null ? null : round1(personalZ) }
}

// #375 — WEEKLY LOAD BUDGET, a BAND (not just a ceiling). CTL×7 holds fitness flat (maintenance/recovery). A
// PRODUCTIVE build must actually create stimulus: aim ~CTL×9-11 so Form dips into the green productive zone
// (~-10 to -20 here). Too LOW (near ×7) = grey junk-miles that waste the week (the #375 over-correction — JM:
// "I don't go in green still"); too HIGH (past ~CTL×12) craters Form (overreach) — only as a NAMED overload
// block + a following recovery week. Coach should VERIFY the week lands in green with the Form forecast, not
// just trust the multiple (TSS→Form depends on distribution + starting Form).
export function weeklyLoadBudget(ctl) {
  if (ctl == null || !(Number(ctl) > 0)) return null
  const c = Number(ctl)
  return { sustainable: Math.round(c * 7), build: Math.round(c * 9), hard: Math.round(c * 11), cap: Math.round(c * 12) }
}

// ENERGY (1–5) — acute autonomic readiness. Minimum dataset = HRV baseline + sleep; without an HRV
// baseline we return null (cold start) so the UI keeps the manual tap.
// #315 — population fallback baselines so a NEW athlete (no 14-day personal baseline yet) still gets
// an Energy estimate from today's HRV/RHR instead of a blank. ln(rmssd) ≈ ln(45 ms); RHR ≈ 60 bpm.
// Flagged `provisional` until the personal baseline takes over (it self-personalises as data accrues).
export const POP_HRV_BASELINE = { mean: Math.log(45), sd: 0.45 }
export const POP_RHR_BASELINE = { mean: 60, sd: 9 }
export function energy({ hrv, rhr, sleep, subjective, hrvBaseline, rhrBaseline, cycleAdjust } = {}) {
  // #329 — the luteal phase hormonally RAISES resting HR and SUPPRESSES HRV. That's not fatigue, so
  // correct today's reading by the phase's expected shift BEFORE scoring, or Energy is wrongly docked.
  const ca = cycleAdjust || { rhrBpm: 0, hrvPct: 0 }
  const hrvC = hrv != null ? hrv * (1 + (ca.hrvPct || 0) / 100) : hrv // add back the suppressed %
  const rhrC = rhr != null ? rhr - (ca.rhrBpm || 0) : rhr             // remove the hormonal elevation
  // Prefer the athlete's OWN baseline; fall back to population norms so we compute SOMETHING (#315).
  const hb = hrvBaseline && hrvBaseline.sd ? hrvBaseline : (hrvC != null ? POP_HRV_BASELINE : null)
  const provisional = !(hrvBaseline && hrvBaseline.sd) && !!hb
  const lnz = hrvC != null && hb && hb.sd ? clamp(zscore(lnRMSSD(hrvC), hb.mean, hb.sd), -2.5, 2.5) : null
  if (lnz == null) return null // truly no HRV at all → keep the manual tap
  const rb = rhrBaseline && rhrBaseline.sd ? rhrBaseline : (rhrC != null ? POP_RHR_BASELINE : null)
  const rz = rhrC != null && rb && rb.sd ? clamp(zscore(rhrC, rb.mean, rb.sd), -2.5, 2.5) : null
  let hrvSub = zTo5(lnz, +1)
  const rhrSub = rz == null ? null : zTo5(rz, -1) // inverse: high RHR = worse
  // Parasympathetic-saturation guard: high HRV AND elevated RHR ⇒ suspect (fatigue masquerading), cap HRV's credit.
  const guard = lnz > 1 && rz != null && rz > 0.5
  if (guard) hrvSub = Math.min(hrvSub, 3.5)
  const comps = [], weights = []
  const add = (v, w) => { if (v != null) { comps.push(v * w); weights.push(w) } }
  add(hrvSub, 0.35); add(sleep, 0.35); add(rhrSub, 0.15); add(subjective, 0.15)
  const score = comps.reduce((a, b) => a + b, 0) / weights.reduce((a, b) => a + b, 0)
  return { score: clamp(round1(score), 1, 5), hrvZ: round1(lnz), rhrZ: rz == null ? null : round1(rz), guard, provisional }
}

// SLEEP (1–5) — prefer a device sleep score (0–100); else hours ÷ PERSONAL need (default 8h).
// #159 — ALWAYS carry sleepHours + sleepNeed (even when a tracker score drives the number) so the "why"
// can show the actionable basis (Xh slept vs your ~Yh need), not just a bare "75/100".
export function sleep({ sleepScore, sleepHours, sleepNeed = 8 } = {}) {
  const need = sleepNeed > 0 ? sleepNeed : 8
  if (sleepScore != null) return { score: score100To5(sleepScore), sleepScore, sleepHours: sleepHours ?? null, sleepNeed: need }
  if (sleepHours != null) {
    const ratio = sleepHours / need
    return { score: clamp(round1(lerpMap(ratio, [[0.55, 1], [0.7, 2], [0.85, 3], [1.0, 4.5], [1.08, 5]])), 1, 5), sleepHours, sleepNeed: need }
  }
  return null
}

// --- #207 Phase 2b: LEARN a personal calibration from the athlete's own overrides ----------
// The auto scores are a model; the athlete is the ground truth. When they systematically edit a
// computed score the same direction, drift the model toward them — GRADUALLY (needs ≥5 days of
// signal, grows with evidence, capped ±1), so one off day can't swing it. As the auto score
// converges on the athlete, the residual deltas shrink and the offset stabilises. This is the
// "learn about ME / it changes over time" JM asked for (#207/#220).
export const MIN_CALIBRATION_DAYS = 5

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

/** Gradual-drift offset for ONE dimension from its (user − auto) deltas. 0 until enough, evidence-
 *  weighted, bounded ±1; tiny biases (<0.2) ignored. Uses the MEDIAN so a single extreme day can't
 *  swing it — we want the athlete's TYPICAL disagreement, not an outlier-pulled mean. */
export function calibrationOffset(deltas = []) {
  const v = deltas.filter((d) => d != null && Number.isFinite(d))
  if (v.length < MIN_CALIBRATION_DAYS) return 0
  const confidence = Math.min(1, v.length / 10) // full weight by ~10 days of signal
  const off = clamp(round1(median(v) * confidence), -1, 1)
  return Math.abs(off) < 0.2 ? 0 : off
}

/** Per-dimension learned offsets (sleep/freshness/energy, DISPLAY terms) from past check-ins that
 *  recorded the auto value they were shown. Freshness in display terms = 6 − soreness tap. */
export function learnedOffsets(checkins = []) {
  const deltas = { energy: [], sleep: [], freshness: [] }
  for (const c of checkins) {
    if (!c || !c.auto) continue
    const user = { energy: c.energy, sleep: c.sleep, freshness: c.soreness != null ? 6 - c.soreness : null }
    for (const d of ['energy', 'sleep', 'freshness']) {
      if (c.auto[d] != null && user[d] != null) deltas[d].push(user[d] - c.auto[d])
    }
  }
  return { energy: calibrationOffset(deltas.energy), sleep: calibrationOffset(deltas.sleep), freshness: calibrationOffset(deltas.freshness) }
}

/** Apply a learned offset to a 1–5 score (clamped). Reports the nudge so the UI can say "calibrated". */
export const applyOffset = (score, offset) => (score == null || !offset ? score : clamp(round1(score + offset), 1, 5))

// #207 Part 4 — VO₂max estimate (ml/kg/min) from the best aerobic measure: cycling eFTP÷weight
// (Coggan 10.8·W/kg+7) and/or running VDOT (a VO₂max itself). Returns the higher + its source, or
// null. Mirrors src/running-paces.ts estimateVo2max so the COACH (server) judges intensity FOR them.
export function estimateVo2max({ ftp, weightKg, vdot } = {}) {
  const cands = []
  if (ftp && weightKg && weightKg > 0) cands.push({ value: round1(10.8 * ftp / weightKg + 7), from: 'cycling power ÷ weight' })
  if (vdot && vdot > 0) cands.push({ value: Math.round(vdot), from: 'running pace (VDOT)' })
  if (!cands.length) return null
  return cands.reduce((a, b) => (b.value > a.value ? b : a))
}

// #236 — HR-ratio VO₂max (submaximal) + a best per-sport estimate, mirroring src/vo2max-submax.ts,
// so the COACH's "computed" VO₂max matches what the athlete sees. (Coach reads statPrefs per stat.)
export function hrRatioVo2max(hrMax, hrRest) {
  if (!hrMax || !hrRest || hrMax <= hrRest) return null
  return round1(15.3 * hrMax / hrRest)
}
export function bestVo2maxEstimate({ ftp, weightKg, vdot, hrMax, hrRest } = {}) {
  const hr = hrRatioVo2max(hrMax, hrRest)
  const run = vdot && hr ? Math.max(vdot, hr) : (vdot || hr || null) // running: VDOT vs HR-ratio, higher wins
  const cyc = ftp && weightKg && weightKg > 0 ? round1(10.8 * ftp / weightKg + 7) : (hr ? round1(hr * 0.95) : null)
  const best = Math.max(run || 0, cyc || 0)
  if (!best) return null
  const source = best === run ? (run === hr ? 'max & resting HR' : 'running pace') : 'power ÷ weight'
  return { value: round1(best), source }
}

// --- #223: FORECAST a future day's freshness from planned load ----------------------------
// Only FRESHNESS is forecastable ahead (it's training-load driven). Energy/Sleep depend on HRV/
// sleep that haven't happened, so a future day shows an expected Freshness, not a live verdict.
// Standard CTL/ATL exponential model: CTL τ=42, ATL τ=7; Form (TSB) = CTL − ATL.
export function projectForm({ ctl = 0, atl = 0 } = {}, plannedLoads = []) {
  let c = ctl, a = atl
  for (const load of plannedLoads) {
    const L = load > 0 ? load : 0
    c = c + (L - c) / 42
    a = a + (L - a) / 7
  }
  return { ctl: round1(c), atl: round1(a), form: round1(c - a) }
}

/** Per-day CTL/ATL/Form projection over planned loads (for the Fitness/Form forward-projection chart, #248). */
export function projectFormSeries({ ctl = 0, atl = 0 } = {}, plannedLoads = []) {
  let c = ctl, a = atl
  // form derives from the ROUNDED ctl/atl so it always equals what's displayed (ctl − atl).
  return plannedLoads.map((load) => { const L = load > 0 ? load : 0; c = c + (L - c) / 42; a = a + (L - a) / 7; const rc = round1(c), ra = round1(a); return { ctl: rc, atl: ra, form: round1(rc - ra) } })
}

// --- periodized 4-week load forecast (#393) -------------------------------
// Past the coach's detailed ~2-week plan, the forecast used a FLAT held-load (≈CTL every day) which read
// as lifeless. Instead we project the coach's periodized WEEKLY LOAD BLOCKS (build/peak/recovery), each
// week's TSS target spread across its training days with the athlete's real rest pattern. Pure + tz-stable
// (date-only strings, noon-UTC so DST can't shift a day).
const _dow = (d) => new Date(d + 'T12:00:00Z').getUTCDay()           // 0=Sun..6=Sat
const _addDays = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
/** ISO Monday (0=Mon week) on/before `d`, as 'YYYY-MM-DD'. */
export function isoMonday(d) { const wd = (_dow(d) + 6) % 7; return _addDays(d, -wd) }

/** A sensible DEFAULT periodized weekly-load plan from CTL — a repeating 4-week block
 *  (build · build · peak · recovery) sized off `weeklyLoadBudget`. The coach OVERRIDES this with its own
 *  authored blocks (user.info.loadPlan); this is the seed + fallback so the forecast is never flat. */
export function defaultLoadPlan(ctl, firstMonday, weeks = 6) {
  const b = weeklyLoadBudget(ctl)
  if (!b || !firstMonday) return []
  const cycle = [{ t: b.build, p: 'build' }, { t: b.build, p: 'build' }, { t: b.hard, p: 'peak' }, { t: Math.round(b.sustainable * 0.8), p: 'recovery' }]
  const out = []
  for (let i = 0; i < weeks; i++) { const c = cycle[i % cycle.length]; out.push({ weekStart: _addDays(firstMonday, i * 7), target: c.t, phase: c.p }) }
  return out
}

/** The athlete's typical REST day-of-weeks (0=Sun) from recent daily loads — a DOW that's ~0 load ≥60% of
 *  the time. `loadsByDate` = {'YYYY-MM-DD': tss}. Falls back to [1] (Monday) when there's no clear pattern. */
export function recentRestDows(loadsByDate = {}) {
  const seen = {}, rest = {}
  for (const [d, L] of Object.entries(loadsByDate)) { const wd = _dow(d); seen[wd] = (seen[wd] || 0) + 1; if (!(Number(L) > 5)) rest[wd] = (rest[wd] || 0) + 1 }
  const out = []
  for (let wd = 0; wd < 7; wd++) if (seen[wd] >= 2 && (rest[wd] || 0) / seen[wd] >= 0.6) out.push(wd)
  return out.length ? out : [1]
}

/** Spread periodized weekly-load blocks into a daily TSS map for [from..to] (inclusive, date strings).
 *  Each week's `target` is distributed across its NON-rest days; weekend days (Sat/Sun) weighted heavier
 *  (long endurance). blocks: [{weekStart:isoMonday, target}]; a week with no block uses the nearest prior. */
export function periodizedLoads(from, to, blocks, { restDows = [1], weekendBoost = 1.35 } = {}) {
  if (!blocks || !blocks.length || from > to) return {}
  const byWeek = {}; for (const b of blocks) if (b && b.weekStart != null && b.target != null) byWeek[b.weekStart] = Math.max(0, Number(b.target) || 0)
  const weeks = Object.keys(byWeek).sort()
  if (!weeks.length) return {}
  const targetFor = (mon) => { let last = byWeek[weeks[0]]; for (const w of weeks) { if (w <= mon) last = byWeek[w]; else break } return last }
  const out = {}
  for (let mon = isoMonday(from); mon <= isoMonday(to); mon = _addDays(mon, 7)) {
    const target = targetFor(mon)
    const days = []; let wsum = 0
    for (let i = 0; i < 7; i++) { const date = _addDays(mon, i); const wd = _dow(date); const w = restDows.includes(wd) ? 0 : (wd === 0 || wd === 6 ? weekendBoost : 1); days.push({ date, w }); wsum += w }
    for (const dd of days) if (dd.date >= from && dd.date <= to) out[dd.date] = wsum > 0 ? Math.round((dd.w / wsum) * target) : 0
  }
  return out
}

/** Expected freshness (1–5) at a future date: project Form over the planned loads, then map.
 *  `plannedLoads` = TSS per day from the day AFTER `current` up to and including the target. */
export function forecastFreshness({ ctl, atl, tsbBaseline } = {}, plannedLoads = []) {
  const p = projectForm({ ctl, atl }, plannedLoads)
  const fr = freshness({ atl: p.atl, ctl: p.ctl, form: p.form, tsbBaseline })
  return { ...p, freshness: fr ? fr.score : null, acwr: fr ? fr.acwr : null }
}

// --- top-level ------------------------------------------------------------
// history: wellness rows BEFORE today (for baselines). today: today's wellness row.
// opts: { sleepNeed, subjective, checkins } (subjective = user's tap; checkins = for calibration).
export function readiness(history = [], today = {}, { sleepNeed = 8, subjective, checkins = [], cyclePhase = null } = {}) {
  const base = baselines(history)
  const sl = sleep({ sleepScore: today.sleepScore, sleepHours: today.sleepHours, sleepNeed })
  const fr = freshness({ atl: today.fatigue != null ? today.fatigue : today.atl, ctl: today.fitness != null ? today.fitness : today.ctl, form: today.form, tsbBaseline: base.tsbBaseline })
  // #329 — don't penalise Energy for the luteal phase's hormonal RHR↑/HRV↓ (correct today's reading).
  const cycAdj = cyclePhase ? cycleReadinessAdjust(cyclePhase) : null
  const en = energy({ hrv: today.hrv, rhr: today.restingHR, sleep: sl && sl.score, subjective, hrvBaseline: base.hrvBaseline, rhrBaseline: base.rhrBaseline, cycleAdjust: cycAdj })
  // #207 Phase 2b: nudge each auto score toward what THIS athlete has consistently reported.
  const off = learnedOffsets(checkins)
  if (sl) { sl.raw = sl.score; sl.score = applyOffset(sl.score, off.sleep) }
  if (fr) { fr.raw = fr.score; fr.score = applyOffset(fr.score, off.freshness) }
  if (en) {
    en.raw = en.score; en.score = applyOffset(en.score, off.energy)
    // #315/#319 — while on population norms, tell the UI how many more HRV nights until Energy is
    // personalised (so it shows "building · N more nights", not a blank).
    if (en.provisional) en.needDays = Math.max(1, MIN_BASELINE_DAYS - base.nHrv)
  }
  return { sleep: sl, freshness: fr, energy: en, calibration: off, baseline: { nHrv: base.nHrv, nRhr: base.nRhr, hrvCV7: base.hrvCV7 == null ? null : round1(base.hrvCV7), hrvMin: base.hrvMin, hrvMax: base.hrvMax, rhrMin: base.rhrMin, rhrMax: base.rhrMax } }
}
