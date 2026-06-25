# Plans

Dated plan files (week plans, one-off adjustments, and the annual target macro plan) live here,
split so "the current plan" never requires scanning filenames by date:

- `active/`: the macro target plan plus the current block / week and recent live context. **Look
  here for the plan in effect now.**
- `archive/`: superseded and past-dated plans, kept for history and rationale traceability.

When a plan is superseded, `git mv` it from `active/` to `archive/` rather than deleting it.
Individual workout specs are standalone (no relative `spec_path` dependencies between them), so
moving a file does not break path resolution.
