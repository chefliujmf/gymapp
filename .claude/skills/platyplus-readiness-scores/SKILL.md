---
name: platyplus-readiness-scores
description: Compute Platyplus's WHOOP-style 1–5 readiness — Sleep, Freshness, Energy — from intervals wellness + the check-in. The formulas, our data mapping, and the personalization rules. Use when building/changing the auto-derived check-in scores (#158/#159) or coach readiness logic.
---

# platyplus-readiness-scores

Platyplus computes its OWN 1–5 readiness (Sleep · Freshness · Energy) — "our own WHOOP." Full framework
+ verbatim research: **`docs/readiness-scores.md`**. This skill is the operational summary. Always
**label auto values, let the manual check-in tap override, and fall back gracefully** when a signal is missing.

## The three scores (formulas)
- **Freshness (objective, buildable NOW)** — from intervals CTL/ATL/Form:
  `ACWR = ATL/CTL`, `TSB = CTL−ATL`. Map: ACWR `<0.8`&TSB`>+10`→5 · `0.8–1.0`/`0–+10`→4 · `1.0–1.3`/`−15–0`→3
  · `1.3–1.5`/`−30–−15`→2 · `>1.5`/`<−30`→1. Interpolate; if TSB very negative, downward-override (big volume block).
- **Energy** — `0.35·HRV + 0.35·Sleep + 0.15·RHR + 0.15·Subjective` → 0–100 → piecewise 1–5.
  HRV = z-score of **lnRMSSD** vs personal baseline (full if ≥normal, scales down below −1σ); RHR = z-score
  (lower=better, >+1σ penalized hard); Sleep = the 0–100 sleep score; Subjective = the daily check-in.
  Guard parasympathetic saturation (HRV high *and* RHR up = still fatigued).
- **Sleep (personal — #159, NOT fixed hour bins)** — prefer device **sleepScore** (already personalized →/20→1–5);
  else **hours ÷ personal sleep-NEED** (per-user setting, default 8h). Full 0–100 = duration 40% (vs age-adjusted
  personal need) + efficiency 20% + Deep/REM architecture 25% + continuity 15%, when device stages are available.

## Shared 0–100 → 1–5 piecewise map (Sleep + Energy)
`<60→1.0+s/60` · `60–70→2.0+(s−60)/10` · `70–80→3.0+(s−70)/10` · `80–100→4.0+(s−80)/20`. (85→4.25.)

## Baselines (the heart of personalization)
Rolling **EWMA / mean over 28–90 days** of HRV (lnRMSSD) + RHR (+ sleep need from history). `Z=(today−μ)/σ`;
`SWC=0.5σ`. Z≈0 = homeostasis. Compute server-side from intervals `/wellness` history.

## Our data → research inputs
intervals `/wellness`: `ctl`,`atl` (Form), `hrv` (RMSSD), `restingHR`, `sleepScore`/`sleepSecs`. Activities:
TSS (or RPE→TSS: moderate ~50–60/h, hard ~100/h). Check-in: subjective (energy/sleep/soreness 1–5). Profile: sex
(intervals), age (add to profile). `Today.tsx sleepTo5` is the current (too-simple) sleep mapping to replace.

## Cross-metric coach signals (second-order — surface, don't auto-prescribe hard)
- **Freshness↑ + Energy↓** = immune rebound on a deload → possible latent illness; don't go hard.
- **High load + Sleep <3 sustained** = non-functional overreaching; CTL math lies (no Deep-Sleep supercompensation).
- **7-day HRV CV rising** (baseline normal) = losing homeostasis → pre-emptively lower Energy.

## Build pattern
Put the math in a PURE server module `server/readiness.js` (no side effects → unit-test in `src/*.test.ts`):
`freshness(ctl,atl)`, `energy({hrvZ,sleep100,rhrZ,subjective})`, `sleep100(...)`, `to1_5(s)`, `ewma/z/swc`.
Wire intervals wellness → baselines → today's z-scores → the Today check-in (auto + ⓘ + manual override) + the coach.
It's a FRAMEWORK: adopt what our data supports, label estimates, manual tap wins. See memory
[[platyplus-readiness-model]] + the deep-derive cousin [[platyplus-intervals-sync]] for the data plumbing.
