// #626 — multi-week PERIODIZATION. weekShape decides ONE week's shape; this decides where that week sits in the
// MESO-CYCLE so the coach PROGRESSES load week-over-week (build → build → peak → recovery) instead of prescribing a
// flat, same-every-week plan — and TAPERS into an A-race when one is set. Pure + unit-tested (src/periodization.test.ts).
//
// Same principle as weekShape/archetypes: decide the structure in code, hand the coach the target + the directive.

import { weeklyLoadBudget } from './readiness.js'

// #8 (audit) — the code taper + season macro fire ONLY from a structured info.raceDate, but the coach prompt invites the
// athlete to type their A-race date in FREE-TEXT goal notes ("Ironman Nice on 2026-09-13", "race is September 13 2026").
// So a triathlete who does exactly what the prompt says gets weeksToRace=null and NO taper into race day. Parse the
// earliest FUTURE date out of the notes as a fallback. Requires an explicit YEAR (avoids ambiguous MM/DD guesses). Pure.
const RD_MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
const RD_MON = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?'
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
export function parseRaceDate(text, todayIso) {
  if (!text || typeof text !== 'string') return null
  const t = text.toLowerCase()
  const cands = []
  for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) cands.push(`${m[1]}-${m[2]}-${m[3]}`)
  for (const m of t.matchAll(new RegExp(`\\b${RD_MON}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})\\b`, 'g'))) { const mm = RD_MONTHS[m[1].slice(0, 3)]; const d = +m[2]; if (mm && d >= 1 && d <= 31) cands.push(iso(+m[3], mm, d)) }
  for (const m of t.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${RD_MON},?\\s*(\\d{4})\\b`, 'g'))) { const mm = RD_MONTHS[m[2].slice(0, 3)]; const d = +m[1]; if (mm && d >= 1 && d <= 31) cands.push(iso(+m[3], mm, d)) }
  const future = cands.filter((d) => /^\d{4}-\d{2}-(\d{2})$/.test(d) && +d.slice(5, 7) >= 1 && +d.slice(5, 7) <= 12 && (!todayIso || d >= todayIso) && !isNaN(Date.parse(d + 'T00:00:00Z'))).sort()
  return future[0] || null
}

// The rolling 4-week block: two build weeks that ramp, a peak/overload week, then a real recovery week to absorb it.
// Targets scale from the athlete's own CTL (via weeklyLoadBudget) — a beginner and a pro both get THEIR right numbers.
// `easeTop` (masters / teen) softens the peak week + deepens the recovery — both ends of the age range recover slower
// or must stay submaximal, so the overload is gentler and the down week bigger.
function blockCycle(b, easeTop = false) {
  const peak = easeTop ? (b ? b.build : null) : (b ? b.hard : null) // masters/teen: don't stack a true overload week
  const recMult = easeTop ? 0.6 : 0.7                               // ...and take a deeper recovery week
  // #629 — the two build weeks must ACTUALLY RAMP (not the same target twice — that was the flat-progression bug the
  // audit caught). Week 1 sits at the build floor; week 2 climbs toward the peak; then the peak; then recovery.
  const build1 = b ? b.build : null
  const build2 = b ? Math.round((b.build + (easeTop ? b.build : b.hard)) / 2) : null // midway build→peak (or flat if eased)
  return [
    { phase: 'build',    target: build1,                                   note: 'Build week 1 of the block — PROGRESS vs last week: add a little (a rep, a few minutes, or a touch more time at target) to the key session. Not a flat repeat.' },
    { phase: 'build',    target: build2,                                   note: `Build week 2 — RAMP UP from week 1${build1 && build2 ? ` (~${build1}→${build2} TSS)` : ''}: this is the biggest ordinary week before the recovery week, so add a bit more than last week.` },
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
export function periodizationPhase({ ctl = null, weeksSinceAnchor = 0, weeksToRace = null, ageYears = null, form = null, loadBand = null, taperWeeks = 2 } = {}) {
  const b = weeklyLoadBudget(ctl)
  // #752 (audit) — the taper is DISTANCE-AWARE: a longer race needs a longer taper. `taperWeeks` (default 2) is widened
  // by the caller for a 70.3 (~3) / Ironman (~3-4), so an IM athlete 3 weeks out gets a taper, not a peak week.
  if (weeksToRace != null && weeksToRace >= 0 && weeksToRace <= taperWeeks) return taperWeek(Math.min(weeksToRace, 2), b)
  // #630 — AUTOREGULATION: the calendar wheel is not the boss of fatigue. If Form (CTL−ATL) is deep-negative the
  // athlete is dug into a hole; force an UNPLANNED recovery week regardless of where the fixed cycle says we are,
  // so the periodization responds to how they're actually absorbing load (this is what a world-class coach does).
  if (form != null && form <= -30) return {
    phase: 'recovery', weekInCycle: null, target: b ? Math.round(b.sustainable * 0.6) : null, weeksToRace,
    note: `UNPLANNED RECOVERY week — their freshness is deep-negative (Form ${Math.round(form)}), so they're dug into a fatigue hole: pull volume right back and keep it easy this week to climb out, whatever the calendar block said. Resume the build once Form recovers.`,
  }
  // #756 (audit) — a FLAT / MAINTENANCE goal (health · consistency · pregnancy) NEVER runs a peak/overload week: that
  // contradicts the load-budget band and hands a "hardest week of the block" to someone who just wants to stay fit.
  if (loadBand === 'flat' || loadBand === 'maintenance') return {
    phase: 'steady', weekInCycle: null, target: b ? b.sustainable : null, weeksToRace,
    note: 'STEADY consistency block — a health/maintenance goal, so NO peak or overload week: hold a repeatable weekly load and ease off if fatigued. Progress comes from consistency, not a hard peak.',
  }
  const easeTop = ageYears != null && (ageYears >= 55 || ageYears < 18) // masters or teen → gentler peak + deeper recovery
  const cycle = blockCycle(b, easeTop)
  const i = (((Math.floor(weeksSinceAnchor) % 4) + 4) % 4)
  const c = cycle[i]
  return { phase: c.phase, weekInCycle: i + 1, target: c.target, note: c.note, weeksToRace }
}

export const BLOCK_PHASES = ['build', 'build', 'peak', 'recovery']
