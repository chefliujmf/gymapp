// Curated swim workout library — the swim analogue of the endurance (ride/run) catalog. Distance-based sets on a
// send-off, prescribed relative to CSS (see docs/swimming-coaching.md). Grounded in Schneider's Swimmer's Workout
// Handbook structure (warm-up → drills → main → cool-down) + Total Immersion technique. Distances in metres; a yard
// pool just reads the same numbers as yards. `tss` is a nominal sTSS for a ~1:40/100 CSS swimmer (scales with CSS).

export type SwimLevel = 'beginner' | 'intermediate' | 'advanced'
export type SwimFocus = 'technique' | 'endurance' | 'threshold' | 'speed' | 'mixed' | 'recovery' | 'openwater'

export interface SwimWorkout {
  id: string
  name: string
  level: SwimLevel
  focus: SwimFocus
  distanceM: number
  durationMin: number
  tss: number
  summary: string // one-liner
  structure: { part: string; detail: string }[] // warm-up / drills / main / cool-down
}

export const swimWorkouts: SwimWorkout[] = [
  // ── Technique / beginner ──
  { id: 'sw-balance-1', name: 'Balance & Streamline Basics', level: 'beginner', focus: 'technique', distanceM: 1200, durationMin: 35, tss: 25,
    summary: 'Fix body position first — float downhill, head neutral, long vessel.',
    structure: [{ part: 'Warm-up', detail: '300 easy mixed swim/kick' }, { part: 'Drills', detail: '6×50 balance/skate + kick-on-side (15 s rest), snorkel optional' }, { part: 'Main', detail: '6×100 easy focusing on one long stroke, count strokes/length' }, { part: 'Cool-down', detail: '100 easy' }] },
  { id: 'sw-catchup', name: 'Catch-Up & High-Elbow Catch', level: 'beginner', focus: 'technique', distanceM: 1400, durationMin: 40, tss: 30,
    summary: 'Build the catch — anchor the water, pull the body past the hand.',
    structure: [{ part: 'Warm-up', detail: '300 easy' }, { part: 'Drills', detail: '8×50 catch-up + fingertip-drag (alternate), 15 s rest' }, { part: 'Main', detail: '4×150 Z2 smooth, 20 s rest — apply the catch' }, { part: 'Cool-down', detail: '100 easy' }] },
  { id: 'sw-swolf', name: 'Stroke-Count / SWOLF Ladder', level: 'intermediate', focus: 'technique', distanceM: 1600, durationMin: 42, tss: 34,
    summary: 'Swim golf — lower your SWOLF, more distance per stroke.',
    structure: [{ part: 'Warm-up', detail: '400 mixed' }, { part: 'Drills', detail: '6×50 single-arm + sculling' }, { part: 'Main', detail: '8×100 Z2, hold the lowest stroke count you can (note SWOLF)' }, { part: 'Cool-down', detail: '100 easy' }] },

  // ── Endurance / aerobic ──
  { id: 'sw-aerobic-2k', name: 'Aerobic Base 2K', level: 'intermediate', focus: 'endurance', distanceM: 2000, durationMin: 45, tss: 45,
    summary: 'Steady Zone 2 volume, build durability.',
    structure: [{ part: 'Warm-up', detail: '400 easy + 4×50 build' }, { part: 'Main', detail: '3×400 @ Z2, 30 s rest' }, { part: 'Cool-down', detail: '200 easy' }] },
  { id: 'sw-pyramid', name: 'Endurance Pyramid', level: 'intermediate', focus: 'endurance', distanceM: 2200, durationMin: 50, tss: 52,
    summary: '100-200-300-400-300-200-100 aerobic pyramid.',
    structure: [{ part: 'Warm-up', detail: '300 easy' }, { part: 'Main', detail: '100·200·300·400·300·200·100 @ Z2 (20–30 s rest), negative-split the long ones' }, { part: 'Cool-down', detail: '200 easy' }] },
  { id: 'sw-long-aerobic', name: 'Long Aerobic Swim', level: 'advanced', focus: 'endurance', distanceM: 3000, durationMin: 65, tss: 70,
    summary: 'Big aerobic block for durability / open-water base.',
    structure: [{ part: 'Warm-up', detail: '400 mixed' }, { part: 'Main', detail: '2×800 @ Z2 (45 s rest) + 4×150 pull @ Z2' }, { part: 'Cool-down', detail: '200 easy' }] },

  // ── Threshold (CSS) — the key sessions ──
  { id: 'sw-css-10x100', name: 'CSS 10×100', level: 'intermediate', focus: 'threshold', distanceM: 2000, durationMin: 45, tss: 60,
    summary: 'The classic threshold set — 10×100 at CSS pace on short rest.',
    structure: [{ part: 'Warm-up', detail: '400 easy + 4×50 build' }, { part: 'Drills', detail: '4×50 technique' }, { part: 'Main', detail: '10×100 @ CSS pace on 10–15 s rest — hold pace, even effort' }, { part: 'Cool-down', detail: '200 easy' }] },
  { id: 'sw-css-broken', name: 'CSS Broken 400s', level: 'advanced', focus: 'threshold', distanceM: 2400, durationMin: 55, tss: 72,
    summary: 'Broken 400s at CSS — threshold durability.',
    structure: [{ part: 'Warm-up', detail: '400 + 4×50 build' }, { part: 'Main', detail: '3× (400 as 4×100 @ CSS on 10 s rest), 45 s between sets' }, { part: 'Cool-down', detail: '200 easy' }] },
  { id: 'sw-css-200s', name: 'CSS 8×200', level: 'advanced', focus: 'threshold', distanceM: 2600, durationMin: 58, tss: 78,
    summary: 'Longer threshold reps — 8×200 at CSS.',
    structure: [{ part: 'Warm-up', detail: '400 + 200 pull' }, { part: 'Main', detail: '8×200 @ CSS pace on 20 s rest' }, { part: 'Cool-down', detail: '200 easy' }] },

  // ── VO₂ / speed ──
  { id: 'sw-vo2-8x50', name: 'VO₂ 8×50 Fast', level: 'intermediate', focus: 'speed', distanceM: 1600, durationMin: 40, tss: 48,
    summary: 'Race-pace 50s — sharpen speed at 1:1 rest.',
    structure: [{ part: 'Warm-up', detail: '400 easy + 4×50 build' }, { part: 'Main', detail: '8×50 @ Z4 (100 race pace) on 1:1 work:rest' }, { part: 'Cool-down', detail: '200 easy' }] },
  { id: 'sw-sprint-25s', name: 'Sprint 12×25', level: 'intermediate', focus: 'speed', distanceM: 1200, durationMin: 35, tss: 38,
    summary: 'Neuromuscular speed — full-recovery 25s.',
    structure: [{ part: 'Warm-up', detail: '400 mixed' }, { part: 'Main', detail: '12×25 sprint (Z5), full recovery (~30–45 s) — quality over fatigue' }, { part: 'Cool-down', detail: '200 easy' }] },

  // ── Mixed / triathlon-specific ──
  { id: 'sw-tri-pace', name: 'Tri Race-Pace Simulator', level: 'intermediate', focus: 'mixed', distanceM: 2200, durationMin: 48, tss: 58,
    summary: 'Steady open-water-style effort at goal race pace.',
    structure: [{ part: 'Warm-up', detail: '400 + 4×50 build' }, { part: 'Main', detail: '1500 continuous @ Z2–Z3 (goal tri pace), sight every ~6 strokes' }, { part: 'Cool-down', detail: '200 easy' }] },
  { id: 'sw-openwater', name: 'Open-Water Skills', level: 'intermediate', focus: 'openwater', distanceM: 1800, durationMin: 45, tss: 46,
    summary: 'Sighting, drafting, pacing — race practice.',
    structure: [{ part: 'Warm-up', detail: '400 easy' }, { part: 'Main', detail: '6×200 @ Z2–3, sight every 6 strokes; practice a fast first 50 then settle' }, { part: 'Cool-down', detail: '200 easy' }] },
  { id: 'sw-pull-strength', name: 'Pull & Paddle Strength', level: 'advanced', focus: 'mixed', distanceM: 2400, durationMin: 52, tss: 64,
    summary: 'Pull buoy + paddles — catch strength + power.',
    structure: [{ part: 'Warm-up', detail: '400 mixed' }, { part: 'Main', detail: '6×200 pull w/ paddles @ Z3 (20 s rest) + 8×50 fast swim' }, { part: 'Cool-down', detail: '200 easy' }] },

  // ── Recovery ──
  { id: 'sw-recovery', name: 'Easy Recovery Swim', level: 'beginner', focus: 'recovery', distanceM: 1000, durationMin: 25, tss: 18,
    summary: 'Flush the legs, all easy technique.',
    structure: [{ part: 'Main', detail: '1000 easy Z1, mix swim/kick/drill, no clock' }] },
]

export const swimFocusLabel: Record<SwimFocus, string> = { technique: 'Technique', endurance: 'Endurance', threshold: 'Threshold (CSS)', speed: 'Speed', mixed: 'Mixed', recovery: 'Recovery', openwater: 'Open water' }
