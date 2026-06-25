#!/usr/bin/env bash
#
# repo_cleanup.sh — one-time repository cleanup for cyclingcoach
#
# ⚠️  ALREADY EXECUTED — DO NOT RE-RUN.
#   All phases below were applied and committed (history rewrite, LFS removal,
#   folder renames; the dated-plan split was later done manually into
#   codex_coach/plans/active|archive). Re-running would rewrite git history and
#   force-push again on an already-clean repo. Kept only for historical reference.
echo "repo_cleanup.sh has already been executed and is retained for reference only." >&2
echo "Re-running would rewrite git history and force-push. Aborting." >&2
exit 1
#
# WHAT THIS DOES
#   Phase 0  Safety backups (full mirror bundle + copy of binary dirs)
#   Phase 1  Strip large binaries from ALL git history (git filter-repo)
#   Phase 2  Fix the broken LFS state and .gitattributes
#   Phase 3  Rename space-containing folders + update references
#   Phase 4  Split dated plan files into active/ and archive/
#   Phase 5  Re-commit and print force-push instructions
#
# WHY IT IS A SCRIPT YOU RUN (not done for you):
#   It rewrites git history and requires a force-push to GitHub. That is
#   destructive and irreversible on the remote, so it must run on your
#   machine with your git credentials — review it first.
#
# REQUIREMENTS:  git, git-filter-repo  (pip install git-filter-repo)
# RUN FROM:      the repo root.  Each phase is guarded so you can run them
#                one at a time by commenting out the others at the bottom.
#
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
BACKUP_DIR="$(dirname "$REPO_ROOT")/cyclingcoach_cleanup_backup_$(date +%Y%m%d_%H%M%S)"

confirm() {
  read -r -p ">>> $1 [type 'yes' to continue] " ans
  [ "$ans" = "yes" ] || { echo "Aborted."; exit 1; }
}

# ----------------------------------------------------------------------------
phase0_backup() {
  echo "== Phase 0: backups =="
  mkdir -p "$BACKUP_DIR"
  # Full, restorable copy of history:
  git bundle create "$BACKUP_DIR/cyclingcoach.bundle" --all
  # Physical copy of the large/local-only files, so we can restore them to the
  # working tree after history is rewritten (filter-repo removes them).
  for d in "data" "knowledge base" "coach books" "coach book source assets" ".vendor"; do
    [ -e "$d" ] && cp -a "$d" "$BACKUP_DIR/" || true
  done
  echo "Backup written to: $BACKUP_DIR"
  echo "Restore history if needed with: git clone $BACKUP_DIR/cyclingcoach.bundle restored"
}

# ----------------------------------------------------------------------------
phase1_strip_history() {
  echo "== Phase 1: strip large binaries from history =="
  command -v git-filter-repo >/dev/null || { echo "Install: pip install git-filter-repo"; exit 1; }
  confirm "This REWRITES ALL GIT HISTORY. Backup done in Phase 0?"

  # Paths removed from every commit. Adjust to taste before running.
  # Default: clearly disposable / local-only / third-party content.
  git filter-repo --force \
    --invert-paths \
    --path-glob 'data/*' \
    --path-glob '.vendor/*' \
    --path-glob '.venv/*' \
    --path-glob 'knowledge base/*.pdf' \
    --path-glob 'knowledge base/*.epub'

  # OPTIONAL — also purge your generated books/assets from history if you do
  # not need them versioned (they stay on disk locally). Uncomment to enable:
  #   --path-glob 'coach books/*' \
  #   --path-glob 'coach book source assets/*'

  echo "History rewritten. Restoring local-only files to working tree..."
  for d in "data" "knowledge base"; do
    [ -e "$BACKUP_DIR/$d" ] && cp -a "$BACKUP_DIR/$d" "$REPO_ROOT/" || true
  done
  echo "git repacking..."
  git reflog expire --expire=now --all
  git gc --prune=now --aggressive
  echo "New .git size:"; du -sh .git
}

# ----------------------------------------------------------------------------
phase2_fix_lfs() {
  echo "== Phase 2: fix LFS / .gitattributes =="
  # LFS was declared but never initialized, leaving 132-byte pointer files in
  # HEAD while real binaries sit in the working tree (99 phantom 'modified').
  # We remove the LFS routing entirely and keep the binary trees local-only.
  cat > .gitattributes <<'EOF'
# Normalize line endings for text. Binary book/asset trees are local-only
# (see .gitignore) and intentionally NOT tracked or routed through LFS.
* text=auto
EOF

  # Stop tracking the binary trees; keep the files on disk.
  for d in "knowledge base" "coach books" "coach book source assets"; do
    git rm -r --cached --ignore-unmatch "$d" >/dev/null 2>&1 || true
  done

  # Ensure they are ignored going forward.
  for line in "knowledge base/" "coach books/" "coach book source assets/"; do
    grep -qxF "$line" .gitignore || echo "$line" >> .gitignore
  done
  echo "LFS removed; binary trees now local-only. 'git status' should be clean of phantom mods."
}

# ----------------------------------------------------------------------------
phase3_rename_folders() {
  echo "== Phase 3: rename space-containing folders =="
  declare -A MAP=(
    ["codex coach"]="codex_coach"
    ["coach books"]="coach_books"
    ["coach book source assets"]="coach_book_source_assets"
    ["knowledge base"]="knowledge_base"
  )
  for old in "${!MAP[@]}"; do
    new="${MAP[$old]}"
    [ -d "$old" ] && git mv "$old" "$new" 2>/dev/null || { [ -d "$old" ] && mv "$old" "$new"; }
  done

  echo "Updating references in tracked text files..."
  # Update plain references across docs/code/config (handles markdown links too).
  local files
  files=$(git ls-files '*.md' '*.py' '*.yaml' '*.yml' '*.json' '*.txt' AGENTS.md README.md 2>/dev/null || true)
  for old in "${!MAP[@]}"; do
    new="${MAP[$old]}"
    # shellcheck disable=SC2086
    [ -n "$files" ] && grep -rl --null "$old" $files 2>/dev/null \
      | xargs -0 -r sed -i.bak "s|$old|$new|g"
  done
  find . -name '*.bak' -not -path './.git/*' -delete
  echo "Folders renamed and references updated. Search for stragglers:"
  echo "  grep -rn 'codex coach\\|coach books\\|knowledge base\\|coach book source assets' --include='*.md' --include='*.py' ."
}

# ----------------------------------------------------------------------------
phase4_archive_plans() {
  echo "== Phase 4: split dated plans into active/ and archive/ =="
  local cc="codex_coach"; [ -d "$cc" ] || cc="codex coach"
  mkdir -p "$cc/plans/active" "$cc/plans/archive"
  # Move every dated workout/plan file into archive; you then promote the
  # current ones back into active/ by hand (only you know which are live).
  shopt -s nullglob
  for f in "$cc"/*20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]*.json "$cc"/*20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]*.md; do
    git mv "$f" "$cc/plans/archive/" 2>/dev/null || mv "$f" "$cc/plans/archive/"
  done
  echo "Dated files moved to $cc/plans/archive/. Promote live plans into plans/active/ manually,"
  echo "then update the Source Map in .agents/skills/cycling-coach/SKILL.md to the new paths."
}

# ----------------------------------------------------------------------------
phase5_commit_and_push() {
  echo "== Phase 5: commit and push =="
  git add -A
  git commit -m "Repo cleanup: strip binaries from history, fix LFS, reorg files" || echo "(nothing to commit)"
  cat <<'EOF'

History was rewritten, so a normal push will be rejected. To publish:

    git push --force-with-lease origin main

Anyone else with a clone must re-clone (their old history no longer matches).
If the push looks wrong, restore from the bundle created in Phase 0.
EOF
}

# ----------------------------------------------------------------------------
# Run phases. Comment out any you want to skip / run separately.
phase0_backup
phase1_strip_history
phase2_fix_lfs
phase3_rename_folders
phase4_archive_plans
phase5_commit_and_push

echo "Done. Review 'git log', 'git status', and 'du -sh .git' before force-pushing."
