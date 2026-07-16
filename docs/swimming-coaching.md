# Swimming coaching — the method (Platyplus swim engine)

Peer to `docs/beyond-ftp-metrics.md` (cycling) and the running/Daniels method. Swimming is now a first-class
sport: its own **benchmark** (CSS), **zones**, **workout structure**, **technique focus**, and **dryland strength**.
Distilled from the source books (never copied) + established swim science. The pure math lives in
`src/swimming.ts` (unit-tested); the coach reads `server/coach-engine-swimming.md`.

## Sources
- **Terry Laughlin — *Total Immersion*** (technique: balance → streamline → propulsion; stroke-count efficiency).
- **Terri Schneider — *The Swimmer's Workout Handbook*** (threshold-based interval sets, warm-up/main/cool-down, drills, equipment).
- **Ian McLeod — *Swimming Anatomy*** (stroke muscles + dryland/strength for swimming).
- Field-test science: **Critical Swim Speed** (Wakayoshi 1992; Ginn) — the swim analogue of FTP / threshold pace.

## 1. The benchmark — CSS (Critical Swim Speed)
CSS is swimming's **FTP/threshold-pace equivalent**: the fastest pace an athlete can sustain aerobically, in
**time per 100 m** (or 100 yd). It anchors every zone + workout target, and it's a *learned* benchmark (like FTP)
with a confidence, refined by test-sets and race swims (no lab needed).

**Field test (the standard):** a **400 m** time-trial and a **200 m** time-trial (all-out, well warmed up, same day).
```
CSS speed (m/s) = (400 − 200) / (t400 − t200)          // = 200 m over the time DIFFERENCE
CSS pace /100 m = 100 / CSS speed                        // the number we actually coach to
```
Example: 400 in 6:00 (360 s), 200 in 2:52 (172 s) → CSS = 200/(360−172) = 1.064 m/s → **1:34 /100 m**.
- **Also inferable from activities** (like eFTP): intervals swim activities carry per-100 pace + distance; the best
  sustained ~10–30 min efforts estimate CSS without a formal test. Prefer a real 400/200 when available.
- Store per-athlete: `cssPace100` (seconds/100 m) + the source/confidence, in the local benchmarks (mirrors FTP/threshold-pace).

## 2. Zones (derived from CSS — the swim PACE_ANCHORS)
Percent-of-CSS-**speed** bands, expressed as a pace offset per 100 m (slower than CSS = +seconds). Keep
`src/swimming.ts` zones and any `icu-steps` swim mapping IN SYNC (mirrors run `PACE_ANCHORS`).

| Zone | Name | % CSS speed | Pace vs CSS/100 | Purpose |
|--|--|--|--|--|
| 1 | Easy / recovery | < 80% | CSS + ~10–15 s | warm-up, technique, recovery |
| 2 | Aerobic / endurance | 80–90% | CSS + ~6–10 s | base aerobic volume |
| 3 | Threshold (CSS) | 95–102% | CSS ± ~3 s | the key aerobic-power zone — most fitness |
| 4 | VO₂ / race-pace | 102–110% | CSS − ~2–5 s | 100–400 race speed, hard intervals |
| 5 | Sprint / speed | > 110% | CSS − ~6 s+ | 25–50 power, neuromuscular |

Threshold work (Zone 3, "CSS pace") is the backbone — the Schneider book leans on it heavily. A productive week is
mostly Z1–2 aerobic + drills, with 1–2 **CSS/threshold** sets and a little speed.

## 3. Workout structure (how a swim session is built)
`Warm-up → drills/technique → pre-set (build) → MAIN set → cool-down`, prescribed in **distance (m/yd) on a
send-off interval** (the clock time you leave on), not just duration.
- **Warm-up** 300–600 m easy mixed (swim/kick/pull/drill).
- **Drills** 200–400 m technique (see §4) — every session touches technique.
- **Main set** the day's purpose: e.g. **CSS**: `10×100 @ CSS pace on CSS+5 s rest`; **endurance**: `3×400 Z2`;
  **VO₂**: `8×50 @ Z4 on 1:1 rest`; **speed**: `12×25 sprint, full recovery`.
- **Equipment** as a tool, not a crutch: **pull buoy + paddles** (strength/catch), **kickboard/fins** (kick/ankle),
  **snorkel** (head-still technique). Cite them in the set.
- **Rest intervals** define the stimulus: short rest = aerobic/threshold; long rest = speed/quality.
- **Cool-down** 100–300 m easy.

## 4. Technique focus (Total Immersion) — this is where swimmers actually improve
Unlike run/bike, swim speed is **more technique than fitness** (drag dominates). The coach prioritizes it.
1. **Balance** (the #1 concept, 168 mentions) — a horizontal, "downhill", pressure-the-chest body position so the
   legs don't sink and drag; head neutral/low. Fix balance before anything else.
2. **Streamline / reduce active drag** — long "vessel", tight recovery, swim "taller".
3. **Propulsion last** — hip-driven **body roll** + a high-elbow **catch** (anchor the water, pull the body past
   the hand), a relaxed **two-beat kick** for distance swimming.
4. **Efficiency metric — stroke count / SWOLF** ("swim golf"): SWOLF = seconds + strokes for a length; lower =
   more efficient. Track **strokes-per-length** + **SWOLF** as the technique benchmark (intervals reports both).
5. **Drills** to build it: catch-up, zipper/fingertip-drag, sweet-spot/skate, sculling, single-arm, kick-on-side.

## 5. Dryland / strength for swimming (Swimming Anatomy)
Swimming is a **pulling** sport: **lats + posterior delts + core + rotator-cuff (shoulder health)** drive it.
- Prioritize horizontal + vertical **pulls**, **shoulder-stability / rotator-cuff** (health first — swimmers' shoulders),
  **core anti-rotation** (transmit the body roll), and **scapular** control.
- Feeds the existing **strength engine** (`coach-engine-strength.md`) with a **swim-support focus** (concurrent
  training: it supports, doesn't dominate; scheduled away from key swim quality). Cross-links [[platyplus-gym-engine]].

## 6. Load / readiness
Swim **sTSS** from CSS + pace (like run rTSS from threshold pace): `sTSS ≈ (duration_s × IF²) / 36`, IF = CSS-speed
÷ swim-speed. Feeds the same readiness/Form model as ride/run. `planToIcuEvent` sets `icu_training_load` for planned
swims so Form projects correctly (mirrors #372).

## 7. Coaching adaptation (like the other engines)
- **Beginner** → technique-heavy (balance/drills), short aerobic sets, build CSS slowly.
- **Fitness/endurance** → aerobic volume + threshold; a couple of CSS sets/week.
- **Racing (open-water / pool / triathlon leg)** → race-pace + speed blocks, pacing, sighting/wetsuit (open water).
- **Triathlete** → swim is the *support* leg: efficiency + aerobic durability over pure speed, kept fresh for bike/run
  (see `docs/triathlon-coaching.md`). Frequency > single-session length.
