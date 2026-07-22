// #615/#620 — the PURE, unit-testable core of the week-shape ENFORCEMENT. weekShape decides the DOSE (how many
// quality days + the intensity ceiling); this CLAMPS a plan to it: no ride/run segment may exceed the ceiling %, and
// once the Mon–Sun week already has its allowed number of moderate/quality days any further hard session is forced to
// easy. The prompt-only "0 quality days for pregnancy" was IGNORED by the LLM, so we enforce it in code. Pure (no
// Date, no store, no I/O) so the full athlete matrix can be asserted in src/shape-enforce.test.ts.

import { CEILING_PCT } from './week-shape.js'
import { assignEasy } from './archetypes.js'

export const QUALITY_TITLE = /sweet.?spot|threshold|\bvo.?2\b|over.?under|\bvo2max\b/i // titles claiming a hard session
const TEMPO_TITLE = /\btempo\b/i
// #632 — SURGE / variable-intensity sessions (fartlek, surges, pickups, hill reps) spike intensity above their
// average, so they're inappropriate on a MAINTENANCE week (pregnancy) even when the average sits under the ceiling.
// A maintenance athlete's fartlek/surge title is relabeled to a STEADY session (JM: "no fartlek for pregnancy").
const SURGE_TITLE = /fartlek|surge|pick.?up|hill.?rep|\bsprint/i
// #672 — when a maintenance athlete's surge session is relabeled to steady, the coach's DESCRIPTION prose can still
// describe surges ("5 unstructured effort bursts by feel"), contradicting the new title + prescribing contraindicated
// efforts. Neutralize that language so the body agrees with the relabeled title. Conservative + unit-tested.
const SURGE_PROSE = /\b\d*\s*(?:short |unstructured |relaxed |quick )*(?:effort |hard |fast |all-?out )*(?:bursts?|surges?|pick.?ups?|accelerations?|sprints?|hard efforts?|hard reps?|fartlek)\b(?:\s+of\s+[^.,;]*)?/gi
export function scrubSurgeProse(text) {
  if (!text || typeof text !== 'string' || !SURGE_PROSE.test(text)) return text
  return text.replace(SURGE_PROSE, 'steady running by feel').replace(/\bwith steady running by feel\b/gi, 'at a steady, comfortable effort').replace(/\s{2,}/g, ' ').replace(/\s+([.,;])/g, '$1').trim()
}

const topOf = (segs) => Math.max(0, ...(segs || []).map((s) => Math.max(Number(s.powerStart) || 0, Number(s.powerEnd) || 0)))
// a session counts as "moderate/quality" if its EFFORT is ≥ tempo OR its TITLE claims quality/tempo (the coach
// mislabels — a title-only "Sweet Spot Run"/"Tempo Run" with soft or no segments must still count so the week's
// allowance is real). Used SYMMETRICALLY for both the session being judged and its siblings (#620 — the asymmetry,
// where a tempo title counted against OTHERS' budget but was never clamped itself, is what let ALL tempo through).
export const isModerate = (p) => topOf(p && p.segments) >= CEILING_PCT.tempo || QUALITY_TITLE.test((p && p.title) || '') || TEMPO_TITLE.test((p && p.title) || '')

// #717 (audit) — CONCURRENT-TRAINING interference: heavy strength ±1 day of a QUALITY endurance session blunts BOTH.
// These pure helpers give buildSystemPrompt the exact quality-endurance dates to schedule strength away from, and let
// the daily sweep DETECT a collision for logging. (Auto-moving is deliberately NOT done — too risky; the code-computed
// constraint + detection is the safe enforcement layer.)
const addDaysISO = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
export function qualityEnduranceDates(plans, today, days = 14) {
  const end = addDaysISO(today, days)
  const out = new Set()
  for (const p of plans || []) {
    if (!p || !p.date || p.date < today || p.date > end) continue
    if ((p.sport === 'ride' || p.sport === 'run' || p.sport === 'swim') && isModerate(p)) out.add(p.date)
  }
  return [...out].sort()
}
// a gym plan is a HEAVY strength session if it carries low-rep main lifts (the interference-heavy kind).
const isHeavyGym = (p) => p && p.sport === 'gym' && Array.isArray(p.exercises) && p.exercises.some((e) => e && e.mode !== 'timed' && Number(e.reps) > 0 && Number(e.reps) <= 6 && Number(e.sets) >= 3)
export function concurrentGymCollisions(plans, today, days = 14) {
  const q = new Set(qualityEnduranceDates(plans, today, days))
  const out = []
  for (const p of plans || []) {
    if (!p || !p.date || p.date < today || !isHeavyGym(p)) continue
    if (q.has(addDaysISO(p.date, -1)) || q.has(addDaysISO(p.date, 1))) out.push(p)
  }
  return out
}

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
const ENDURANCE_SPORTS = new Set(['ride', 'run', 'swim']) // #620 — swim carries the same %threshold-pace segments, so it's clamped too
export function enforceShape(shape, plan, siblings = []) {
  if (!plan || !ENDURANCE_SPORTS.has(plan.sport)) return { changed: false, clamped: 0, effCeil: 0, overBudget: false }
  const ceilPct = CEILING_PCT[shape.intensityCeiling] || CEILING_PCT.vo2
  const maxModerate = (shape.qualityDays || 0) + (shape.moderateDays || 0)
  const otherModerate = siblings.filter((p) => p && p.id !== plan.id && ENDURANCE_SPORTS.has(p.sport) && isModerate(p)).length
  const thisIsModerate = isModerate(plan)
  const overBudget = thisIsModerate && otherModerate >= maxModerate
  const effCeil = overBudget ? CEILING_PCT.endurance : ceilPct
  let clamped = 0
  for (const s of (plan.segments || [])) {
    if ((Number(s.powerStart) || 0) > effCeil) { s.powerStart = effCeil; clamped++ }
    if ((Number(s.powerEnd) || 0) > effCeil) { s.powerEnd = effCeil; clamped++ }
  }
  // a maintenance athlete (pregnancy) must not carry a quality-claiming OR a surge/fartlek title (#632).
  const wasSurge = shape.loadBand === 'maintenance' && SURGE_TITLE.test(plan.title || '')
  const titleLies = shape.loadBand === 'maintenance' && (QUALITY_TITLE.test(plan.title || '') || SURGE_TITLE.test(plan.title || ''))
  // an OVER-BUDGET tempo/quality session with NO segments still carries a "Tempo Run" title that must become easy —
  // clamped=0 (nothing to clamp) so without this the excess tempo title survives. This is the core "all tempo" fix.
  const overBudgetTitle = overBudget && (QUALITY_TITLE.test(plan.title || '') || TEMPO_TITLE.test(plan.title || ''))
  let changed = clamped > 0
  if (titleLies || overBudgetTitle || (clamped && QUALITY_TITLE.test(plan.title || ''))) {
    // a maintenance surge title becomes a STEADY session at the same ceiling (Tempo/Easy), not a relabel that keeps the surge
    const t = honestTitle(effCeil, plan.sport, plan.date)
    if (t !== plan.title) { plan.title = t; changed = true }
  }
  // #672 — neutralize surge/burst PROSE on ANY maintenance session (NOT gated on the current title being a surge — the
  // title may already have been relabeled to "Tempo Run" in a prior sweep, orphaning the "effort bursts" prose forever).
  if (shape.loadBand === 'maintenance') for (const k of ['objective', 'notes', 'success']) { if (typeof plan[k] === 'string') { const v = scrubSurgeProse(plan[k]); if (v !== plan[k]) { plan[k] = v; changed = true } } }
  return { changed, clamped, effCeil, overBudget }
}
