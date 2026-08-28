#!/usr/bin/env bash
# Guards the AGENTS.md / CLAUDE.md layout against the two ways it silently rots:
#
#   1. Someone (usually an agent) appends a rule to CLAUDE.md instead of AGENTS.md.
#      CLAUDE.md is a one-line `@AGENTS.md` import — Claude Code expands it, but no
#      other tool does, so a rule written there is invisible to Copilot and Codex.
#
#   2. Someone re-introduces a git symlink. Git for Windows only materialises
#      symlinks when core.symlinks=true (installer checkbox, OFF by default) AND
#      the user has Developer Mode or admin rights. Otherwise the clone yields a
#      plain text file containing the target path — e.g. a 9-byte AGENTS.md whose
#      entire content is "CLAUDE.md". Every agent then reads that string as its
#      complete instructions. Fails silently; nobody notices.
#
# Runs on Linux, macOS and Windows (Git Bash). Used by .githooks/pre-push and CI.
set -u

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

POINTER='@AGENTS.md'

# Tracked symlinks that are a deliberate, reviewed exception. Anything not listed
# here fails the check.
ALLOWED_SYMLINKS=(
  # Copilot CLI reads .github/skills, Claude Code reads .claude/skills, and neither
  # can be pointed elsewhere by config. A symlink is the only way to serve one copy
  # to both. Consequence on Windows: this arrives as a 17-byte text file and Copilot
  # CLI finds no skills there. Claude Code is unaffected (it reads the real dir).
  '.github/skills'
)

fail=0
err() { echo "[agents-md] ❌ $*"; fail=1; }

# ── 1. No tracked symlinks outside the allowlist ────────────────────────────
while read -r mode _ _ path; do
  [ "$mode" = "120000" ] || continue
  allowed=0
  for a in "${ALLOWED_SYMLINKS[@]}"; do
    [ "$path" = "$a" ] && allowed=1 && break
  done
  if [ "$allowed" -eq 0 ]; then
    err "'$path' is committed as a git symlink (mode 120000)."
    echo "[agents-md]    On Windows this checks out as a text file containing its target path."
    echo "[agents-md]    Replace it with a real file, or add it to ALLOWED_SYMLINKS in $0."
  fi
done < <(git ls-files -s)

# ── 2. Every CLAUDE.md is a pointer; its AGENTS.md sibling holds the content ─
found=0
while read -r f; do
  [ "$(basename "$f")" = "CLAUDE.md" ] || continue
  case "$f" in .claude/*) continue ;; esac
  found=$((found + 1))
  dir="$(dirname "$f")"
  [ "$dir" = "." ] && dir=""
  agents="${dir:+$dir/}AGENTS.md"

  content="$(tr -d '\r' < "$f" | sed '/^[[:space:]]*$/d')"
  if [ "$content" != "$POINTER" ]; then
    err "'$f' must contain exactly one line: $POINTER"
    echo "[agents-md]    It holds $(wc -l <"$f" | tr -d ' ') lines instead. Project rules belong in '$agents';"
    echo "[agents-md]    CLAUDE.md is only the import that makes Claude Code pick them up."
    continue
  fi

  if [ ! -f "$agents" ]; then
    err "'$f' imports '$agents', which does not exist."
    continue
  fi
  if [ -L "$agents" ]; then
    err "'$agents' is a symlink — see reason 2 above."
    continue
  fi
  bytes=$(wc -c <"$agents" | tr -d ' ')
  if [ "$bytes" -lt 200 ]; then
    err "'$agents' is only ${bytes} bytes — it looks like a leftover symlink stub, not real instructions."
  fi
done < <(git ls-files)

[ "$found" -eq 0 ] && err "No CLAUDE.md found — the Claude Code import is missing entirely."

if [ "$fail" -eq 0 ]; then
  echo "[agents-md] ✓ AGENTS.md is the source of truth in $found location(s); no stray symlinks."
fi
exit "$fail"
