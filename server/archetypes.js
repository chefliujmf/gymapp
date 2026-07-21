// #620 (JM 2026-07-20) — CODE-DRIVEN VARIETY. Giving the LLM a rotation list + a look-back tool wasn't enough: it
// still defaults to threshold/sweet-spot for every quality day and cosmetic "Easy Aerobic X" for easy days. So we
// ASSIGN each quality/hard day a SPECIFIC archetype deterministically — rotating the full range, skipping what was
// used recently, and respecting the week-shape intensity ceiling — and hand the coach exactly what to build. Easy
// days get rotating CUES so they genuinely differ (cadence / torque / terrain), not renames. Pure + unit-tested.
//
// Same principle as weekShape/enforceShapeIntensity: don't hope the LLM does it — decide it in code, tell it what.

import { CEILINGS } from './week-shape.js'
const cidx = (k) => { const i = CEILINGS.indexOf(k); return i < 0 ? CEILINGS.length : i } // unknown ceil → treat as highest

// Per-sport QUALITY archetypes, ordered; `ceil` = the lowest intensity ceiling an athlete needs for it to be allowed.
const QUALITY = {
  ride: [
    { key: 'tempo',     label: 'Tempo',        ceil: 'tempo',     spec: '2-3 × 15-20 min @ tempo (Z3, ~80-85% FTP), short spins between' },
    { key: 'sweetspot', label: 'Sweet-Spot',   ceil: 'sweetspot', spec: '3 × 12-15 min @ 88-93% FTP, 5 min easy between' },
    { key: 'overunder', label: 'Over-Unders',  ceil: 'threshold', spec: '3-4 × (2 min @ 95% / 1 min @ 105%) ×3, 5 min easy between sets' },
    { key: 'threshold', label: 'Threshold',    ceil: 'threshold', spec: '3×15 or 4×10 min @ 98-102% FTP, 5 min easy between' },
    { key: 'hills',     label: 'Hill Reps',    ceil: 'threshold', spec: '6-8 × 2-3 min hard uphill (~threshold+), spin-down recovery' },
    { key: 'vo2',       label: 'VO2max',       ceil: 'vo2',       spec: '5-6 × 3 min @ 110-120% FTP, equal easy recovery' },
  ],
  run: [
    { key: 'strides',   label: 'Strides',      ceil: 'tempo',     spec: '6-8 × 20 s relaxed-fast strides at the end of an easy run, full recovery' },
    { key: 'tempo',     label: 'Tempo',        ceil: 'tempo',     spec: 'continuous 20-30 min @ tempo, OR cruise 3 × 10 min (T pace), 90 s jog' },
    { key: 'mpace',     label: 'Marathon-Pace',ceil: 'sweetspot', spec: '4-8 km @ M pace inside an otherwise easy run' },
    { key: 'threshold', label: 'Threshold',    ceil: 'threshold', spec: 'cruise intervals 4-5 × 6-8 min @ T pace, 60-90 s jog' },
    { key: 'hills',     label: 'Hill Reps',    ceil: 'threshold', spec: '8-10 × 45-90 s uphill hard, jog-down recovery' },
    { key: 'fartlek',   label: 'Fartlek',      ceil: 'threshold', spec: 'unstructured surges by feel (30 s-3 min) over a rolling route' },
    { key: 'vo2',       label: 'VO2 Intervals',ceil: 'vo2',       spec: '5-6 × 3 min @ 5k pace (I), equal-time jog recovery' },
  ],
  swim: [
    { key: 'technique', label: 'Technique',    ceil: 'tempo',     spec: 'drill-heavy set: 8-10 × 50 drill/swim, focus one stroke fault' },
    { key: 'css',       label: 'CSS Intervals',ceil: 'threshold', spec: '6-8 × 100 @ CSS pace, 15-20 s rest' },
    { key: 'pyramid',   label: 'Pyramid',      ceil: 'sweetspot', spec: '100-200-300-200-100 building to CSS, short rest' },
    { key: 'sprint',    label: 'Speed',        ceil: 'vo2',       spec: '10-12 × 25 fast, full recovery, hold form' },
    { key: 'endurance', label: 'Threshold Swim',ceil: 'threshold',spec: '3-4 × 300-400 steady @ ~CSS+3-5 s, 20 s rest' },
  ],
}

// Rotating EASY-day cues so easy sessions genuinely differ (not just renamed). ceil is irrelevant — all easy.
const EASY = {
  ride: ['steady Z2 endurance', 'high-cadence spin (95-105 rpm)', 'low-cadence torque (55-65 rpm)', 'rolling-terrain endurance ride', 'easy spin with 4-5 cadence-pyramid surges', 'pure recovery spin (very light)'],
  run: ['easy conversational run', 'easy trail/soft-surface run', 'easy run with 4-6 relaxed strides', 'easy run holding smooth quick cadence (~180)', 'easy hilly/rolling run by feel', 'very easy recovery jog'],
  swim: ['easy aerobic swim with drills', 'easy pull-buoy set', 'easy mixed-stroke recovery swim', 'easy swim with kick focus'],
}

/**
 * Assign the week's QUALITY-day archetypes deterministically.
 * @returns array of {key,label,spec} of length `count`, all ≤ ceiling, favouring ones NOT in recentKeys.
 */
export function assignQuality({ sport = 'ride', count = 0, ceiling = 'vo2', recentKeys = [], weekIndex = 0 } = {}) {
  if (!(count > 0)) return []
  const pool = (QUALITY[sport] || QUALITY.ride).filter((a) => cidx(a.ceil) <= cidx(ceiling))
  if (!pool.length) return []
  const recent = new Set(recentKeys)
  const fresh = pool.filter((a) => !recent.has(a.key))
  const ordered = fresh.length ? [...fresh, ...pool.filter((a) => recent.has(a.key))] : pool
  const out = []
  for (let i = 0; i < count; i++) out.push(ordered[(i + weekIndex) % ordered.length])
  return out
}

/** Assign rotating EASY-day cues (so easy days differ), skipping recent, length `count`. */
export function assignEasy({ sport = 'ride', count = 0, recentCues = [], weekIndex = 0 } = {}) {
  if (!(count > 0)) return []
  const pool = EASY[sport] || EASY.ride
  const recent = new Set(recentCues)
  const fresh = pool.filter((c) => !recent.has(c))
  const ordered = fresh.length ? [...fresh, ...pool.filter((c) => recent.has(c))] : pool
  const out = []
  for (let i = 0; i < count; i++) out.push(ordered[(i + weekIndex) % ordered.length])
  return out
}

export const ARCHETYPE_KEYS = Object.fromEntries(Object.entries(QUALITY).map(([s, list]) => [s, list.map((a) => a.key)]))

// map a plan TITLE back to an archetype key (the look-back fingerprint) — so we can skip what was used recently.
export function keyFromTitle(title = '') {
  const t = String(title).toLowerCase()
  if (/over.?under/.test(t)) return 'overunder'
  if (/sweet.?spot/.test(t)) return 'sweetspot'
  if (/threshold/.test(t)) return 'threshold'
  if (/vo.?2|vo2max/.test(t)) return 'vo2'
  if (/hill/.test(t)) return 'hills'
  if (/fartlek/.test(t)) return 'fartlek'
  if (/marathon|m.?pace/.test(t)) return 'mpace'
  if (/stride/.test(t)) return 'strides'
  if (/tempo/.test(t)) return 'tempo'
  if (/css|critical swim/.test(t)) return 'css'
  if (/pyramid/.test(t)) return 'pyramid'
  if (/technique|drill/.test(t)) return 'technique'
  if (/sprint|speed/.test(t)) return 'sprint'
  return null // easy/long/rest — not a quality archetype
}

// Assign the QUALITY archetypes for the coming block (default 2 weeks), rotating so consecutive weeks + recent
// history don't repeat. Returns [{ weekIndex, quality:[{key,label,spec}], easy:[cue,…] }] the prompt renders.
export function assignArchetypeBlock({ sport = 'ride', qualityDays = 0, easyDays = 0, ceiling = 'vo2', recentKeys = [], weeks = 2 } = {}) {
  const out = []
  const used = [...recentKeys]
  const usedCues = []
  for (let w = 0; w < weeks; w++) {
    // quality: rely on the carried-forward `used` for cross-week rotation (NOT weekIndex — in a small pool the
    // weekIndex offset fought the freshness skip and re-picked last week's archetype, e.g. Strides two weeks running).
    const quality = assignQuality({ sport, count: qualityDays, ceiling, recentKeys: used, weekIndex: 0 })
    quality.forEach((a) => used.push(a.key)) // carry forward so next week avoids these too
    const easy = assignEasy({ sport, count: easyDays, recentCues: usedCues, weekIndex: 0 })
    easy.forEach((c) => usedCues.push(c)) // same for easy cues — genuinely different week to week
    out.push({ weekIndex: w, quality, easy })
  }
  return out
}
