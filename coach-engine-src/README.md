# cyclingcoach

Personal cycling coach workspace centered on `Intervals.icu` for planning and feedback, with `Wahoo ROAM` as the workout delivery endpoint.

## Repo layout

- `.agents/skills/cycling-coach/SKILL.md`: **canonical operational entry point and router** — start here
- `instructions.md`: coaching philosophy, primary objective, and behavioral principles (defers to SKILL.md for routing and to `codex_coach/athlete_profile.md` for athlete numbers)
- `coach_system.md`: repo architecture and source-of-truth notes
- `codex_coach/`: athlete profile, coach modules, workout schema, examples
- `codex_coach/activity_recovery_trace.md`: rules for using Intervals paired planned events as the native planned-workout trace
- `tools/`: executable Intervals.icu publishing and readback utilities

Local-only reference books and athlete data are kept out of GitHub.
