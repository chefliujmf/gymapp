// #615/#620 — the PURE, unit-testable core of the week-shape ENFORCEMENT. weekShape decides the DOSE (how many
// quality days + the intensity ceiling); this CLAMPS a plan to it: no ride/run segment may exceed the ceiling %, and
// once the Mon–Sun week already has its allowed number of moderate/quality days any further hard session is forced to
// easy. The prompt-only "0 quality days for pregnancy" was IGNORED by the LLM, so we enforce it in code. Pure (no
// Date, no store, no I/O) so the full athlete matrix can be asserted in src/shape-enforce.test.ts.

import { CEILING_PCT } from './week-shape.js'
import { assignEasy } from './archetypes.js'

export const QUALITY_TITLE = /sweet.?spot|threshold|\bvo.?2\b|over.?under|\bvo2max\b/i // titles claiming a hard session
const TEMPO_TITLE = /\btempo\b/i

const topOf = (segs) => Math.max(0, ...(segs || []).map((s) => Math.max(Number(s.powerStart) || 0, Number(s.powerEnd) || 0)))
// a session counts as "moderate/quality" if its EFFORT is ≥ tempo OR its TITLE claims quality/tempo (the coach
// mislabels — a title-only "Sweet Spot Run"/"Tempo Run" with soft or no segments must still count so the week's
// allowance is real). Used SYMMETRICALLY for both the session being judged and its siblings (#620 — the asymmetry,
// where a tempo title counted against OTHERS' budget but was never clamped itself, is what let ALL tempo through).
export const isModerate = (p) => topOf(p && p.segments) >= CEILING_PCT.tempo || QUALITY_TITLE.test((p && p.title) || '') || TEMPO_TITLE.test((p && p.title) || '')

// the HONEST title for an enforced ceiling %. Easy relabels ROTATE (a distinct cue per date) instead of a flat
// "Easy Aerobic Run" every time; higher ceilings downgrade to the true level so a clamped title can't overstate.
export function honestTitle(effCeil, sport, date) {
  const noun = sport === 'run' ? 'Run' : sport === 'swim' ? 'Swim' : 'Ride'
  if (effCeil <= CEILING_PCT.endurance) {
    const cues = assignEasy({ sport, count: 6 }).map((c) => c.replace(/\s*\([^)]*\)\s*/g, '').trim())
    const idx = date ? (parseInt(String(date).replace(/-/g, ''), 10) % cues.length) : 0
    const cue = cues[idx] || `easy aerobic ${noun.toLowerCase()}`
    return cue.charAt(0).toUpperCase() + cue.slice(1)
  }
  if (effCeil <= CEILING_PCT.tempo) return `Tempo ${noun}`
  if (effCeil <= CEILING_PCT.sweetspot) return `Sweet-Spot ${noun}`
  if (effCeil <= CEILING_PCT.threshold) return `Threshold ${noun}`
  return `${noun} Intervals`
}

/**
 * Mutate `plan` (a ride/run) to satisfy `shape`, given its same-week ride/run `siblings` (the Mon–Sun window,
 * plan itself may be included — it's excluded by id). Clamps segment % to the ceiling; when the week's moderate
 * budget is already spent, forces this session to easy (endurance) and relabels an over-stated title honestly.
 * @returns {{changed:boolean, clamped:number, effCeil:number, overBudget:boolean}}
 */
export function enforceShape(shape, plan, siblings = []) {
  if (!plan || (plan.sport !== 'ride' && plan.sport !== 'run')) return { changed: false, clamped: 0, effCeil: 0, overBudget: false }
  const ceilPct = CEILING_PCT[shape.intensityCeiling] || CEILING_PCT.vo2
  const maxModerate = (shape.qualityDays || 0) + (shape.moderateDays || 0)
  const otherModerate = siblings.filter((p) => p && p.id !== plan.id && (p.sport === 'ride' || p.sport === 'run') && isModerate(p)).length
  const thisIsModerate = isModerate(plan)
  const overBudget = thisIsModerate && otherModerate >= maxModerate
  const effCeil = overBudget ? CEILING_PCT.endurance : ceilPct
  let clamped = 0
  for (const s of (plan.segments || [])) {
    if ((Number(s.powerStart) || 0) > effCeil) { s.powerStart = effCeil; clamped++ }
    if ((Number(s.powerEnd) || 0) > effCeil) { s.powerEnd = effCeil; clamped++ }
  }
  const titleLies = shape.loadBand === 'maintenance' && QUALITY_TITLE.test(plan.title || '')
  // an OVER-BUDGET tempo/quality session with NO segments still carries a "Tempo Run" title that must become easy —
  // clamped=0 (nothing to clamp) so without this the excess tempo title survives. This is the core "all tempo" fix.
  const overBudgetTitle = overBudget && (QUALITY_TITLE.test(plan.title || '') || TEMPO_TITLE.test(plan.title || ''))
  let changed = clamped > 0
  if (titleLies || overBudgetTitle || (clamped && QUALITY_TITLE.test(plan.title || ''))) {
    const t = honestTitle(effCeil, plan.sport, plan.date)
    if (t !== plan.title) { plan.title = t; changed = true }
  }
  return { changed, clamped, effCeil, overBudget }
}
