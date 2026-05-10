#!/usr/bin/env bash
# Stop hook: nudges the agent if JaCoCo line coverage dropped vs the baseline.
# - Silent if no jacoco.csv yet (first-run / fresh clone).
# - Nudge to run tests if .java sources are newer than jacoco.csv (stale data).
# - Ratchets the baseline up on improvement; blocks Stop on regression.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND="$REPO_ROOT/petclinic-backend"
JACOCO_CSV="$BACKEND/target/site/jacoco/jacoco.csv"
BASELINE="$BACKEND/.coverage-baseline"

[[ -f "$JACOCO_CSV" ]] || exit 0

if [[ -n "$(find "$BACKEND/src" -name '*.java' -newer "$JACOCO_CSV" -print -quit 2>/dev/null)" ]]; then
    cat <<'JSON'
{"decision":"block","reason":"JaCoCo coverage data is stale: .java sources were edited since the last test run. Run `cd petclinic-backend && ./mvnw test` to refresh coverage, then stop. (If you intentionally don't want to verify coverage this turn, say so and I will let you stop.)"}
JSON
    exit 0
fi

read -r MISSED COVERED <<<"$(awk -F, 'NR>1 {m+=$8; c+=$9} END {print m+0, c+0}' "$JACOCO_CSV")"
TOTAL=$((MISSED + COVERED))
[[ $TOTAL -gt 0 ]] || exit 0

CURRENT=$(awk "BEGIN {printf \"%.6f\", $COVERED/$TOTAL}")

if [[ ! -f "$BASELINE" ]]; then
    echo "$CURRENT" >"$BASELINE"
    exit 0
fi

PREVIOUS=$(<"$BASELINE")

if awk "BEGIN {exit !($CURRENT >= $PREVIOUS)}"; then
    echo "$CURRENT" >"$BASELINE"
    exit 0
fi

PREV_PCT=$(awk "BEGIN {printf \"%.2f\", $PREVIOUS*100}")
CUR_PCT=$(awk "BEGIN {printf \"%.2f\", $CURRENT*100}")
DELTA_PP=$(awk "BEGIN {printf \"%.2f\", ($PREVIOUS-$CURRENT)*100}")

cat <<JSON
{"decision":"block","reason":"JaCoCo line coverage dropped from ${PREV_PCT}% to ${CUR_PCT}% (-${DELTA_PP}pp; ${MISSED} lines missed). Add tests to bring it back up before stopping. If the drop is intentional, edit petclinic-backend/.coverage-baseline to ${CURRENT}."}
JSON