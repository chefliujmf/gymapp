# Coaching Review — cyclingcoach

_Review date: 2026-06-15. Scope: coaching substance (the training logic, the macrocycle, and the
current week) rather than repo/engineering hygiene — that is covered separately in `AUDIT.md`._

The coaching system is well-built and self-consistent: canonical zones, the public/private Strava
text split, the revise-vs-chase gate, the "easy-time rule wins over TSS" reconciliation, and the
dated feedback-memory ledger are all sophisticated. The internal "hours × 45-55 = sustainable TSS"
sanity check actually holds across the annual table. Findings below are about physiological safety
and the few places ambition outruns the guardrails. Each has a checkbox so this doubles as a
worklist. Items marked _(applied)_ were edited into the source files in this pass.

## High

- [x] **The whole plan rests on an unvalidated FTP.** _(applied)_ Working FTP is 260 W, confidence
  `medium`, not validated upward since 2026-05-30 — yet every `%FTP` prescription and the entire
  300 W feasibility judgment hang on it, while the athlete keeps signalling easy work feels
  underdosed. A clean threshold/sweet-spot validation should be the explicit next high-value session
  when fresh, not left to the 4-6 week default. Elevated to top near-term priority in
  `instructions_fitness_estimation.md` and noted in `annual_targets_*.md`.
- [x] **No volume ramp-rate guardrail.** _(applied)_ The system gates *intensity* (Form -10 to -20,
  deload triggers) but never caps *week-over-week volume*. The macrocycle climbs to 8.8-9.5 h
  overload weeks against a 5-6 h baseline — a 60-90% jump, and the highest weeks land in peak summer
  heat. For a 40-year-old the ramp rate is the real injury/illness ceiling. Added a hard gate
  (≤~10-15% over the trailing 4-week average; re-entry rebuilds frequency first; manual labor counts
  as load; ramp gate wins over the table) in `instructions_weekly_planning.md`.
- [x] **Strength disappears exactly where the athlete says it matters.** _(applied)_ Profile is
  emphatic about gym identity, but the high-load weeks leave no room and strength lapses by
  attrition. Added a minimum-effective-dose rule (≥1 session every week including overload weeks;
  upper body/trunk stay at full maintenance even when lower body drops to protective sets) in
  `instructions_strength.md`.

## Medium

- [ ] **Current week (Jun 15-21) re-entry is steep.** Week 2 was a disrupted 131 TSS / 3.3 h plus
  heavy eccentric manual work (tree cutting, trench digging, 2 h hike); week 3 targets 340 TSS /
  7.2 h — a ~2.6× load step into legs that just did unaccustomed loading, with the left calf and low
  back already flagged. Today's recovery check is the right instinct and the week is conditionally
  gated ("Wednesday sweet spot _if_ legs/back normal"), but the 340 headline pulls toward eagerness.
  The new re-entry rule now covers this; apply it when regenerating the rest of this week (consider
  ~5-5.5 h, hold the second quality session until Tuesday confirms normal).
- [ ] **Heat-adjusted targets for the late-July/August peak.** Week 9 (Jul 27, 9.5 h) and the
  August overload weeks sit in peak Quebec heat. `instructions_health_and_peaking.md` has heat
  acclimatization; make sure the overload weeks actually apply heat-reduced power expectations and
  do not also break the ramp gate. Cross-reference added in `instructions_weekly_planning.md`.

## Already good

- The 300 W-by-Sept-1 target is framed honestly (+15% in 3 months correctly called "very aggressive,
  not a base case") with a working revise-vs-chase gate. Keep treating it as a ceiling.
- Periodization is sound: 3-4 week waves, mandatory deloads at ~45% load drop, pyramidal
  distribution, sweet-spot-led build, logical Sept 1 validation → review → fall durability.
- Time-crunched load reconciliation (easy-time rule over TSS) and the W/kg framing are strong.

## How this was addressed

- The FTP-validation priority, volume ramp-rate guardrail, and minimum strength dose were edited
  directly into `instructions_fitness_estimation.md`, `instructions_weekly_planning.md`,
  `instructions_strength.md`, and `plans/active/annual_targets_2026-06-01_to_2027-05-30.md`, and logged as dated
  active rules in `coach_feedback_memory.md`.
- The two open Medium items are plan-execution decisions for the next COACHCHECK / week
  regeneration, not file edits.
