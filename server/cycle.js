// #329 — MENSTRUAL-CYCLE factor for coaching + readiness. Pure + unit-tested (src/cycle.test.ts).
//
// Two effects, both phase-driven:
//   (a) LOAD modifier — how hard to program this phase (push in follicular/ovulatory; ease late-luteal
//       & symptomatic menses). A MULTIPLIER on planned intensity/volume.
//   (b) READINESS interpretation — the luteal phase RAISES resting HR (~+2–5 bpm) and core temp and
//       LOWERS HRV (~−5–10%) for HORMONAL reasons, not fatigue. We hand these expected shifts back so
//       Energy isn't docked for a normal luteal reading (server/readiness.js applies them).
//
// Phase source: intervals wellness `menstrualPhase` (+ `menstrualPhasePredicted`) when present; else
// derived from cycle day + typical length (the coach asks for the last period start if unknown).
// Individual variation is large — these are DEFAULTS the coach confirms against her tracked symptoms.

export const PHASES = ['menstrual', 'follicular', 'ovulatory', 'luteal', 'late_luteal']

/** Map intervals' menstrualPhase text (or our own) to a canonical phase. */
export function normalizePhase(v) {
  const s = String(v || '').toLowerCase().trim()
  if (!s) return null
  if (/(menstr|period|bleed|menses)/.test(s)) return 'menstrual'
  if (/ovulat/.test(s)) return 'ovulatory'
  if (/late.?luteal|pms|premenstr/.test(s)) return 'late_luteal'
  if (/luteal/.test(s)) return 'luteal'
  if (/follic/.test(s)) return 'follicular'
  return null
}

/** Derive phase from cycle day (1-based) + typical length. Scales the luteal window to length. */
export function phaseFromDay(day, cycleLen = 28) {
  const L = Math.max(21, Math.min(40, Number(cycleLen) || 28))
  const d = ((Math.round(Number(day)) - 1) % L + L) % L + 1 // wrap into 1..L
  const ovul = L - 14 // ovulation ~14 days before next period
  if (d <= 5) return 'menstrual'
  if (d < ovul) return 'follicular'
  if (d <= ovul + 1) return 'ovulatory'
  if (d >= L - 2) return 'late_luteal'
  return 'luteal'
}

/**
 * #422 — derive the CURRENT phase from a WELLNESS HISTORY when intervals only marks the period-START
 * day (it does NOT fill/predict every day forward — Xenia logged PERIOD on the 3rd, every other day is
 * null). Finds the most recent logged 'menstrual' (period) day on-or-before `date` = cycle day 1, then
 * projects with phaseFromDay. Returns null if there's no period marker, or the last one is stale (more
 * than a cycle+10 days ago → don't project a phantom phase). `rows` = [{ date:'YYYY-MM-DD',
 * menstrualPhase }], any order. This is what stops us re-asking her for a date intervals already has.
 */
export function phaseFromHistory(rows = [], date, cycleLen = 28) {
  if (!date || !Array.isArray(rows)) return null
  const L = Math.max(21, Math.min(40, Number(cycleLen) || 28))
  const start = rows
    .filter((r) => r && r.date && r.date <= date && normalizePhase(r.menstrualPhase) === 'menstrual')
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0] // most recent period marker first
  if (!start) return null
  const day = Math.floor((new Date(date) - new Date(start.date)) / 86400000) + 1
  if (day < 1 || day > L + 10) return null // last period too long ago → don't project a stale phase
  return phaseFromDay(day, L)
}

/** (a) Load multiplier for planned intensity/volume this phase. */
export function cycleLoadModifier(phase) {
  return { menstrual: 0.90, follicular: 1.05, ovulatory: 1.00, luteal: 0.95, late_luteal: 0.85 }[phase] ?? 1.0
}

/** (b) Expected HORMONAL shift in today's wellness for this phase — so readiness does NOT penalise it.
 *  rhrBpm = bpm the resting HR is expected to sit ABOVE baseline; hrvPct = % HRV is expected BELOW. */
export function cycleReadinessAdjust(phase) {
  const M = {
    menstrual:   { rhrBpm: 1, hrvPct: 3 },
    follicular:  { rhrBpm: 0, hrvPct: 0 },
    ovulatory:   { rhrBpm: 1, hrvPct: 2 },
    luteal:      { rhrBpm: 3, hrvPct: 6 },
    late_luteal: { rhrBpm: 5, hrvPct: 10 },
  }
  return M[phase] || { rhrBpm: 0, hrvPct: 0 }
}

/** One-line coaching guidance per phase (the female module expands on it). */
export function cycleGuidance(phase) {
  return {
    menstrual: 'Menses — many train normally; ease only if symptomatic (cramps/heavy flow/low iron). Prioritise iron-rich fuel.',
    follicular: 'Follicular — GREEN LIGHT: best window for intensity, PRs and hard intervals; recovery is strong.',
    ovulatory: 'Ovulation — high output, but oestrogen raises ligament laxity → warm up well, watch heavy/plyometric landing mechanics.',
    luteal: 'Luteal — slightly higher perceived effort + core temp; keep quality but trim top-end volume, hydrate, fuel carbs.',
    late_luteal: 'Late luteal / PMS — down-shift: fewer/shorter hard efforts, more Z2 + recovery, extra carbs, sleep, magnesium; expect a naturally higher RHR / lower HRV.',
  }[phase] || ''
}

/** Full phase summary for a coach prompt + readiness. */
export function cycleContext({ phase, cycleDay, cycleLength = 28 } = {}) {
  const ph = normalizePhase(phase) || (cycleDay != null ? phaseFromDay(cycleDay, cycleLength) : null)
  if (!ph) return null
  return { phase: ph, loadModifier: cycleLoadModifier(ph), readinessAdjust: cycleReadinessAdjust(ph), guidance: cycleGuidance(ph) }
}

/**
 * #427 — gestational stage from a pregnancy state. `info.pregnant` + either `info.dueDate` (EDD) or
 * `info.pregnancyStart` (LMP). 40 wk = 280 d gestation. Returns weeks (1 decimal) + trimester (1/2/3),
 * or null weeks/trimester when no date is known (so the coach can still say "pregnant, ask her EDD").
 * Returns null entirely when NOT pregnant — that's the signal to run the normal menstrual-cycle logic.
 * During pregnancy there is NO cycle: callers must SKIP phaseFromHistory/cycleContext when this is set.
 */
export function pregnancyStage(info = {}, date) {
  if (!info || !info.pregnant) return null
  const today = date ? new Date(date) : null
  let weeks = null
  if (today && info.dueDate) weeks = (280 - Math.round((new Date(info.dueDate) - today) / 86400000)) / 7
  else if (today && info.pregnancyStart) weeks = Math.round((today - new Date(info.pregnancyStart)) / 86400000) / 7
  const w = weeks == null || !isFinite(weeks) ? null : Math.max(0, Math.min(43, Math.round(weeks * 10) / 10))
  const trimester = w == null ? null : w < 14 ? 1 : w < 28 ? 2 : 3
  return { pregnant: true, weeks: w, trimester, dueDate: info.dueDate || null }
}

// #650 — PRIVACY SCRUB (safety-critical, ENFORCED in code, not just prompted). Pregnancy / postpartum is PRIVATE and
// must NEVER appear in a workout TITLE / DESCRIPTION or the PUBLIC activity text (which syncs to Strava). The coach is
// told this, but an LLM can slip — so strip the terms in code at every write chokepoint. Universal (these words never
// belong in a fitness plan title/public text for anyone) + idempotent. Pure + unit-tested. NB: kept narrow to clear
// pregnancy + menstrual-cycle terms (no bare "bump"/"period" — too ambiguous) so it never mangles legit copy like
// "bump up the pace". #13 (audit) — menstrual status is PRIVATE too: scrub luteal/follicular/PMS/menstrual/ovulation
// from any public activity text, same as pregnancy (they syncs to Strava). Bare "period" is left (a period of time).
const privateRe = () => /\b(pregnan\w*|prenatal|ante-?natal|trimesters?|postpartum|post-?partum|gestation\w*|baby[ -]?bump|menstru\w*|luteal|follicular|ovulat\w*|premenstrual|PMS)\b/gi
export function scrubPrivate(text) {
  if (!text || typeof text !== 'string') return text
  if (!privateRe().test(text)) return text
  return text
    .replace(privateRe(), '')
    .replace(/\s{2,}/g, ' ')                       // collapse doubled spaces left behind
    .replace(/\s+([.,;:!?)])/g, '$1')              // no space before punctuation
    .replace(/([([])\s+/g, '$1')                   // no space after an opening bracket
    .replace(/^[\s\-–—:,.]+|[\s\-–—:,]+$/g, '')    // trim leftover leading/trailing junk
    .trim()
}
