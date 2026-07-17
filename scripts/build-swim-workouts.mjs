#!/usr/bin/env node
// #swim-tri — generate a DEEP swim workout library (the swim analogue of endurance.json's 494 cycling / 302 running).
// Composed from book-grounded building blocks: Schneider's Swimmer's Workout Handbook structure (warm-up → drills →
// main → cool-down), Total Immersion technique progressions, and CSS threshold sets (Swim Smooth / Sport Scientists).
// Distances in metres (a yard pool reads the same numbers). sTSS is nominal for a ~1:40/100 CSS swimmer and scales
// with the athlete's real CSS at runtime. Deterministic (no Date/Math.random) so the output is stable + diffable.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const __dirname = dirname(fileURLToPath(import.meta.url))

// duration ≈ distance × a per-focus min/100 factor (includes rest); sTSS = durationSec × IF² / 36.
const PACE = { technique: 2.2, endurance: 2.0, threshold: 2.0, speed: 2.3, mixed: 2.1, openwater: 2.0, recovery: 2.4 }
const IF = { technique: 0.80, endurance: 0.85, threshold: 1.0, speed: 1.06, mixed: 0.92, openwater: 0.88, recovery: 0.70 }
const dur = (focus, dist) => Math.round((dist / 100) * PACE[focus])
const tss = (focus, dist) => Math.max(12, Math.round(dur(focus, dist) * 60 * IF[focus] * IF[focus] / 36))
const warm = (d) => ({ part: 'Warm-up', detail: `${d} easy mixed swim / kick / drill, building the last 100` })
const cool = (d) => ({ part: 'Cool-down', detail: `${d} easy, long and relaxed` })
const out = []
const push = (w) => out.push({ ...w, durationMin: dur(w.focus, w.distanceM), tss: tss(w.focus, w.distanceM) })

// ── 1. TECHNIQUE (Total Immersion progressions) ──────────────────────────────
const DRILLS = [
  ['Balance & Streamline', 'balance / skate + kick-on-side — float downhill, head neutral, long vessel'],
  ['Catch-Up Timing', 'catch-up + fingertip-drag — one long stroke, patient front hand'],
  ['High-Elbow Catch', 'sculling + single-arm — anchor the water, pull the body past the hand'],
  ['Body Rotation', '6-3-6 + zipper switch — rotate from the core, swim on your side'],
  ['Stroke Length (SWOLF)', 'single-arm + stroke-count holds — most distance per stroke'],
  ['Kick & Streamline', 'kick-on-side + vertical kick — steady 2-beat kick off the rotation'],
  ['Breathing Rhythm', 'bilateral breathing + 3-5-7 relaxed hypoxic — exhale fully underwater'],
  ['Popov Skate', 'popov skate + spearing — reach and glide, quiet entry'],
]
for (const [name, drill] of DRILLS) {
  for (const [dist, level] of [[1000, 'beginner'], [1200, 'beginner'], [1400, 'intermediate'], [1600, 'intermediate']]) {
    const main = dist - 500, reps = Math.round(main / 100)
    push({ id: `sw-tech-${name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}-${dist}`, name: `${name} — ${dist}`, level, focus: 'technique', distanceM: dist,
      summary: `Technique focus — ${drill.split(' — ')[1] || drill}.`,
      structure: [warm(300), { part: 'Drills', detail: `${Math.min(8, 4 + Math.round(main / 300))}×50 ${drill.split(' — ')[0]} on 15 s rest (snorkel optional)` }, { part: 'Main', detail: `${reps}×100 easy Z1–2, apply the cue, count strokes/length` }, cool(100)] })
  }
}

// ── 2. ENDURANCE / aerobic ───────────────────────────────────────────────────
for (const [dist, level] of [[1600, 'beginner'], [1800, 'intermediate'], [2100, 'intermediate'], [2400, 'intermediate'], [3000, 'advanced'], [3600, 'advanced']]) {
  const m = dist - 600
  push({ id: `sw-end-continuous-${dist}`, name: `Continuous Aerobic ${(dist / 1000).toFixed(1).replace('.0', '')}K`, level, focus: 'endurance', distanceM: dist,
    summary: 'Steady Zone-2 volume — build aerobic durability and open-water base.', structure: [warm(400), { part: 'Main', detail: `${m} continuous @ Z2, smooth and even — negative-split the back half` }, cool(200)] })
  push({ id: `sw-end-pyramid-${dist}`, name: `Aerobic Pyramid ${(dist / 1000).toFixed(1).replace('.0', '')}K`, level, focus: 'endurance', distanceM: dist,
    summary: '100-200-300-400… pyramid — aerobic control across distances.', structure: [warm(300), { part: 'Main', detail: `Pyramid 100·200·300·400·300·200·100 @ Z2 on 20–30 s rest, hold form on the long ones (repeat if short)` }, cool(200)] })
  push({ id: `sw-end-broken-${dist}`, name: `Broken Long ${(dist / 1000).toFixed(1).replace('.0', '')}K`, level, focus: 'endurance', distanceM: dist,
    summary: 'Broken 400s/800s — aerobic volume with just enough rest to hold form.', structure: [warm(400), { part: 'Main', detail: `${Math.round(m / 400)}×400 @ Z2 on 30 s rest — even pace, controlled breathing` }, cool(200)] })
  push({ id: `sw-end-descend-${dist}`, name: `Descending 200s ${(dist / 1000).toFixed(1).replace('.0', '')}K`, level, focus: 'endurance', distanceM: dist,
    summary: 'Descend each 200 from easy to steady — pace awareness.', structure: [warm(400), { part: 'Main', detail: `${Math.round(m / 200)}×200 on 20 s rest, descend 1→4 (easy → Z3), then repeat the ladder` }, cool(200)] })
  push({ id: `sw-end-pull-${dist}`, name: `Pull Endurance ${(dist / 1000).toFixed(1).replace('.0', '')}K`, level, focus: 'endurance', distanceM: dist,
    summary: 'Pull-buoy aerobic set — catch feel and upper-body durability.', structure: [warm(400), { part: 'Main', detail: `${Math.round(m / 300)}×300 pull (buoy, optional paddles) @ Z2 on 20 s rest` }, cool(200)] })
}

// ── 3. THRESHOLD (CSS — the key sessions) ────────────────────────────────────
const CSS_SETS = [
  ['10×100', 2000, 'intermediate', '10×100 @ CSS on 10–15 s rest — even effort, hold pace to the last rep'],
  ['12×100', 2200, 'advanced', '12×100 @ CSS on 10 s rest — classic threshold volume'],
  ['8×150', 2200, 'intermediate', '8×150 @ CSS on 15 s rest — slightly longer reps, same pace'],
  ['6×200', 2200, 'intermediate', '6×200 @ CSS on 20 s rest — threshold endurance'],
  ['8×200', 2600, 'advanced', '8×200 @ CSS on 20 s rest — big threshold block'],
  ['5×200', 2000, 'intermediate', '5×200 @ CSS on 20 s rest — introductory threshold'],
  ['4×300', 2200, 'advanced', '4×300 @ CSS on 30 s rest — sustained threshold'],
  ['Broken 400s', 2400, 'advanced', '3× (400 as 4×100 @ CSS on 10 s), 45 s between sets — threshold durability'],
  ['20×50', 2000, 'intermediate', '20×50 @ CSS pace on 10 s rest — turnover at threshold'],
  ['Ladder 100-200-300', 2200, 'intermediate', '2× (100·200·300 @ CSS, 15 s rest), 45 s between — build within threshold'],
  ['Red-Mist Descend', 2400, 'advanced', '3× (4×100: first 3 @ CSS, last @ CSS+ hard) on 10 s — finish each set fast'],
  ['15×100', 2400, 'advanced', '15×100 @ CSS on 10 s rest — high-volume threshold, hold to the end'],
  ['3×400', 2200, 'intermediate', '3×400 @ CSS on 30 s rest — long threshold reps, even pace'],
  ['6×150', 1900, 'intermediate', '6×150 @ CSS on 15 s rest — introductory threshold volume'],
  ['30×50', 2400, 'advanced', '30×50 @ CSS on 8–10 s rest — relentless threshold turnover'],
  ['Ladder 50-100-150-200', 2200, 'advanced', '2× (50·100·150·200·150·100·50 @ CSS on 10–15 s) — threshold pyramid'],
  ['400+300+200+100', 2000, 'intermediate', 'Descend 400·300·200·100 @ CSS→CSS+, 30 s rest — get faster as it shortens'],
]
for (const [tag, dist, level, main] of CSS_SETS) push({ id: `sw-css-${tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`, name: `CSS ${tag}`, level, focus: 'threshold', distanceM: dist,
  summary: 'Threshold set at your Critical Swim Speed — the pace you can hold ~an hour.', structure: [warm(400), { part: 'Drills', detail: '4×50 build to pace' }, { part: 'Main', detail: main }, cool(200)] })

// ── 4. SPEED / VO₂ ───────────────────────────────────────────────────────────
const SPEED_SETS = [
  ['8×50 Race-Pace', 1600, 'intermediate', '8×50 @ 100-race pace (Z4) on 1:1 work:rest — sharpen speed'],
  ['12×50 Race-Pace', 1800, 'advanced', '12×50 @ Z4 on 1:1 — race-pace repeatability'],
  ['16×50 Descend', 2000, 'advanced', '16×50 as 4× (4 descending easy→sprint) on 15 s rest'],
  ['12×25 Sprint', 1200, 'intermediate', '12×25 max sprint (Z5), full recovery ~30–45 s — quality over fatigue'],
  ['20×25 Sprint', 1400, 'advanced', '20×25 sprint on ~40 s — neuromuscular speed, hold technique'],
  ['6×100 Fast', 1600, 'advanced', '6×100 @ Z4 (faster than CSS) on 30 s rest — VO₂ stimulus'],
  ['10×50 Broken', 1600, 'intermediate', '10×50 @ Z4–5 on 20 s rest — turnover and tempo'],
  ['4×100 Max', 1400, 'advanced', '4×100 near-max (Z5) on full recovery (1:2 work:rest) — top-end lactate'],
  ['16×25 Sprint', 1300, 'intermediate', '16×25 max sprint on ~40 s — pure neuromuscular speed'],
  ['8×75 Fast-Mid-Fast', 1600, 'advanced', '8×75 (fast-easy-fast by 25) on 25 s rest — surge control'],
  ['6×50 Power', 1200, 'advanced', '6×50 max w/ paddles on full recovery — apply the catch under load'],
  ['Sprint Ladder', 1500, 'intermediate', '25·50·75·50·25 sprints ×2, full recovery — build then hold top speed'],
]
for (const [tag, dist, level, main] of SPEED_SETS) push({ id: `sw-speed-${tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`, name: `Speed ${tag}`, level, focus: 'speed', distanceM: dist,
  summary: 'Fast, high-quality set above threshold — speed and economy at pace.', structure: [warm(400), { part: 'Drills', detail: '4×50 build' }, { part: 'Main', detail: main }, cool(200)] })

// ── 5. MIXED / IM / triathlon-specific ───────────────────────────────────────
const MIXED_SETS = [
  ['IM 4×100', 1600, 'intermediate', '4×100 IM (fly-back-breast-free) on 20 s rest — all-stroke fitness'],
  ['IM 8×50', 1600, 'intermediate', '8×50 IM order on 15 s rest — one stroke per 50'],
  ['IM 200 Ladder', 2000, 'advanced', '2× (200 IM + 4×50 weakest stroke) — round out the strokes'],
  ['Pull & Paddle Strength', 2400, 'advanced', '6×200 pull w/ paddles @ Z3 (20 s) + 8×50 fast swim — catch strength + power'],
  ['Tri Race-Pace Sim', 2200, 'intermediate', '1500 continuous @ goal tri pace (Z2–3), sight every ~6 strokes'],
  ['Broken Race Sim', 2400, 'advanced', '3×500 @ goal race pace on 30 s — hold pace as fatigue builds'],
  ['Fartlek Swim', 2000, 'intermediate', '10×200: alternate 100 easy / 100 @ Z3–4 — feel the gears'],
  ['Kick & Swim Mix', 1800, 'intermediate', '8× (100 swim Z2 + 50 kick) on 15 s rest — legs in the aerobic mix'],
  ['Backstroke Focus', 1600, 'intermediate', '8×100 backstroke @ Z2–3 on 20 s + 4×50 back drill — balance the stroke'],
  ['Breaststroke Focus', 1600, 'intermediate', '8×100 breaststroke @ Z2–3 on 20 s + 4×50 pull-out drill — timing and glide'],
  ['Butterfly Intro', 1400, 'advanced', '10×50 fly (or fly-drill) on 30 s + 4×100 free — build the fourth stroke'],
  ['Negative-Split 3×400', 2200, 'advanced', '3×400 on 30 s: second 200 faster than the first — pacing discipline'],
  ['Descending 100s', 1800, 'intermediate', '12×100 in 3 sets of 4, descend each set easy→hard on 15 s rest'],
]
for (const [tag, dist, level, main] of MIXED_SETS) push({ id: `sw-mixed-${tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`, name: tag, level, focus: 'mixed', distanceM: dist,
  summary: 'Mixed-stroke or race-specific work — variety, strength, and race feel.', structure: [warm(400), { part: 'Main', detail: main }, cool(200)] })

// ── 6. OPEN WATER ────────────────────────────────────────────────────────────
const OW_SETS = [
  ['Sighting Skills', 1800, 'intermediate', '6×200 @ Z2–3, sight every 6 strokes; practice lifting eyes without stalling'],
  ['Drafting Practice', 2000, 'advanced', '8×200 @ Z3 on 20 s rest — alternate leading and sitting on the hip/feet'],
  ['Fast-Start & Settle', 2000, 'advanced', '6× (fast first 50 Z4 → settle 150 @ Z2–3) — practice the race start'],
  ['Sustained OW Effort', 2600, 'advanced', '2000 continuous @ Z2–3 open-water effort, sight regularly, no wall rest'],
  ['Chop & Pace Mix', 2200, 'intermediate', '10×200 alternating smooth / broken-tempo — adapt stroke to conditions'],
  ['Wetsuit Swim', 2000, 'intermediate', '1500 continuous @ Z2–3 in wetsuit — feel the buoyancy and adjust the kick'],
  ['Beach-Start Reps', 1600, 'advanced', '6× (dolphin-dive entry + 200 fast-to-steady) — practise the surf/beach start'],
]
for (const [tag, dist, level, main] of OW_SETS) push({ id: `sw-ow-${tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`, name: `Open Water — ${tag}`, level, focus: 'openwater', distanceM: dist,
  summary: 'Open-water race skills — sighting, drafting, pacing, and starts.', structure: [warm(400), { part: 'Main', detail: main }, cool(200)] })

// ── 7. RECOVERY ──────────────────────────────────────────────────────────────
for (const [dist, level] of [[800, 'beginner'], [1000, 'beginner'], [1200, 'intermediate']]) {
  push({ id: `sw-rec-flush-${dist}`, name: `Easy Recovery ${dist}`, level, focus: 'recovery', distanceM: dist,
    summary: 'Flush and loosen — all easy, no clock.', structure: [{ part: 'Main', detail: `${dist} easy Z1, mix swim / kick / drill, breathe every 3 — no watch` }] })
}
push({ id: 'sw-rec-technique', name: 'Recovery Technique Swim', level: 'beginner', focus: 'recovery', distanceM: 1200,
  summary: 'Easy day spent purely on feel and form.', structure: [warm(300), { part: 'Drills', detail: '8×50 favourite drills on 20 s rest, all easy' }, { part: 'Main', detail: '400 easy Z1 applying the cues' }, cool(100)] })

out.sort((a, b) => a.focus.localeCompare(b.focus) || a.distanceM - b.distanceM || a.name.localeCompare(b.name))
const path = join(__dirname, '..', 'src', 'data', 'generated', 'swim-workouts.json')
writeFileSync(path, JSON.stringify(out, null, 0) + '\n')
console.log(`✓ swim-workouts.json — ${out.length} workouts (${[...new Set(out.map((w) => w.focus))].length} focuses)`)
