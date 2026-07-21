// #626 — multi-week PERIODIZATION. weekShape decides ONE week's shape; this decides where that week sits in the
// MESO-CYCLE so the coach PROGRESSES load week-over-week (build → build → peak → recovery) instead of prescribing a
// flat, same-every-week plan — and TAPERS into an A-race when one is set. Pure + unit-tested (src/periodization.test.ts).
//
// Same principle as weekShape/archetypes: decide the structure in code, hand the coach the target + the directive.

import { weeklyLoadBudget } from './readiness.js'

// The rolling 4-week block: two build weeks that ramp, a peak/overload week, then a real recovery week to absorb it.
// Targets scale from the athlete's own CTL (via weeklyLoadBudget) — a beginner and a pro both get THEIR right numbers.
// `easeTop` (masters / teen) softens the peak week + deepens the recovery — both ends of the age range recover slower
// or must stay submaximal, so the overload is gentler and the down week bigger.
function blockCycle(b, easeTop = false) {
  const peak = easeTop ? (b ? b.build : null) : (b ? b.hard : null) // masters/teen: don't stack a true overload week
  const recMult = easeTop ? 0.6 : 0.7                               // ...and take a deeper recovery week
  return [
    { phase: 'build',    target: b ? b.build : null,                       note: 'Build week 1 of the block — PROGRESS vs last week: add a little (a rep, a few minutes, or a touch more time at target) to the key session. Not a flat repeat.' },
    { phase: 'build',    target: b ? b.build : null,                       note: 'Build week 2 — push the ramp a little further; this is the biggest ordinary week before the recovery week.' },
    { phase: 'peak',     target: peak,                                     note: `Peak / overload week — the hardest week of the block${easeTop ? ', kept SUBMAXIMAL here (younger / masters athlete — no true overload; ease the very top end)' : ' (a productive peak dips Form into the green, about −10 to −20)'}. Then next week recovers.` },
    { phase: 'recovery', target: b ? Math.round(b.sustainable * recMult) : null, note: `RECOVERY week — pull volume back about ${Math.round((1 - recMult) * 100)}%, keep intensity light and short. Do NOT progress load; let the block’s fitness consolidate. This is where the adaptation banks.` },
  ]
}

// Taper into an A-race: the final ~2 weeks cut volume hard while keeping intensity crisp, so they arrive fresh.
function taperWeek(weeksToRace, b) {
  const T = [
    { note: 'RACE WEEK — be sharp + fresh: cut volume about 55%, keep a few short race-pace efforts to stay crisp, prioritise freshness + sleep over load.', mult: 0.45 },
    { note: 'Taper, 1 week out — cut volume about 40%, keep the intensity but make it short; no new fitness to be gained now, only freshness to protect.', mult: 0.60 },
    { note: 'Taper start, 2 weeks out — begin easing total volume while holding the key intensity; the hard training is done.', mult: 0.80 },
  ]
  const t = T[Math.min(2, Math.max(0, weeksToRace))]
  return { phase: 'taper', weekInCycle: null, weeksToRace, target: b ? Math.round(b.sustainable * t.mult) : null, note: t.note }
}

/**
 * Where does THIS week sit in the periodized plan?
 * @param {object} p
 *   ctl               number|null   athlete fitness (scales the TSS targets)
 *   weeksSinceAnchor  number        whole weeks since the athlete's block anchor (personalises the build/recovery cadence)
 *   weeksToRace       number|null   whole weeks until their A-race (null = no race set); ≤2 ⇒ taper overrides the cycle
 *   ageYears          number|null   masters (≥55) or teen (<18) ⇒ gentler peak + deeper recovery
 * @returns {{ phase, weekInCycle, target, note, weeksToRace }}
 */
export function periodizationPhase({ ctl = null, weeksSinceAnchor = 0, weeksToRace = null, ageYears = null } = {}) {
  const b = weeklyLoadBudget(ctl)
  if (weeksToRace != null && weeksToRace >= 0 && weeksToRace <= 2) return taperWeek(weeksToRace, b)
  const easeTop = ageYears != null && (ageYears >= 55 || ageYears < 18) // masters or teen → gentler peak + deeper recovery
  const cycle = blockCycle(b, easeTop)
  const i = (((Math.floor(weeksSinceAnchor) % 4) + 4) % 4)
  const c = cycle[i]
  return { phase: c.phase, weekInCycle: i + 1, target: c.target, note: c.note, weeksToRace }
}

export const BLOCK_PHASES = ['build', 'build', 'peak', 'recovery']
