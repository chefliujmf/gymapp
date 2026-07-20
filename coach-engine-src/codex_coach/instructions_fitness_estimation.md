# Fitness Estimation Instructions

This file defines how the coach should estimate current fitness without overreacting to a single ride or a stale platform setting.

> This file owns the **method** for estimating fitness and **when FTP changes**. The current
> coach-maintained FTP **value** and its evidence/history live in `ftp_estimate.md` (independent of
> Intervals eFTP, which is low-biased here). `training_zones.md` owns **how that FTP maps to zone
> percentages/watts**. When the working FTP changes, log it in `ftp_estimate.md`, recompute the watt
> column in `training_zones.md`, and update planned events per "When a working FTP changes".

## Core rule

Treat current fitness as a weighted estimate, not a declared fact.

The goal is to choose useful training targets, not to win an argument about one number.

## Estimation methods

Multiple algorithms can estimate FTP from ride data, each with a different bias; no single one is
"correct." The coach blends them (power-duration/CP curves, ML/demographic, Xert breakthrough, Firstbeat,
DFA α1 HRV) and knows how each fails. Operative rules:

- **Read power-duration curves off ≥10-min efforts.** Short efforts (3–5 min) inflate the estimate
  for anaerobic phenotypes; for this flat-curve diesel athlete, anchor on ≥10-min (ideally 20–40 min)
  power. `icu_eftp` is a CP-curve estimate with this same bias and reads low when efforts are submaximal.
- **A long maximal effort is the missing pillar.** Without a genuine 20–40 min effort the curve is
  extrapolated; treat its absence as the main source of uncertainty.
- **DFA α1 (Polar H10) is a non-maximal cross-check.** Threshold ≈ the power where DFA α1 crosses
  0.50, read from a gradual ramp or clustered effort in the first ~30–60 min, ≤5% R-R artifact. The
  athlete owns the Polar H10 (the named gold-standard); use this to confirm threshold without a
  maximal test. Use the trend, not one session (heat/fatigue depress α1).
- **Carry a TTE (time-to-exhaustion) estimate** with the watt value — an FTP that supports 4×10
  intervals is not proof of 40 continuous minutes.

Weight evidence in this order:
1. recent sustained ride power over 20-60 minutes (≥10-min efforts only for curve reads);
2. repeatability of threshold and VO2 work in the last 14-42 days;
3. DFA α1 (Polar H10) threshold reads where artifact is clean;
4. Intervals.icu modeled metrics such as `icu_eftp` (CP-curve estimate, phenotype-biased);
5. long-ride durability and late-ride power retention;
6. heart rate behavior, drift, and recovery where trustworthy;
7. older peak performances only for ceiling context.

## FTP working estimate

Use a working FTP estimate when prescribing workouts.

Current athlete setting:
- **The working FTP value is owned by `ftp_estimate.md`** — currently `260 W` (athlete-confirmed
  2026-06-15). Read the number from there; do not restate it here.
- this is the operational prescription target, not a confirmed maximal FTP declaration.

> **A confirmatory validation remains high-value.** When the working FTP is athlete-set or extrapolated
> from the power-curve model rather than confirmed by a recent maximal-ish effort (and `icu_eftp` often
> reads low from submaximal bias), treat it as an honest estimate: a genuine 20–40 min effort — or a DFA
> α1 ramp if they have a compatible HR strap — can confirm or move it without a maximal test the athlete
> dislikes. Place it when they're fresh; until then, keep the honesty layer that the number is unconfirmed.

Rules:
- configured FTP in Intervals.icu is context, not proof;
- `icu_eftp` is useful but must be checked against real execution;
- recent 40-60 minute power matters more than optimistic short-test carryover;
- if evidence conflicts, bias slightly conservative for prescription;
- if confidence is low, say so explicitly.

## Confidence bands

Use these confidence labels:
- `high`: multiple recent workouts and long efforts point to the same range;
- `medium`: evidence generally agrees, but key validation is missing;
- `low`: data is sparse, stale, contradictory, or heavily fatigue-distorted.

## Durability read

Assess durability from:
- power retention late in rides lasting 2-4 hours;
- ability to complete quality work after accumulated fatigue;
- heart rate drift on endurance rides;
- whether late intervals collapse or stay controlled.

Strong durability does not automatically mean higher FTP.
Weak durability can suppress performance without meaning threshold has fallen.

## What counts as supporting evidence

Evidence for a higher working FTP:
- controlled `2x20`, `3x15`, or similar threshold sessions completed cleanly;
- recent best 35-50 minute steady efforts trending upward;
- repeated rides where target threshold work feels sustainable rather than survived;
- Intervals.icu model rising and staying elevated after hard but believable rides.

Evidence against a higher working FTP:
- frequent fade on second or third threshold rep;
- best long efforts sitting well below the configured threshold;
- hard rides requiring surges to keep averages inflated;
- Intervals.icu model remaining materially lower for weeks.

## Update rules

Adjust the working estimate only when the evidence is strong enough to matter operationally.

Default guidance:
- small upward adjustment: when repeated evidence suggests targets are too easy;
- small downward adjustment: when recent execution repeatedly fails under normal freshness;
- no change: when data is mixed, fatigue is high, or the athlete has not recently expressed threshold well.

Default adjustment size:
- usually `2-5 W`, not large jumps.

When a working FTP changes:
- update future workout specs and Intervals.icu planned events that still reference the old FTP;
- update Intervals.icu Ride sport FTP if workouts are prescribed with `%ftp` targets;
- explicitly state what is confirmed versus what is being used for training prescriptions;
- define the next validation workout or evidence threshold.

## Reassessment rhythm

FTP is a baseline setting and must be checked on a schedule, not only when the athlete asks.

Use three layers:
- after every key threshold, sweet-spot, over-under, VO2, or unusually strong sustained ride: make a micro-decision of `raise`, `hold`, `lower`, or `insufficient evidence`;
- weekly during planning: report the current working FTP, confidence, whether it changed or stayed the same, and the next evidence needed;
- every 4-6 weeks during build phases, or after a recovery week, schedule a deliberate validation session if recent workouts have not already provided enough evidence.

Do not run maximal FTP tests too frequently. A formal hard test should usually be separated by at least 4-6 weeks unless the current FTP is clearly wrong and the athlete is fresh enough to test safely.

Preferred validation options:
- primary: controlled threshold/sweet-spot progression such as `2x20`, `3x15`, or over-under work with RPE and fade criteria;
- secondary: hard sustained field effort of about 35-50 minutes when well rested and motivated;
- occasional: ramp test or classic test only when it answers a practical calibration question better than normal training evidence.

The weekly output must include one plain sentence:
- `Working FTP stays at X W because ...`
- `Working FTP moves from X W to Y W because ...`
- `FTP evidence is insufficient; keep X W until ...`

## Testing bias

For an athlete who dislikes formal tests (respect their profile preference):
- avoid classic FTP tests unless explicitly requested;
- infer threshold from normal training, long rides, and targeted validation sessions;
- be skeptical of numbers that exceed recent 40-60 minute evidence by too much;
- recognize that time-crunched schedules can underexpress true ceiling, especially if fatigue is unmanaged.

## Output requirements

When reporting fitness, include:
- current working FTP range;
- confidence level;
- strongest supporting evidence;
- strongest counter-evidence;
- what would validate the next change.
