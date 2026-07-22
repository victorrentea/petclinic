#!/usr/bin/env bash
#
# ralph-openspec.sh — a chapter-by-chapter Ralph Loop over OpenSpec changes.
#
# Outer loop : every change under openspec/changes/ that still has unchecked
#              tasks (skips archive/). Sorted, run one at a time.
# Inner loop : each "## N. ..." section of that change's tasks.md, in order.
#              ONE section == ONE Ralph iteration (fresh agent context).
#
# Per chapter: prompt -> `claude -p` -> did its boxes get checked?
#              -> run the layer's tests -> green: commit & next
#                                       -> red / unchecked: re-invoke same
#                                          chapter (max RALPH_MAX_ATTEMPTS),
#                                          then stop the loop with a log.
#
# The tasks.md checkboxes ARE the durable state across iterations: the agent
# forgets, the file remembers. That is the whole trick.
#
# Usage:
#   ./ralph-openspec.sh run            # implement all pending changes, chapter by chapter
#   ./ralph-openspec.sh plan           # print the chapter breakdown, run nothing
#   ./ralph-openspec.sh reset <change> # uncheck every task (and optionally revert code) to re-demo
#
set -uo pipefail

# ----------------------------------------------------------------------------- config
CHANGES_DIR="openspec/changes"
LOG_DIR=".ralph"
MAX_ATTEMPTS="${RALPH_MAX_ATTEMPTS:-3}"   # retries per chapter before giving up
MAX_TURNS="${RALPH_MAX_TURNS:-60}"        # agent turn cap per invocation (runaway guard)
MODEL="${RALPH_MODEL:-}"                   # empty => claude's default model
PUSH="${RALPH_PUSH:-0}"                    # 1 => git push after each green chapter
DRY_RUN="${RALPH_DRY_RUN:-0}"              # 1 => print the prompt, never call claude
BASELINE_REF="${RALPH_BASELINE:-}"         # used only by `reset` to revert feature code

# Verification commands per layer. Adjust to this project's real headless test cmd.
VERIFY_BACKEND="${RALPH_VERIFY_BACKEND:-cd petclinic-backend && mvn -q -B test}"
VERIFY_FRONTEND="${RALPH_VERIFY_FRONTEND:-cd petclinic-frontend && npm run test-headless}"

# ----------------------------------------------------------------------------- helpers
c_blue=$'\033[1;36m'; c_grn=$'\033[1;32m'; c_red=$'\033[1;31m'; c_yel=$'\033[1;33m'; c_off=$'\033[0m'
log()  { printf '%s[ralph]%s %s\n' "$c_blue" "$c_off" "$*"; }
ok()   { printf '%s[ralph]%s %s%s%s\n' "$c_blue" "$c_off" "$c_grn" "$*" "$c_off"; }
warn() { printf '%s[ralph]%s %s%s%s\n' "$c_blue" "$c_off" "$c_yel" "$*" "$c_off"; }
err()  { printf '%s[ralph]%s %s%s%s\n' "$c_blue" "$c_off" "$c_red" "$*" "$c_off"; }

# changes with at least one unchecked task, excluding archive/
pending_changes() {
  local d name
  for d in "$CHANGES_DIR"/*/; do
    name="$(basename "$d")"
    [ "$name" = "archive" ] && continue
    [ -f "$d/tasks.md" ] || continue
    grep -q '^- \[ \]' "$d/tasks.md" && echo "$name"
  done | sort
}

# total number of "## " chapters in a tasks file
chapter_count() { awk '/^## /{c++} END{print c+0}' "$1"; }

# heading text of the Nth chapter (1-based), e.g. "## 1. Backend — Repository"
chapter_heading() { awk -v want="$2" '/^## /{c++; if(c==want){print; exit}}' "$1"; }

# raw markdown block of the Nth chapter (heading line through just before the next "## ")
chapter_block() {
  awk -v want="$2" '/^## /{c++} c==want{print} c==want+1{exit}' "$1"
}

# count of still-unchecked tasks "- [ ]" inside the Nth chapter
chapter_pending_count() { chapter_block "$1" "$2" | grep -c '^- \[ \]' || true; }

# map a chapter heading to a verification layer
layer_of() {
  case "$1" in
    *Backend*|*backend*)   echo backend  ;;
    *Frontend*|*frontend*) echo frontend ;;
    *)                     echo unknown  ;;
  esac
}

# run the layer's test suite, capturing output for retry feedback. returns its exit code.
verify_layer() {
  local layer="$1" cmd=""
  case "$layer" in
    backend)  cmd="$VERIFY_BACKEND"  ;;
    frontend) cmd="$VERIFY_FRONTEND" ;;
    *) warn "  no verify command for layer '$layer' — skipping gate"; return 0 ;;
  esac
  log "  verifying ($layer): $cmd"
  ( eval "$cmd" ) >"$LOG_DIR/last-verify.log" 2>&1
}

# build the single-chapter prompt fed to `claude -p`
build_prompt() {
  local change="$1" idx="$2" heading="$3" tasks="$4" attempt="$5"
  local dir="$CHANGES_DIR/$change"
  cat <<EOF
You are ONE iteration of a Ralph Loop implementing an OpenSpec change.

CHANGE:  $change   (folder: $dir)
CHAPTER: $heading

Your ONLY job this iteration is to implement the tasks under THIS chapter.
Do not start, touch, or check off tasks from any other chapter.

Tasks in this chapter:
$(chapter_block "$tasks" "$idx")

You MAY read these for context (do not implement beyond this chapter):
  - $dir/proposal.md   (why)
  - $dir/design.md     (how)
  - $dir/specs/        (what)
  - $dir/tasks.md      (full task list, for orientation only)
  - CLAUDE.md          (repo rules — follow them, incl. red-green TDD when this chapter has a test task)

Rules:
  - Implement ONLY this chapter's tasks. Keep diffs minimal and idiomatic.
  - As each task is done, edit $dir/tasks.md changing that task's "- [ ]" to "- [x]"
    (only tasks belonging to THIS chapter).
  - Do NOT run git commit — the loop harness commits after it verifies the tests pass.
  - When this chapter's tasks are implemented and checked off, stop.
EOF
  if [ "$attempt" -gt 1 ] && [ -f "$LOG_DIR/last-verify.log" ]; then
    cat <<EOF

A PREVIOUS ATTEMPT AT THIS CHAPTER FAILED VERIFICATION.
Fix it. Tail of the failing test output:
---
$(tail -n 40 "$LOG_DIR/last-verify.log")
---
EOF
  fi
}

# invoke the coding agent with a fresh context
invoke_agent() {
  local prompt="$1"
  local args=(-p "$prompt" --automode --max-turns "$MAX_TURNS" --output-format text)
  [ -n "$MODEL" ] && args+=(--model "$MODEL")
  claude "${args[@]}" 2>&1 | tee -a "$LOG_DIR/agent.log"
}

# implement one chapter, with verify + retry. returns non-zero if it never goes green.
run_chapter() {
  local change="$1" idx="$2"
  local tasks="$CHANGES_DIR/$change/tasks.md"
  local heading layer attempt pending
  heading="$(chapter_heading "$tasks" "$idx")"
  layer="$(layer_of "$heading")"
  log "▶ ${heading}  (layer: $layer)"

  for ((attempt=1; attempt<=MAX_ATTEMPTS; attempt++)); do
    pending="$(chapter_pending_count "$tasks" "$idx")"
    log "  attempt $attempt/$MAX_ATTEMPTS — $pending task(s) pending"

    if [ "$DRY_RUN" = "1" ]; then
      echo "----- PROMPT (dry-run) -----"
      build_prompt "$change" "$idx" "$heading" "$tasks" "$attempt"
      echo "----------------------------"
      return 0
    fi

    invoke_agent "$(build_prompt "$change" "$idx" "$heading" "$tasks" "$attempt")"

    # completion gate: did the agent check off every box in this chapter?
    pending="$(chapter_pending_count "$tasks" "$idx")"
    if [ "$pending" != "0" ]; then
      warn "  ✗ $pending task(s) still unchecked — retrying chapter"
      continue
    fi

    # correctness gate: do the layer's tests pass?
    if verify_layer "$layer"; then
      git add -A
      git commit -q -m "ralph($change): ${heading#\#\# }"
      ok "  ✓ chapter green & committed"
      [ "$PUSH" = "1" ] && { git push -q && log "  pushed"; }
      return 0
    else
      warn "  ✗ tests red — retrying chapter (see $LOG_DIR/last-verify.log)"
    fi
  done

  err "  ⚠ chapter failed after $MAX_ATTEMPTS attempts — stopping the loop"
  return 1
}

print_plan() {
  local change="$1"
  local tasks="$CHANGES_DIR/$change/tasks.md"
  local n i heading pend
  n="$(chapter_count "$tasks")"
  log "═══ $change — $n chapter(s) ═══"
  for ((i=1; i<=n; i++)); do
    heading="$(chapter_heading "$tasks" "$i")"
    pend="$(chapter_pending_count "$tasks" "$i")"
    if [ "$pend" = "0" ]; then printf '   %2d. [done] %s\n' "$i" "${heading#\#\# }"
    else                       printf '   %2d. [%2d ] %s  (layer: %s)\n' "$i" "$pend" "${heading#\#\# }" "$(layer_of "$heading")"
    fi
  done
}

reset_change() {
  local change="${1:?usage: $0 reset <change>}"
  local tasks="$CHANGES_DIR/$change/tasks.md"
  [ -f "$tasks" ] || { err "no such change: $change"; exit 1; }
  perl -i -pe 's/^- \[x\]/- [ ]/' "$tasks"
  ok "unchecked every task in $tasks"
  if [ -n "$BASELINE_REF" ]; then
    log "reverting feature files to $BASELINE_REF (RALPH_BASELINE)…"
    git diff --name-only "$BASELINE_REF"..HEAD -- petclinic-backend petclinic-frontend \
      | while read -r f; do git checkout "$BASELINE_REF" -- "$f" 2>/dev/null || true; done
    ok "feature code reverted — ready to re-demo"
  else
    warn "set RALPH_BASELINE=<commit-before-feature> to also revert the implementation code"
  fi
}

# ----------------------------------------------------------------------------- main
main() {
  mkdir -p "$LOG_DIR"
  local mode="${1:-run}"; shift || true
  case "$mode" in
    plan)
      local ch; local any=0
      for ch in $(pending_changes); do print_plan "$ch"; any=1; done
      [ "$any" = "0" ] && ok "no pending changes — all complete 🎉"
      ;;
    reset)
      reset_change "${1:-}"
      ;;
    run)
      local changes; changes="$(pending_changes)"
      [ -z "$changes" ] && { ok "no pending changes — all complete 🎉"; exit 0; }
      local change tasks n i pend
      for change in $changes; do
        log "═══════════ CHANGE: $change ═══════════"
        tasks="$CHANGES_DIR/$change/tasks.md"
        n="$(chapter_count "$tasks")"
        for ((i=1; i<=n; i++)); do
          pend="$(chapter_pending_count "$tasks" "$i")"
          [ "$pend" = "0" ] && { log "▷ chapter $i already done — skip"; continue; }
          run_chapter "$change" "$i" || { err "loop stopped inside $change"; exit 1; }
        done
        ok "✓ change complete: $change"
        # to auto-finalize: openspec archive "$change" --yes
      done
      ok "🎉 all pending changes implemented"
      ;;
    *)
      echo "usage: $0 {run|plan|reset <change>}"; exit 2
      ;;
  esac
}
main "$@"
