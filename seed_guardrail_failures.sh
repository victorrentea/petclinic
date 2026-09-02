#!/usr/bin/env bash
#
# seed_guardrail_failures.sh — deliberately break every guardrail, in one forced commit.
#
# WHY: the guardrails in GUARDRAILS.md are only real if someone has watched them fire.
# This script plants a one-line defect in each guarded file and commits it with
# --no-verify, so the *next* commit+push runs head-first into the whole wall of
# guardrails and an agent (or a human) has to fix them all.
#
# Nothing is pushed. Undo with:  git reset --hard HEAD~1
#
# NOT seeded, deliberately:
#   • Spectral OpenAPI lint — runs on the *freshly extracted* openapi.yaml, so any edit
#     here is overwritten before the linter sees it; you would have to break a controller.
#   • ast-grep rules — both are `severity: warning` today, so neither blocks a commit.
#   • SonarCloud quality gate — cloud-side, only reachable by actually pushing.
#
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

MARK="GUARDRAIL-SEED"
DO_COMMIT=1
DRY_RUN=0
ONLY=""
WITH_SECRET=0
WITH_JPA=0

usage() {
  cat <<'EOF'
Usage: ./seed_guardrail_failures.sh [options]

  --list            show the seeds and exit
  --only a,b,c      plant only these seeds (ids from --list)
  --with-secret     also plant a fake GitHub PAT (trips gitleaks; lands in git history)
  --with-jpa        also add an unmapped @Entity field (trips JpaMatchesDBSchemaTest,
                    which fails the Spring context and masks every other backend test)
  --no-commit       leave the changes in the working tree, do not commit
  --dry-run         print what would change, touch nothing
  -h, --help        this text

Undo:  git reset --hard HEAD~1
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --list) LIST_ONLY=1 ;;
    --only) ONLY="$2"; shift ;;
    --with-secret) WITH_SECRET=1 ;;
    --with-jpa) WITH_JPA=1 ;;
    --no-commit) DO_COMMIT=0 ;;
    --dry-run) DRY_RUN=1; DO_COMMIT=0 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

# ── line surgery ───────────────────────────────────────────────────────────
# Each seed changes exactly ONE line, so the diff reads as a plausible human slip
# rather than a bulk rewrite. Python (not sed) because macOS sed -i is not portable
# and we need "first match only" semantics.
edit_line() { # edit_line sub|del|append FILE REGEX [REPLACEMENT]
  python3 - "$@" <<'PY'
import re, sys
op, path, pattern = sys.argv[1], sys.argv[2], sys.argv[3]
repl = (sys.argv[4] if len(sys.argv) > 4 else "").replace("\\n", "\n")
lines = open(path, encoding="utf-8").read().splitlines(keepends=True)

if op == "append":
    if not lines[-1].endswith("\n"):
        lines[-1] += "\n"
    lines.append(repl + "\n")
else:
    rx = re.compile(pattern)
    for i, line in enumerate(lines):
        if rx.search(line):
            lines[i] = repl + "\n" if op == "sub" else ""
            break
    else:
        sys.exit(f"  !! pattern not found in {path}: {pattern}")

open(path, "w", encoding="utf-8").writelines(lines)
PY
}

TOUCHED=()

seed() { # seed ID "what breaks" -- <edit_line args...>
  local id="$1" what="$2"; shift 3
  if [ -n "$ONLY" ] && ! printf '%s' ",$ONLY," | grep -q ",$id,"; then return 0; fi
  local file="$2"
  echo "  • $id — $what"
  echo "      $file"
  if [ "$DRY_RUN" -eq 0 ]; then
    edit_line "$@"
    TOUCHED+=("$file")
  fi
}

# ── The seeds ──────────────────────────────────────────────────────────────
# Tier 1: repo-wide checks. These fire at the next `git push` regardless of what is
# staged. Two different mechanisms, worth telling apart:
#   • ArchUnit assertions (packages / C3) fail the test outright;
#   • the *extractor* tests don't assert — they OVERWRITE the artifact, and pre-push's
#     "generated artifacts drifted from committed state" gate is what actually blocks.
plant_tier1() {
  seed pom-libs "pre-push list-unversioned-deps --check (ungated, fires first)" -- \
    del petclinic-backend/pom-libs.txt '^  org\.postgresql:postgresql$'

  seed openapi "pre-push drift gate (OpenApiExtractorTest rewrites openapi.yaml)" -- \
    sub openapi.yaml '^  version: "1\.0"$' "  version: \"1.0-$MARK\""

  seed api-types "pre-push api-types.ts drift (npm run build regenerates it)" -- \
    sub petclinic-frontend/src/app/generated/api-types.ts \
    '^ \* Do not make direct changes to the file\.$' \
    " * Do not make direct changes to the file. $MARK"

  # Trailing whitespace on purpose: this same line also trips editorconfig-checker
  # the moment DB.sql gets staged (DB.sql is not in .editorconfig-checker.json's excludes).
  # It also puts DB.sql in the pushed range, which is what arms the db-puml guard below.
  seed db-sql "pre-push drift gate (DbSchemaExtractorTest rewrites DB.sql) + editorconfig" -- \
    append petclinic-backend/DB.sql '' "-- $MARK: hand-edited schema snapshot   "

  seed db-puml "pre-push DB.sql↔DB.puml regenerate-and-compare guard" -- \
    sub petclinic-backend/docs/generated/DB.puml \
    '^title Database Schema \(ERD\)$' "title Database Schema (ERD) — $MARK"

  seed domain-model "pre-push drift gate (DomainModelExtractorTest rewrites the .puml)" -- \
    sub petclinic-backend/docs/generated/DomainModel.puml \
    '^title Domain Model$' "title Domain Model — $MARK"

  # Deleting an allowed edge (not adding a phantom one): ArchUnit fails on a code
  # dependency the diagram does not permit, which is the direction that actually blocks.
  seed packages-puml "PackagesArchTest — REST→Mapper dep no longer allowed by the diagram" -- \
    del petclinic-backend/docs/packages.puml '^\[REST\] --> \[Mapper\]$'

  seed c3-dsl "C3ArchTest — restLayer→mapperLayer edge missing from the C4 model" -- \
    del petclinic-backend/docs/c4model.c3.dsl '^restLayer +-> mapperLayer'
}

# Tier 2: staged-scope checks. Invisible until the fixer stages the file — which is
# exactly what they will do to fix tier 1. Deliberate: the second wave is the lesson.
plant_tier2() {
  seed spotless "Spotless (pre-commit auto-applies; CI spotless:check fails)" -- \
    sub petclinic-backend/src/main/java/victor/training/petclinic/domain/Specialty.java \
    '^    private String name;$' "            private String name;"

  seed editorconfig "editorconfig-checker — trailing whitespace, nothing auto-fixes it" -- \
    sub petclinic-frontend/src/app/error.service.ts \
    "^import \{HttpErrorResponse\} from '@angular/common/http';$" \
    "import {HttpErrorResponse} from '@angular/common/http';   "
}

# Opt-in: both have blast radius beyond a single guardrail.
plant_optional() {
  if [ "$WITH_SECRET" -eq 1 ]; then
    # A high-entropy github-pat shape: gitleaks' default rules ignore the well-known
    # AKIAIOSFODNN7EXAMPLE placeholder, so a "fake" secret has to look real to be caught.
    # Assembled from two halves — spelt out in full, this line would (correctly!) make
    # gitleaks block the very commit that adds this script.
    local pat="ghp_A7xQ2mZk9LpR4tVn8Wc"; pat="$pat""Yb3JdF6HsE1Gu0iOx"
    seed secret "gitleaks (pre-commit on re-stage + CI range scan)" -- \
      append petclinic-backend/src/main/resources/application.properties '' \
      "petclinic.github.token=$pat"
  fi
  if [ "$WITH_JPA" -eq 1 ]; then
    seed jpa "JpaMatchesDBSchemaTest — column with no Flyway migration" -- \
      sub petclinic-backend/src/main/java/victor/training/petclinic/domain/Specialty.java \
      '^    private String description;$' \
      "    private String description;\n\n    private String seededUnmappedColumn; // $MARK"
  fi
}

if [ "${LIST_ONLY:-0}" -eq 1 ]; then
  DRY_RUN=1
  WITH_SECRET=1
  WITH_JPA=1
  echo "Seeds:"
  plant_tier1; plant_tier2; plant_optional
  exit 0
fi

echo "Tier 1 — fire at the next 'git push' (repo-wide, staging-independent):"
plant_tier1
echo ""
echo "Tier 2 — fire at the next 'git commit', once the fixer stages these files:"
plant_tier2
plant_optional

if [ "$DRY_RUN" -eq 1 ]; then
  echo ""
  echo "(dry run — nothing changed)"
  exit 0
fi

if [ "${#TOUCHED[@]}" -eq 0 ]; then
  echo ""
  echo "No seeds matched --only='$ONLY' — nothing changed."
  exit 1
fi

if [ "$DO_COMMIT" -eq 0 ]; then
  echo ""
  echo "Seeded ${#TOUCHED[@]} file(s), left uncommitted (--no-commit)."
  exit 0
fi

git add -- "${TOUCHED[@]}"
git commit --no-verify --quiet -m "chore: seed guardrail failures ($MARK)

Deliberately broken, one line per guarded file, committed with --no-verify so the
hooks never saw it. The next commit+push has to repair every guardrail in
GUARDRAILS.md. Undo with: git reset --hard HEAD~1"

echo ""
echo "✅ Committed $(git rev-parse --short HEAD) with --no-verify — ${#TOUCHED[@]} file(s) broken, nothing pushed."
echo "   Next 'git push' now hits: pom-libs → guardrail tests → drift → frontend build."
echo "   Undo: git reset --hard HEAD~1"
