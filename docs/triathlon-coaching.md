# Triathlon coaching — the method (Platyplus multi-sport planning)

Triathlon is **not a new benchmark engine** — it's a **multi-sport PLANNING layer** the coach uses to periodize
swim + bike + run (+ strength) toward a race. It reuses the existing cycling (FTP), running (threshold pace/VDOT),
and swimming (CSS) engines, and adds the periodization, weekly balance, brick sessions, and race-specific prep.
Distilled from the source books (never copied). Lives in the coach's `# TRIATHLON` planning knowledge; the athlete
flags a **triathlon goal** to turn it on.

## Sources
- **Joe Friel — *The Triathlete's Training Bible*** (the canonical method: annual plan + periodization + testing).
- **Marni Sumbal — *Athlete to Triathlete*** (12-week sprint & Olympic plans for newer triathletes).
- **Patrick Hagerman — *Strength Training for Triathletes*** (tri-specific strength: power, speed, muscular endurance).

## 1. Periodization (Friel's annual plan)
Build backward from the **A-race** in phases, each with a training focus:
```
Prep → Base 1 → Base 2 → Base 3 → Build 1 → Build 2 → Peak → Race → Transition (recovery)
```
- **Prep** — easy, re-establish consistency + technique after the off-season.
- **Base (1–3)** — the biggest block: aerobic **durability** in all 3 sports, technique (esp. swim), general
  strength (Hagerman: anatomical adaptation → max strength), gradually longer. Volume up, intensity low-moderate.
- **Build (1–2)** — **race-specific** intensity: threshold/CSS/VO₂ work at race pace, longer bricks, muscular-endurance
  strength. Volume holds/dips, intensity up.
- **Peak** — sharpen: less volume, keep intensity, race-simulation. ~2 weeks.
- **Race / Taper** — big volume cut (~40–60%), keep short race-pace touches, arrive fresh. Taper length scales with
  race distance (sprint ~ few days, IM ~2–3 weeks).
- **Transition** — deliberate recovery after the A-race before the next cycle.

**Periodize by race distance:** Sprint / Olympic (Sumbal 12-week plans) emphasize threshold + higher frequency;
70.3 / IM emphasize aerobic durability, fueling, and long bricks. Duration of each phase scales with the goal.

## 2. Weekly balance across the 3 sports (+ strength)
- Cover **all three sports most weeks** — frequency keeps each skill/adaptation alive; missing a sport for long
  loses it (esp. swim technique). Typical age-grouper: 3 swim · 3 bike · 3 run · 2 strength, scaled to available hours.
- **Prioritize the athlete's LIMITER** (weakest discipline or the one costing the most time) with more frequency/quality,
  while maintaining the strengths. Swim is most-technique + least-fitness-transfer → protect its frequency.
- **Hard/easy + one-quality-per-sport-per-week**: don't stack two key sessions or hammer the same system twice in a row.
- **Respect concurrent-training** (interference): keep key run + key bike apart; place strength away from the next key
  session; run interference > cycling (Wilson) so guard the key run most. Ties `docs/strength-coaching.md`.

## 3. Brick sessions (the triathlon-specific workout)
A **brick** = two disciplines back-to-back (usually **bike → run**), training the legs to run off the bike and
practicing transitions. Core of Build/Peak.
- Start short (e.g. 40′ bike + 10′ run), grow toward race proportions; hold race intensity on the run-off-bike.
- Also **swim → bike** (open-water start → ride) for race practice. **Transitions (T1/T2)** are "free time" — rehearse.

## 4. Testing / benchmarks (reuse the sport engines)
- **Bike:** FTP (existing cycling engine). **Run:** threshold pace / VDOT (running engine). **Swim:** **CSS**
  (400/200 test — `docs/swimming-coaching.md`). Retest each ~every 4–6 weeks / phase change to re-anchor zones.
- The coach plans each sport's sessions to ITS zones, but balances **total** weekly load (sTSS + rTSS + TSS) so the
  combined stress lands in the productive band and Form is managed to the race (reuses the readiness/Form model).

## 5. Strength for triathlon (Hagerman)
Periodized alongside the sports: **Anatomical Adaptation** (Prep/early Base, general, higher-rep) → **Max Strength**
(late Base, heavy, low-rep, power) → **Muscular Endurance / Power** (Build, sport-specific, explosive) → **Maintenance**
(Peak/Race, minimal-effective-dose). Emphasis: posterior chain, single-leg, core, hip drive, and **swim-pull / shoulder
health**. Runs through the existing strength engine with a **triathlon-support focus** (never sabotages the next key
swim/bike/run). Ties `docs/strength-coaching.md` + [[platyplus-gym-engine]].

## 6. How the coach uses this (runtime)
When the athlete's goal is triathlon (sports include swim+bike+run, or an explicit tri flag), `buildSystemPrompt`
emits a **`# TRIATHLON`** block: current phase (from race date + periodization), this week's 3-sport balance, the
limiter to prioritize, whether to schedule a brick, and the taper state. The coach then creates swims (`create_swim`),
rides (`create_ride`), runs (`create_run`), and strength (`create_workout`) for the week, each to its own zones,
balanced to the total-load band and periodized to the A-race. Fueling scales with session + race distance
(existing nutrition guidance). Everything stays inside the athlete's weekly `trainingDays` + `maxPerDay` caps.
