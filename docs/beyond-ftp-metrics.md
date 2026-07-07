# Beyond FTP — CP · W′ · CS · D′ · Efficiency Factor (coach knowledge base)

Added 2026-07-07 at JM's request. The "metrics that really drive performance" beyond a single FTP number —
Platyplus surfaces them as per-sport benchmark cards (#403) + a synthesis **athlete-profile** card. This is the
theory the coach reasons from. Pairs with `docs/tte.md`.

Sources: Matt Bottrill "Beyond FTP"; joinvekta "Critical Power & W′"; roadman "Efficiency Factor" (Joe Friel);
High North "Critical Power Calculator" (https://www.highnorth.co.uk/articles/critical-power-calculator).

## Critical Power (CP) / Critical Speed (CS)
The highest power (running: pace) you can sustain **near-indefinitely** — the asymptote of the power/pace-duration
curve, and your true aerobic ceiling. FTP/threshold sits just above CP/CS. **More precise than FTP** because it's
modelled from efforts across many durations, not one 20-min test. Units: CP in W, CS as a pace (sec/km).

## W′ / D′ ("W-prime" / "D-prime")
The **finite work above CP** (running: distance above CS) before exhaustion — your **anaerobic battery** for
attacks, surges and sprints. W′ in kJ, D′ in metres. Big = puncheur/kicker; small = diesel. Two riders with the
same CP perform very differently by W′.

**How CP & W′ are calculated** (High North): the 2-parameter critical-power model fits **Work = CP·t + W′** across
maximal efforts of different durations (classically a ~3-min and ~12-min max, or the whole power-duration curve).
So `P(t) = CP + W′/t`, and **TTE at a power P = W′ / (P − CP)**. Platyplus reads CP/W′ (and CS/D′) straight from
intervals' maintained model fit — **no formal test**; they sharpen as the athlete does varied hard efforts.

## TTE — see `docs/tte.md`
Time to hold FTP/threshold (normal 30–70 min). Derived from CP/W′: `W′/(FTP−CP)`. A short TTE = a training target
(extensive threshold), or FTP set too high vs CP. **High FTP + short TTE = fragile/punchy; moderate FTP + long
TTE = diesel.**

## Efficiency Factor (EF) + decoupling
**EF = Normalised Power ÷ average HR** (running: NGP-speed ÷ HR) on a steady aerobic effort — **aerobic engine
quality** (power per heartbeat). Masters ~1.4–2.0; the **absolute value matters less than the TREND**.
- **Rising EF** (e.g. +5% over an 8–12 wk base block) = genuine aerobic adaptation, **even when FTP is flat** —
  the signal FTP misses. Keep the base work; power gains follow.
- **Flat/falling EF** = the stimulus isn't landing — check sleep/stress/fuelling before adding load.
- Track over ~4–6 comparable rides; ignore single-ride noise.
- **Aerobic decoupling (Pw:HR)** = within-ride durability (1st vs 2nd half). EF is the long-arc metric; decoupling
  is the durability check.

## How the COACH should use all this (no crazy tests)
1. **Read them together → an athlete TYPE**, not one number. Platyplus computes this (profile card): FTP·TTE·CP·W′·EF
   → Punchy-threshold / Diesel / All-rounder / Puncheur + a per-metric read + a training focus.
2. **Everything improves through NORMAL training** — the efforts ARE the data (the CP/W′ model + TTE sharpen as
   they train). Never demand a formal exhaustion test.
3. **Prescription by profile:**
   - Short TTE / punchy → **extensive threshold** (3×15–20 / 3×24 / 4×15 min @ 90–95% FTP; runs @ threshold) to
     build fatigue resistance; ease FTP toward eFTP/CP if it's optimistic.
   - Long TTE / diesel → **raise the ceiling** (4×8–12 min @ 100–105%; 5 k-pace intervals) to lift FTP/CP.
   - Small W′/D′ → **short near-max repeats** (30 s–3 min bike / 200–600 m run) for punch.
   - Any → **aerobic volume** underneath (feeds rising EF + a higher future ceiling).
4. **Watch EF for the base-phase win** and decoupling for durability; watch **CP vs FTP** for threshold accuracy.
