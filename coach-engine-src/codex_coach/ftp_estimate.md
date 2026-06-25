# Coach FTP Estimate

> **Owns:** the coach's own working FTP estimate and the evidence/method behind it. This is the
> authoritative training-FTP value — `athlete_profile.md` and any `%ftp` prescription defer here.
> It is **independent of Intervals.icu eFTP**, which is used only as one input (and a low-biased one).

## Why a coach-owned estimate

Intervals' eFTP is modeled as if recent efforts were near-maximal. This athlete is a diesel who
rides most efforts submaximally (typical hard-ride RPE 5–6), so eFTP runs **low**. The coach
therefore maintains its own estimate from the power-duration curve, effort context (RPE/Feel),
recency/detraining, and deliberate validations — and updates it over time as evidence arrives.

## Current estimate

- **Working FTP: 260 W** (athlete-confirmed 2026-06-15; matches the Intervals Ride FTP). Use this
  for all `%ftp` prescriptions.
- **Coach model estimate: ~250 W** (medium confidence, *extrapolated* — see below). The athlete is
  confident in 260 and has direct knowledge of their own ceiling; the coach defers to that for the
  working number while keeping this analytical note so the gap is tracked honestly, not buried.
- The gap is small (~4%) and within the uncertainty of an estimate built without any maximal long
  effort. A clean maximal validation when fresh would confirm 260 (or open the door back toward 270);
  treat it as confirmatory, not corrective, given the athlete's confidence.
- W/kg: 260 W ≈ 3.4 W/kg at 76 kg. Sept-1 stretch (300 W ≈ 3.9–4.0 W/kg) is above the current
  trajectory — see the revise-vs-chase gate in `plans/active/annual_targets_*.md`.
- Last set: 2026-06-15. Next review: after the next genuine threshold/validation effort, else by 2026-06-29.
- **Action when this changes the prescription:** update the Intervals Ride FTP
  (`tools/intervals_icu_workouts.py set-ride-ftp <watts>`) and re-publish `%ftp` workouts.

## Method (how the coach estimates FTP)

Method detail and the multi-algorithm background live in
[reference_ftp_estimation_methods.md](</Users/jmfiset/dev/cyclingcoach/codex_coach/reference_ftp_estimation_methods.md>)
(ingested from the "Estimating FTP From Ride Data" research). Summary:

1. **Power-duration curve first, off ≥10-min efforts.** Use best sustained efforts across recent +
   historical rides (`icu_pm_ftp_watts` @ `icu_pm_ftp_secs`, Strava history). Ignore 3–5 min efforts
   for the FTP read — they inflate the estimate for anaerobic types. For a flat curve (small 5→12 min
   decay, as here), FTP ≈ ~0.90–0.93 × best ~12-min power; for a steep curve, weight longer efforts.
2. **Discount for effort.** If the best efforts were submaximal (RPE ≤ 6, Feel strong, no fade),
   the raw model underestimates — adjust upward toward the achievable maximal.
3. **Adjust for state (decay/re-anchor).** Lower the estimate when detrained (CTL well below the
   athlete's norm), raise it toward fit-state potential when CTL is high and execution is clean; a
   genuine hard effort re-anchors it (Xert-style breakthrough logic).
4. **eFTP as a low-biased input, not the answer.** Intervals eFTP is a CP-curve estimate with the
   short-effort/submaximal bias above; do not adopt it directly.
5. **DFA α1 cross-check (Polar H10).** Threshold ≈ the power where DFA α1 crosses 0.50, from a
   gradual ramp or clustered effort in the first ~30–60 min with ≤5% R-R artifact. This is a
   *non-maximal* confirm using hardware the athlete already owns — the preferred way to settle the
   number without a test he dislikes. Use the trend, not one session.
6. **Validations win.** A genuine maximal 20-min (FTP ≈ 0.95 ×), 2×12-min effort, or a clean DFA α1
   read overrides all modeling. Place one when fresh before committing to an overload step.
7. **Track TTE and be honest about gaps.** Record the time-to-exhaustion the watt value implies
   (e.g. "260 W ≈ sustainable ~X min"); state confidence; if no true long maximal effort exists, say
   the number is extrapolated.

## Evidence behind the current estimate (2026-06-15)

- Flat curve: best 5-min ≈ 289 W, best 12-min ≈ 271 W (2025-08-29, peak) → ~6% decay.
- 2026-05-30 "Threshold Check": **251 W / 12 min at RPE 6** (submaximal) → maximal ~265–270/12 min.
- No genuine maximal 20–40 min effort exists in the history → number is extrapolated, hence medium
  confidence and the call for a validation.
- Intervals eFTP 240, drifting down (248 Apr → 240 Jun) from chronically submaximal riding.

## History

| Date | Working FTP | Source | Note |
| --- | ---: | --- | --- |
| (prior) | 270 W | athlete belief | felt high in hindsight |
| (prior) | 255 W | revised down | evidence-driven lowering |
| (prior) | 260 W | revised up | athlete's preferred working value |
| 2026-06-15 | 260 W | **athlete-confirmed** | coach model said ~250 (extrapolated, medium conf); athlete confident in 260, coach defers. Validation optional/confirmatory. |

Append a row on every change. Keep history; never overwrite.
