# Repository Audit — cyclingcoach

_Audit date: 2026-06-15. Scope: full repo (operating prompts, SKILL definition, `tools/*.py`, git health, file layout)._

The coaching logic in this repo is strong and thoughtfully written. The gap to "next level" is engineering hygiene: git health, a single source of truth, testing, and file structure. Findings are ordered by severity. Each has a checkbox so this doubles as a worklist.

## Critical

- [x] **`.git` is ~1 GB.** _Resolved 2026-06-15: history rewritten with git-filter-repo; `.git` is now ~1 MB. Binary trees kept local-only._ History has large binaries baked in permanently: `data/strava_full_history.zip` (~219 MB), the Playwright driver `node` binary (~119 MB), `data/i28814_fit_files.zip` (~15 MB), and most knowledge-base books (epub/pdf, ~100 MB+). They are gitignored *now*, but git keeps every past version, so every clone drags the full gigabyte. Fix by rewriting history with `git filter-repo` (see `scripts/repo_cleanup.sh`). Expected result: repo drops to a few MB.
- [x] **LFS is declared but never initialized — 99 files are in a broken state.** _Resolved 2026-06-15: LFS removed entirely (config, hooks, `.gitattributes` routing); book/asset trees gitignored and local-only._ `.gitattributes` routes books/PDFs/PNGs to LFS, but `git lfs` was never set up. The result: HEAD stores 132-byte LFS *pointer* files while the real binaries sit in the working tree, so `git status` shows 99 phantom "modified" files. Decide one path and commit to it: either initialize LFS properly, or (recommended, matching the README's "books kept out of GitHub") remove these from tracking and gitignore them. The cleanup script does the latter.

## High

- [x] **Three competing "system" documents.** _Resolved 2026-06-15: `.agents/skills/cycling-coach/SKILL.md` is the single canonical entry point; `instructions.md` now holds only philosophy/objective and defers routing to SKILL.md and athlete numbers to `athlete_profile.md`; `README.md` updated to name SKILL.md as the entry point and stop calling `instructions.md` the operating prompt._ `instructions.md`, `coach_system.md`, and `.agents/skills/cycling-coach/SKILL.md` all describe how the coach operates and overlap — e.g. the 60-minute-minimum-ride rule and planning rules live in both `instructions.md` and `codex coach/instructions_weekly_planning.md`. Edits to one silently drift from the others. Designate `SKILL.md` as the canonical operational entry point; have the others link to it instead of restating rules. Duplicated rules are how an AI coach starts contradicting itself.
- [x] **Five overlapping feedback files.** _Resolved: each carries a one-line ownership header; additionally (2026-06-15) the COACHCHECK required-blocks spec is now owned solely by `coach_feedback_format.md` — `feedback_protocol.md` and `SKILL.md` link to it instead of restating, removing the divergent copies._
- [x] **No tests for ~4,100 lines of Python.** _Resolved: `tests/test_intervals_icu_workouts.py` (46 tests) covers the pure formatting/duration/payload core, expanded 2026-06-15 with regression tests for the calendar-payload bug, falsy-zero guards, and `resolve_api_key`._

## Medium

- [x] **`SystemExit` raised from inside helpers/handlers.** _Resolved 2026-06-15: `api_request` already raised `IntervalsAPIError`; added `CoachInputError` for bad input/config, extracted `resolve_api_key()`, converted ~30 helper/handler `SystemExit` calls to it, and `main()` now converts both exception types to exit codes at the boundary._
- [x] **Folder names contain spaces** — `codex coach/`, `coach books/`, `knowledge base/`, `coach book source assets/`. Every script and instruction must quote them; a constant source of fragile shell calls. _Resolved 2026-06-15: renamed to underscore form (`codex_coach/`, `coach_books/`, `knowledge_base/`, `coach_book_source_assets/`); all path references updated. (Plan-archive split below not yet done.)_
- [x] **Dated-plan sprawl.** _Resolved 2026-06-15: 21 dated files moved into `codex_coach/plans/active/` (macro targets + current block/week) and `codex_coach/plans/archive/` (past/superseded), with `plans/README.md` and updated references in `SKILL.md`, `codex_coach/README.md`, and `gym_execution_options.md`._
- [x] **No `pyproject.toml`, linter, or formatter.** _Resolved: `pyproject.toml` configures ruff + pytest; a `dev` optional-dependency group (`pytest`, `ruff`) was added 2026-06-15 so local setup matches CI._

## Already good

- Secrets hygiene is clean: `.secrets/` ignored, no leaked keys, sensible `coach.env.example`.
- Coaching prompts are specific and evidence-based, not generic.
- Code is type-annotated and reasonably factored.
- The public-Strava vs private-coaching text split is a genuinely sophisticated privacy design.

## 2026-06-15 follow-up audit — code correctness

A second pass reviewed the Python tooling for correctness, not just hygiene. Fixed directly (all guarded by tests, `pytest` green, `ruff` clean):

- [x] **Live-calendar corruption in `build_event_payload`.** Gym/non-Ride events with no `estimated_duration_sec` previously emitted no `moving_time` and never cleared `load`/`icu_training_load`, so a reused ride slot kept stale bike duration and TSS. Now every event type emits an explicit duration, and load fields are cleared for all non-power sports (`POWER_LOAD_EVENT_TYPES`). Regression test added.
- [x] **Inconsistent `/events/bulk` upsert params.** `publish-week` and `publish-targets` used plain `upsert` while `publish` used `upsertOnUid` — a duplicate-event risk. All three now use `upsertOnUid` keyed on the stable `external_id`.
- [x] **Falsy-zero bugs.** `format_power_target` dropped `hr_zone: 0`; `missing_feedback` flagged a real RPE/Feel of 0 as missing and classified CSV (string) vs detail (int) differently; `select_event_fields` hid a real `0` load behind a stale value; `format_duration` rendered negatives as garbage. All now use explicit `None`/empty checks (`has_value`), and a negative duration raises.
- [x] **Duplicated env loader.** `load_local_env_files` was copy-pasted in two tools; extracted to `tools/coach_env.py`.
- [x] **Spent cleanup script.** `scripts/repo_cleanup.sh` (phases already executed/committed) moved to `archive/repo_cleanup.executed.sh` with a hard re-run guard.

### Deferred (deliberate)

- **Full module decomposition** of `intervals_icu_workouts.py` (~1.9k lines) and externalizing the inline manuscripts in `build_coach_books.py` (~1k lines of strings) were **not** done. The pure core is already importable and tested, so the testability payoff is low, while a hasty split of the untested `command_*`/argparse layer (or the unverifiable book build, which needs PIL/ebooklib) carries real regression risk on tools that write to a live calendar / generate books. Worth doing as a separate, individually-verified refactor — not bundled into this correctness pass.

## How the original items were addressed

- `AUDIT.md` (this file), feedback-file ownership headers, canonical-source notes, the test suite, and `pyproject.toml` were applied directly.
- The git history rewrite, LFS resolution, folder renames, and plan split have all been executed and committed; the bundling script is archived at `archive/repo_cleanup.executed.sh` for reference only.
