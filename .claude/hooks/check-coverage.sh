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
{"decision":"block","reason":"event:jacoco_stale\ncause:java_sources_newer_than_jacoco_csv\nfix:cd petclinic-backend && ./mvnw test\nopt_out:say_skip_coverage_this_turn"}
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
{"decision":"block","reason":"event:jacoco_drop\nprev:${PREV_PCT}%\ncurr:${CUR_PCT}%\ndelta:-${DELTA_PP}pp\nmissed:${MISSED}\nfix:add_tests|set petclinic-backend/.coverage-baseline=${CURRENT}"}
JSON