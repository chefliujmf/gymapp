# Triathlon engine (coach) — multi-sport PLANNING

HAND-MAINTAINED. Loaded when the athlete's goal/sports are triathlon. This is a PLANNING layer on top of the swim
(CSS), bike (FTP), and run (threshold pace) engines — it does not add a new benchmark. Full method + sources:
`docs/triathlon-coaching.md`. Build the week with `create_swim` / `create_ride` / `create_run` / `create_workout`,
each to ITS own zones, balanced to total weekly load and periodized to the A-race.

## Periodize to the A-race (Friel)
`Prep → Base 1–3 → Build 1–2 → Peak → Race/Taper → Transition`. Work backward from the race date:
- **Base** = the big block: aerobic **durability** in all 3 sports, technique (esp. swim), general → max **strength**.
  Volume up, intensity low-moderate.
- **Build** = **race-specific** intensity (threshold/CSS/VO₂ at race pace), longer **bricks**, muscular-endurance strength.
- **Peak** (~2 wk) sharpen; **Taper** cut volume ~40–60% (length scales with distance: sprint ~ days, IM ~2–3 wk),
  keep short race-pace touches, arrive fresh. **Transition** = real recovery after the race.
- Scale phase lengths + emphasis by **race distance**: sprint/Olympic → threshold + frequency; 70.3/IM → durability,
  fueling, long bricks.

## Weekly balance
- Touch **all three sports most weeks** — frequency preserves each adaptation (swim technique fades fastest).
- **Prioritize the LIMITER** (weakest/most-costly discipline) with more frequency/quality; maintain the strengths.
- **~2 quality sessions TOTAL per week across all three sports** — the server enforces this GLOBALLY (a hard swim +
  hard ride + hard run count TOGETHER toward the ~2). NOT one-per-sport. Spend those two on the athlete's **LIMITER**;
  keep everything else aerobic. Never stack two key sessions or the same system back-to-back.
- **Concurrent-training**: keep the key run + key bike apart; put strength away from the next key session; run
  interferes more than cycling → protect the key run most. Ties `coach-engine-strength.md`.
- Respect the athlete's weekly `trainingDays` (HARD cap) + `maxPerDay`.

## Bricks
A brick is bike → run trained back-to-back to teach the legs to run off the bike (rehearse T2). **Author it as ONE
session** (a single bike+run workout), NOT two stacked same-day sessions — respect `maxPerDay` (a same-day double only
if their maxPerDay allows it). Start short (40′ bike + 10′ run), grow toward race proportions. A **race-intensity
run-off-bike is a QUALITY session** and SPENDS the week's global quality budget — one brick can be most of the week's
intensity, so plan around it. Also swim → bike for open-water practice. Schedule bricks in Build/Peak, not Base.

## Transitions (T1/T2)
Practiced as their own skill, not left to race day. **T1 swim→bike**: efficient exit, wetsuit strip, helmet-then-mount,
running mount. **T2 bike→run**: rack, shoes, quick leg turnover off the bike (over-gear the last minutes to prime the
run cadence). Rehearse in bricks + a few dedicated drills near the race.

## Race pacing by distance
Bike-to-run discipline is the whole game: **don't overbike** — a too-hard bike wrecks the run. **Negative-split the
run** (start controlled, build). Effort distribution scales with distance: **sprint/Olympic** = high, near-threshold
throughout; **70.3** = tempo/sweet-spot bike, steady strong run; **IM** = disciplined aerobic bike (well below
threshold), even aerobic run, patience wins.

## Open-water
Rehearse **sighting** (head up every few strokes, straight line), **drafting** (feet/hip of a swimmer to save energy),
**mass-start** positioning + contact, and swimming in the **wetsuit** (buoyancy changes stroke + body position).

## Race-day fueling (70.3/IM)
Carb intake/hr + hydration/electrolytes is a **limiter** at long distance — **gut-train it** in long bricks so race
pace matches a fueling the gut tolerates. Under-fueling the bike breaks the run.

## Baseline volume (self-check, sessions/week per sport)
Sanity-check frequency by distance: **sprint/Olympic** ≈ swim 2–3 · bike 2–3 · run 2–3; **70.3** ≈ swim 3 · bike 3 ·
run 3; **IM** ≈ swim 3–4 · bike 3–4 · run 3–4 (plus the long ride/run). Cap by the athlete's `trainingDays`/`maxPerDay`.

## Strength (Hagerman, periodized)
Anatomical adaptation (Prep/early Base) → max strength (late Base) → muscular-endurance/power (Build) → maintenance
(Peak/Race). Emphasis: posterior chain, single-leg, core, hip drive, swim-pull + shoulder health. Support focus —
never sabotage the next key swim/bike/run.

## Total-load management
Balance combined weekly load (sTSS + rTSS + TSS) into the productive band; manage Form to the race (existing readiness
model). Don't let a big swim or brick blow up the next key session. Fuel each session + long brick per the nutrition
guidance, scaled to race distance.
