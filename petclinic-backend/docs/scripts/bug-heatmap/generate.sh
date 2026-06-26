#!/usr/bin/env bash
# Generate the PetClinic bug-heatmap (interactive Plotly treemap + scatter).
#
# ── Reference example ─────────────────────────────────────────────────────────
# The same generators also produced the Spring Framework bug-heatmap — a much
# larger codebase, which is a great "what is this?" demo to show people:
#     file:///Users/victorrentea/workspace/spring-framework/bug-heatmap.html
# (regenerate it by pointing HEATMAP_REPO at a spring-framework checkout; swap in
#  a hosted URL once you publish it).
# ──────────────────────────────────────────────────────────────────────────────
#
# Pipeline (same generators recovered from the Spring Framework heatmap, made
# repo-agnostic via HEATMAP_* env vars):
#   compute_complexity.py  -> complexity-per-{class,file}.tsv   (tree-sitter cognitive complexity)
#   compute_fanio.py       -> fanio-per-file.tsv                (internal fan-in / fan-out)
#   build_heatmap.py       -> bug-heatmap.tsv                   (joins git history + size + above)
#   render_heatmap.py      -> bug-heatmap.html                  (self-contained Plotly page)
#
# Bug signal: PetClinic has no GitHub "type: bug" labels like Spring, but it uses
# Conventional Commits, so a commit is counted as a bug-fix when its subject matches
# ^(fix|bugfix)(:|(|!).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Code under analysis = the whole git repo (so git paths line up with the file walk);
# generated artifacts land in their own subfolder under petclinic-backend/docs/generated.
export HEATMAP_REPO="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
export HEATMAP_OUT="$(cd "$SCRIPT_DIR/../../generated" && pwd)/bug-heatmap"
export HEATMAP_PYLIBS="$SCRIPT_DIR/.pylibs"

# Exclude build outputs, IDE/agent metadata, and git worktrees
# (.claude/worktrees and .conductor hold full duplicate copies of the repo).
export HEATMAP_PRUNE="target,.claude,.conductor,node_modules,.idea,.venv,.codegraph,.serena,__pycache__,dist"

# Conventional-commit bug-fix detection.
export HEATMAP_BUG_COMMIT_REGEX='^(fix|bugfix)(\(|:|!)'

export HEATMAP_TITLE="Spring PetClinic — Bug Heatmap"

# Ctrl/⌘-click a file tile to open it in an editor (in-page picker: VS Code / IntelliJ).
# REPO_ABS defaults to HEATMAP_REPO, which is what the tsv paths are relative to.
export HEATMAP_OPEN_IN="vscode"

cd "$SCRIPT_DIR"
echo "repo:  $HEATMAP_REPO"
echo "out:   $HEATMAP_OUT"
mkdir -p "$HEATMAP_OUT"

echo "[1/4] cognitive complexity (tree-sitter)…"
python3 compute_complexity.py
echo "[2/4] fan-in / fan-out…"
python3 compute_fanio.py
echo "[3/4] join git history + size into bug-heatmap.tsv…"
python3 build_heatmap.py

# Build a data-driven subtitle, then render.
FILES=$(($(wc -l < "$HEATMAP_OUT/bug-heatmap.tsv") - 1))
COMMITS=$(git -C "$HEATMAP_REPO" rev-list --count HEAD)
BUGFIX=$(git -C "$HEATMAP_REPO" log --no-merges --pretty='%s' | grep -cE '^(fix|bugfix)(\(|:|!)' || true)
export HEATMAP_SUBTITLE="${FILES} source Java files · ${COMMITS} commits walked · ${BUGFIX} bug-fix commits (Conventional Commits 'fix:')."

echo "[4/4] render interactive HTML…"
python3 render_heatmap.py

echo "done -> $HEATMAP_OUT/bug-heatmap.html"
