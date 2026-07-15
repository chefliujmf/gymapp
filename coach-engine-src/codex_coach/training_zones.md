# Training Zones (Canonical Reference)

> **This file is the single source of truth for what every intensity word means.**
> Whenever any module or workout says "endurance", "tempo", "sweet spot", "threshold",
> "VO2", "Z2", etc., it means the ranges defined here. Do not invent or drift from these
> boundaries. When the working FTP changes, the percentages stay fixed and the watt column
> is recomputed — see `instructions_fitness_estimation.md` for when FTP itself changes.

## Power zones

Model: 7-zone power, anchored to the athlete's **working FTP** (from their profile / benchmarks).
Percentages are of FTP; compute any watt column against the athlete's current FTP and recompute it
whenever the working FTP changes.

| Zone | Name | % FTP | Watts @260 | RPE /10 | Purpose | Typical cadence |
| --- | --- | --- | --- | ---: | --- | --- |
| Z1 | Recovery | ≤ 55% | ≤ 143 | 1–2 | Active recovery, spin-out, warmup/cooldown bookends | 85–95 |
| Z2 | Endurance | 56–75% | 146–195 | 2–4 | Aerobic base, durability, fat oxidation, most weekly volume | 85–95 |
| Z3 | Tempo | 76–87% | 198–226 | 4–5 | Aerobic strength, time-efficient durability | 85–95 |
| SS | Sweet Spot | 88–94% | 229–244 | 5–6 | Best FTP-stimulus-per-fatigue; the workhorse for this build | 85–95 |
| Z4 | Threshold | 95–105% | 247–273 | 6–7 | Raise FTP directly; 2x20, 3x15, 4x10 | 85–95 |
| Z5 | VO2max | 106–120% | 276–312 | 8–9 | Aerobic ceiling; 3–5 min reps | 95–110 |
| Z6 | Anaerobic | > 120% | > 312 | 9–10 | Short, sparing; not a focus for a diesel rider | 100+ |

Notes:
- The "do not surge above 75% FTP" cap used in easy-ride skill drills = top of Z2.
- Sweet Spot is the deliberate workhorse of the FTP-priority build: most adaptation per unit
  of fatigue, sustainable in a time-crunched week. Bias here before piling on threshold.
- VO2 (Z5) is a supporting stimulus, used in deliberate blocks, not sprinkled randomly.
- Z6 is rarely prescribed for this sustained-power athlete except for neuromuscular variety.

## Named workout patterns

- **Over-unders:** alternate ~3 min just under threshold (90–95%) with ~1–2 min just over
  (100–105%); trains lactate clearance at race-style intensity.
- **Sweet-spot durability:** 2–3 x 12–20 min at 88–94%, often late in a longer ride.
- **Threshold repeatability:** 2x20 / 3x15 / 4x10 at 95–105%, judged on whether the last rep
  holds target without surging — this is the primary FTP-validation pattern (see
  `instructions_fitness_estimation.md`).
- **VO2:** 4–6 x 3–5 min at 106–120%, equal or slightly shorter recovery.

## Intensity distribution model

Distribution is measured by **time**, not by TSS. Target across a build block:
- ≈ 70–80% of riding **time** in Z1–Z2 (easy);
- the remaining ≈ 20–30% spread across Z3–Z5, concentrated in 1–2 key sessions per week;
- this is a pyramidal distribution (lots of easy, a moderate amount of tempo/sweet spot, a
  little threshold/VO2) — appropriate for a time-crunched durability/FTP build, rather than
  strict polarized.

Because the athlete is time-crunched (5–9 h/week), the easy-time share and the weekly TSS
target can feel in tension. They are reconciled in `instructions_weekly_planning.md` under
"Load vs distribution": the TSS targets are **ceilings reached on good weeks**, and the
easy-time rule always wins when the two conflict.

## Heart-rate and RPE fallback

Power is primary. When power is unavailable or untrustworthy (e.g. some outdoor
rides), prescribe by RPE using the table above, and treat HR as confirmation, not target.
HR lags power and drifts with heat/fatigue, so never chase a HR number during intervals.
