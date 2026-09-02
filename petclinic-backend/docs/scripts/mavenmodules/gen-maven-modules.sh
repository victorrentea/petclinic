#!/usr/bin/env bash
# Regenerate petclinic-backend/docs/generated/MavenModules.puml — the Maven module
# dependency graph — as a PLAIN SNAPSHOT of the current graph, no diff highlighting.
# Comparing a snapshot against a previous one (e.g. at review time) is the puml-diff
# tool's job (docs/scripts/puml-diff/puml-diff-vs-git.sh).
#
# The graph itself comes from `mvn dependency:tree` run per project, restricted to
# this repo's own groupId:artifactId pairs — see maven_modules_to_puml.py's docstring
# for why that beats reading pom.xml files by eye or reaching for depgraph-maven-plugin
# (which assumes a reactor this repo doesn't have).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
# OUT defaults to the committed diagram, but can be redirected (e.g. to verify it's
# in sync without touching the work tree).
OUT="${MAVEN_MODULES_PUML_OUT:-$ROOT/petclinic-backend/docs/generated/MavenModules.puml}"

python3 "$SCRIPT_DIR/maven_modules_to_puml.py" --out "$OUT"

echo "[maven-modules] wrote $OUT" >&2
