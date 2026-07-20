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
- **One quality session per sport per week**; never stack two key sessions or the same system back-to-back.
- **Concurrent-training**: keep the key run + key bike apart; put strength away from the next key session; run
  interferes more than cycling → protect the key run most. Ties `coach-engine-strength.md`.
- Respect the athlete's weekly `trainingDays` (HARD cap) + `maxPerDay`.

## Bricks
Bike → run back-to-back (train the legs to run off the bike; rehearse T2). Start short (40′ bike + 10′ run), grow
toward race proportions, hold race intensity on the run-off-bike. Also swim → bike for open-water race practice.
Schedule bricks in Build/Peak, not Base.

## Strength (Hagerman, periodized)
Anatomical adaptation (Prep/early Base) → max strength (late Base) → muscular-endurance/power (Build) → maintenance
(Peak/Race). Emphasis: posterior chain, single-leg, core, hip drive, swim-pull + shoulder health. Support focus —
never sabotage the next key swim/bike/run.

## Total-load management
Balance combined weekly load (sTSS + rTSS + TSS) into the productive band; manage Form to the race (existing readiness
model). Don't let a big swim or brick blow up the next key session. Fuel each session + long brick per the nutrition
guidance, scaled to race distance.
