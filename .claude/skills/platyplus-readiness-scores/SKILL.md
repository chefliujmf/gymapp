---
name: platyplus-readiness-scores
description: Compute Platyplus's WHOOP-style 1–5 readiness — Sleep, Freshness, Energy — from intervals wellness + the check-in. The formulas, our data mapping, and the personalization rules. Use when building/changing the auto-derived check-in scores (#158/#159) or coach readiness logic.
---

# platyplus-readiness-scores

Platyplus computes its OWN 1–5 readiness (Sleep · Freshness · Energy) — "our own WHOOP." Full framework
+ verbatim research + the deep-research "WHOOP deep-dive": **`docs/readiness-scores.md`**. This skill is the
operational summary. Always **label auto values, let the manual check-in tap override, and fall back gracefully**.

> **BUILT 2026-06-28 (#195).** The engine is the pure, unit-tested **`server/readiness.js`** (`freshness`, `energy`,
> `sleep`, `baselines`, `readiness`) — make changes THERE + extend `src/readiness.test.ts`. **`GET /auth/readiness`**
> computes it from 60d intervals wellness; the Today check-in (`CheckInCard`, `src/pages/Today.tsx`) auto-fills all three
> via `authApi.readiness(day)` with an ⓘ "why" + "· auto" tag + tap-to-override. Decisions locked by the research:
> **z-score lnRMSSD (not raw RMSSD)**, HRV is a TREND not a single night, **RHR parasympathetic-saturation guard**
> (high HRV + raised RHR ⇒ cap HRV credit), **cold-start gate** (no HRV baseline ≥14d → Energy null → manual tap),
> Sleep = device score else **hours ÷ personal need**. Open: per-user `sleepNeed` setting (#159), coach signals.

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

## Forecast (future days) + daily auto-adapt
- **Freshness is the only score forecastable ahead** (Energy/Sleep need HRV/sleep that haven't happened yet).
  `GET /auth/readiness-forecast?date=X` projects Form over PLANNED load → expected Freshness 1–5 + label (ForecastCard).
- **It's MORNING readiness (#365):** project the planned load for the days BEFORE the target ONLY — exclude the
  target day's OWN session (else a hard day projects its own post-session fatigue → false "wrecked"). The endpoint
  builds `loads` for `today+1 .. target-1`; `forecastFreshness` in readiness.js.
- **Skip non-session events (#366):** an intervals ATP **weekly TARGET** (category `TARGET`, e.g. "ATP W06" ~250
  TSS for the WEEK) or a NOTE is NOT a single-day load — counting it spikes ATL → false "wrecked". Filter
  `category==='TARGET'|'NOTE'` + `/^ATP/`. Same on `/auth/readiness-projection` (the Load/Form chart).
- **Planned load is now supplied (#372):** intervals does NOT compute load for API-created workouts, so we set
  `icu_training_load` from `plannedTss` (Coggan TSS, FTP-independent) in `planToIcuEvent`. Now both our forecast AND
  intervals' own Form drop for a hard week (before, a 2h ride left Form ~-3 flat). Backfill: `POST /api/plans/resync`.
- **Daily auto-adapt (#367):** `dailyAdaptTick` (server.js, QA/prod, every 30 min) runs the locked-down coach each
  morning per athlete's LOCAL tz — an EARLY pass ~4am (Form/freshness) + a REFINE pass once HRV/sleep lands — to
  proactively re-plan the rolling **14-day** horizon + notify + ask-if-uncertain. Runtime-message-driven
  (`dailyAdaptMsg`), kept OUT of `coach-engine.md` (E2BIG systemPrompt-size, #352). Test via `POST /api/coach/daily-adapt`.

## Build pattern
Put the math in a PURE server module `server/readiness.js` (no side effects → unit-test in `src/*.test.ts`):
`freshness(ctl,atl)`, `energy({hrvZ,sleep100,rhrZ,subjective})`, `sleep100(...)`, `to1_5(s)`, `ewma/z/swc`.
Wire intervals wellness → baselines → today's z-scores → the Today check-in (auto + ⓘ + manual override) + the coach.
It's a FRAMEWORK: adopt what our data supports, label estimates, manual tap wins. See memory
[[platyplus-readiness-model]] + the deep-derive cousin [[platyplus-intervals-sync]] for the data plumbing.
