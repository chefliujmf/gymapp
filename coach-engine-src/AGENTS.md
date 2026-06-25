# Repository Instructions

## Publishing plans — Platyplus is the MASTER (2026-06-23)
- **Author every plan INTO Platyplus, not intervals.icu directly.** Use
  `tools/publish_platyplus_plan.py` (→ `POST /api/plan`) for the workout, and the
  Platyplus path for fueling/mind (meals + meditation). Platyplus stores it and
  **mirrors to intervals.icu** (workout steps + the rendered rich description) and
  to Wahoo. Do NOT also publish via `tools/intervals_icu_workouts.py` — two writers
  to intervals causes duplicate/conflicting events. (That tool is being retired to a
  pure renderer that Platyplus calls server-side.)
- **Keep all the rich text**, but structured: send `objective, cues[], success,
  recovery, fuel{meals[],supplements,why}, mind{sessionId,title,why}`. **Fuel = real
  Platyplus recipes** (breakfast/lunch/dinner/snack for the athlete's metabolism/
  protein/load) and **Mind = a real meditation session**, both chosen from the
  Platyplus catalog. The explanation prose lives in each `why` (shown behind an ⓘ in
  the app; written out in full in the intervals mirror). Blocker tracked: add
  `time_target` to the Platyplus→intervals ride push for Wahoo.
- This applies to EVERY coach instance (this engine for all users + any BYO-AI via
  the Platyplus MCP). See gymapp memory `platyplus-coach-engine` + `gymapp/UX-BACKLOG.md`.
- **Intervals duration-parse gotcha (the rendered description that gets mirrored).**
  Intervals parses duration tokens out of the description text and adds phantom steps,
  doubling the chart (a 5h ride showed as ~10h, empty front). Two rules the renderer now
  enforces (`render_workout_text` + `_sanitize_description_prose`, with tests): native
  step durations are in **minutes, never hours** (`- 60m`, not `- 1h`), and prose is
  sanitized so a stray `Nh` (e.g. a cue "do not force a 5h ride") or mid-sentence ` - `
  can't be read as a step. Platyplus mirrors this rendered description, so whatever renders
  the prose must keep these rules. Diagnose by diffing a working vs broken event's
  `moving_time`/`zoneTimes`, not by looking at the chart.

## Git Workflow

- Use trunk-based development only.
- Keep `main` as the working branch unless the user explicitly asks for another branch.
- Make small, coherent commits directly on `main`.
- Sync with `origin/main` frequently so local work stays close to the remote trunk.
- Delete merged or obsolete feature branches instead of keeping stale branch clutter.
