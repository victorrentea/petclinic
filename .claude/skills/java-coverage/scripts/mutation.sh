#!/usr/bin/env bash
# Mutation testing, reporting only the mutants the tests failed to kill.
# Line coverage says a line ran; a survived mutant says nothing asserted on it.
#
# Self-contained: PIT is NOT declared in pom.xml. This script resolves the PIT
# jars into ~/.m2 from a throwaway POM and invokes PIT's command-line entry
# point against the module's own compiled classes. Nothing in the project has to
# change, and `mvn test` / CI never pay for mutation testing.
#
# PIT is slow — always scope it. `mutation.sh rest.error` beats `mutation.sh`.
set -euo pipefail

PITEST_VERSION="${PITEST_VERSION:-1.20.0}"
PITEST_JUNIT5_VERSION="${PITEST_JUNIT5_VERSION:-1.2.3}"

usage() {
  cat <<'EOF'
mutation.sh [options] [SCOPE]

  SCOPE   What to mutate. Accepted forms, all resolved against the base package:
            rest.error                 a package (and its subpackages)
            OwnerMapper                a simple class name, found anywhere
            victor.training.petclinic.rest.*   an explicit glob
          Omitted = the whole base package. That takes minutes; scope it.

Options
  -t, --tests GLOB      Tests allowed to kill the mutants
                        (default: the same glob as SCOPE, so a package is
                        judged by its own tests)
  -T, --all-tests       Let the entire test suite kill them. Truer score,
                        much slower.
  -j, --threads N       PIT threads (default: cores - 2)
      --timeout MS      Per-test timeout constant (default: PIT's 4000)
      --mutators SET    DEFAULT | STRONGER | ALL (default: DEFAULT)
  -m, --max N           Show at most N files (default 40; 0 = all)
      --no-compile      Skip `mvn test-compile`; reuse target/ as-is
      --no-coverage     Do not also print the JaCoCo line gaps for the scope
      --html            Open the PIT report at the end
  -h, --help            This

Module: petclinic-backend. Writes target/pit-reports/{index.html,mutations.xml}.
Override the PIT versions with PITEST_VERSION / PITEST_JUNIT5_VERSION.
EOF
}

BASE_PKG="victor.training.petclinic"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../../.." && pwd)"
MODULE="$ROOT/petclinic-backend"

SCOPE=""; TESTS=""; ALL_TESTS=0; THREADS=""; TIMEOUT=""; MUTATORS=""
MAX=40; COMPILE=1; WITH_COVERAGE=1; OPEN_HTML=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--tests)      TESTS="$2"; shift ;;
    -T|--all-tests)  ALL_TESTS=1 ;;
    -j|--threads)    THREADS="$2"; shift ;;
    --timeout)       TIMEOUT="$2"; shift ;;
    --mutators)      MUTATORS="$2"; shift ;;
    -m|--max)        MAX="$2"; shift ;;
    --no-compile)    COMPILE=0 ;;
    --no-coverage)   WITH_COVERAGE=0 ;;
    --html)          OPEN_HTML=1 ;;
    -h|--help)       usage; exit 0 ;;
    -*)              echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
    *)               SCOPE="$1" ;;
  esac
  shift
done

[[ -f "$MODULE/pom.xml" ]] || { echo "cannot find $MODULE/pom.xml" >&2; exit 2; }

# ---- resolve SCOPE into a targetClasses glob --------------------------------
resolve_scope() {
  local s="$1"
  if [[ -z "$s" ]]; then
    echo "$BASE_PKG.*"; return
  fi
  if [[ "$s" == *"*"* ]]; then           # already a glob
    echo "$s"; return
  fi
  if [[ "$s" == "$BASE_PKG"* ]]; then    # fully qualified
    if [[ -d "$MODULE/src/main/java/${s//.//}" ]]; then echo "$s.*"; else echo "$s"; fi
    return
  fi
  if [[ -d "$MODULE/src/main/java/${BASE_PKG//.//}/${s//.//}" ]]; then
    echo "$BASE_PKG.$s.*"; return        # package relative to base
  fi
  local found                            # simple class name -> find it
  found=$(find "$MODULE/src/main/java" -name "$s.java" | head -1)
  if [[ -n "$found" ]]; then
    local rel="${found#"$MODULE"/src/main/java/}"
    echo "${rel%.java}" | tr '/' '.'
    return
  fi
  echo "Cannot resolve scope '$s' to a class or package under $BASE_PKG" >&2
  exit 2
}

TARGET_CLASSES="$(resolve_scope "$SCOPE")"

if [[ $ALL_TESTS -eq 1 ]]; then
  TARGET_TESTS="$BASE_PKG.*"
elif [[ -n "$TESTS" ]]; then
  TARGET_TESTS="$TESTS"
elif [[ "$TARGET_CLASSES" == *".*" ]]; then
  TARGET_TESTS="$TARGET_CLASSES"                       # package: its own tests
else
  TARGET_TESTS="${TARGET_CLASSES%.*}.*"                # class: its package's tests
fi

[[ -z "$THREADS" ]] && THREADS="$(( $(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4) - 2 ))"
[[ "$THREADS" -lt 1 ]] && THREADS=1

if [[ "$TARGET_CLASSES" == "$BASE_PKG.*" ]]; then
  echo "NOTE: mutating the whole $BASE_PKG — this takes minutes." >&2
  echo "      Scope it next time: mutation.sh rest.error" >&2
fi

WORK="$MODULE/target/pit-work"
mkdir -p "$WORK"

# ---- the IDE must not be compiling into the same target/ --------------------
if pgrep -f 'JUnit|JavaTestAgent|idea_rt.jar' >/dev/null 2>&1; then
  echo "WARNING: a JetBrains test runner looks active; it writes the same" >&2
  echo "         $MODULE/target/classes and will corrupt this run." >&2
fi

# ---- bring PIT in, without touching the project pom -------------------------
PIT_CP_FILE="$WORK/pit-classpath-$PITEST_VERSION-$PITEST_JUNIT5_VERSION.txt"
if [[ ! -s "$PIT_CP_FILE" ]]; then
  echo "==> resolving PIT $PITEST_VERSION (junit5 plugin $PITEST_JUNIT5_VERSION)"
  cat > "$WORK/pit-pom.xml" <<EOF
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>local.pit</groupId>
    <artifactId>pit-runner</artifactId>
    <version>1.0</version>
    <dependencies>
        <dependency>
            <groupId>org.pitest</groupId>
            <artifactId>pitest-command-line</artifactId>
            <version>$PITEST_VERSION</version>
        </dependency>
        <dependency>
            <groupId>org.pitest</groupId>
            <artifactId>pitest-junit5-plugin</artifactId>
            <version>$PITEST_JUNIT5_VERSION</version>
        </dependency>
    </dependencies>
</project>
EOF
  if ! mvn -q -f "$WORK/pit-pom.xml" dependency:build-classpath \
        "-Dmdep.outputFile=$PIT_CP_FILE" > "$WORK/pit-resolve.log" 2>&1; then
    echo "Could not resolve PIT. Tail of $WORK/pit-resolve.log:" >&2
    tail -20 "$WORK/pit-resolve.log" >&2
    exit 1
  fi
fi

# ---- the module's own classpath ---------------------------------------------
APP_CP_FILE="$WORK/app-classpath.txt"
if [[ $COMPILE -eq 1 ]]; then
  echo "==> mvn test-compile"
  if ! (cd "$MODULE" && mvn -q test-compile > "$WORK/compile.log" 2>&1); then
    echo "Compilation failed. Tail of $WORK/compile.log:" >&2
    tail -30 "$WORK/compile.log" >&2
    exit 1
  fi
fi
if [[ ! -s "$APP_CP_FILE" || $COMPILE -eq 1 ]]; then
  (cd "$MODULE" && mvn -q dependency:build-classpath \
      "-Dmdep.outputFile=$APP_CP_FILE" -Dmdep.includeScope=test \
      > "$WORK/cp.log" 2>&1) || { tail -20 "$WORK/cp.log" >&2; exit 1; }
fi

CP="$MODULE/target/classes:$MODULE/target/test-classes:$(cat "$APP_CP_FILE")"
PIT_CP="$(cat "$PIT_CP_FILE")"
REPORT_DIR="$MODULE/target/pit-reports"
rm -rf "$REPORT_DIR"

PIT_OPTS=(
  --reportDir "$REPORT_DIR"
  --targetClasses "$TARGET_CLASSES"
  --targetTests "$TARGET_TESTS"
  --sourceDirs "$MODULE/src/main/java"
  --classPath "$CP"
  --outputFormats XML,HTML
  --timestampedReports false
  --threads "$THREADS"
  --testPlugin junit5
)
[[ -n "$TIMEOUT"  ]] && PIT_OPTS+=(--timeoutConst "$TIMEOUT")
[[ -n "$MUTATORS" ]] && PIT_OPTS+=(--mutators "$MUTATORS")

echo "==> mutating $TARGET_CLASSES   (killers: $TARGET_TESTS, $THREADS threads)"
LOG="$WORK/mutation-run.log"
if ! java -cp "$PIT_CP:$CP" org.pitest.mutationtest.commandline.MutationCoverageReport \
      "${PIT_OPTS[@]}" > "$LOG" 2>&1; then
  echo "PIT failed. Tail of $LOG:" >&2
  tail -30 "$LOG" >&2
  exit 1
fi

XML="$REPORT_DIR/mutations.xml"
[[ -f "$XML" ]] || { echo "no $XML produced; see $LOG" >&2; exit 1; }

# ---- report what survived ----------------------------------------------------
export XML MODULE MAX
python3 <<'PY'
import os
import collections
import xml.etree.ElementTree as ET

xml    = os.environ['XML']
module = os.environ['MODULE']
max_n  = int(os.environ['MAX'])

muts      = ET.parse(xml).getroot().findall('mutation')
by_status = collections.Counter(m.get('status') for m in muts)
killed    = by_status['KILLED'] + by_status['TIMED_OUT']
total     = len(muts)
survived  = [m for m in muts if m.get('status') == 'SURVIVED']
nocover   = [m for m in muts if m.get('status') == 'NO_COVERAGE']


def text(m, tag):
    e = m.find(tag)
    return e.text if e is not None and e.text else ''


def src_path(m):
    cls = text(m, 'mutatedClass').split('$')[0]
    pkg = cls.rsplit('.', 1)[0].replace('.', '/')
    rel = f"src/main/java/{pkg}/{text(m, 'sourceFile')}"
    return rel if os.path.exists(os.path.join(module, rel)) else text(m, 'sourceFile')


score = 100.0 * killed / total if total else 0.0
# test strength ignores mutants on lines no test touches at all
reachable = total - len(nocover)
strength = 100.0 * killed / reachable if reachable else 0.0

print()
print(f'MUTATION  {score:.0f}% killed ({killed}/{total})   '
      f'test strength {strength:.0f}%   '
      f'{len(survived)} survived, {len(nocover)} never reached')
print()

groups = collections.defaultdict(list)
for m in survived + nocover:
    groups[src_path(m)].append(m)

ordered = sorted(groups.items(), key=lambda kv: (-len(kv[1]), kv[0]))
shown = ordered if max_n == 0 else ordered[:max_n]

if not ordered:
    print('No surviving mutants. Every mutation the tests reached, they caught.')
else:
    print('NOT KILLED (assertions missing here)')
    print()
    for path, items in shown:
        print(f'  {path}   {len(items)} not killed')
        seen = set()
        for m in sorted(items, key=lambda x: int(text(x, 'lineNumber'))):
            line = text(m, 'lineNumber')
            desc = text(m, 'description')
            meth = text(m, 'mutatedMethod')
            tag = 'NEVER REACHED' if m.get('status') == 'NO_COVERAGE' else ''
            key = (line, desc)
            if key in seen:
                continue
            seen.add(key)
            print(f'    {path}:{line}  {meth}() — {desc} {tag}'.rstrip())
        print()
    if max_n and len(ordered) > max_n:
        print(f'  ... {len(ordered) - max_n} more files (-m 0 for all)')
PY

if [[ $WITH_COVERAGE -eq 1 && -f "$MODULE/target/site/jacoco/jacoco.xml" ]]; then
  echo "--- line coverage for the same scope (existing JaCoCo report) ---"
  FILTER="${TARGET_CLASSES%.\*}"
  "$HERE/coverage.sh" -n -c "$FILTER" "$MODULE" 2>/dev/null \
    | sed -n -E '/UNCOVERED|No uncovered/,$p' | grep -v '^html:' || true
fi

echo
echo "html: $REPORT_DIR/index.html"
[[ $OPEN_HTML -eq 1 ]] && { command -v open >/dev/null && open "$REPORT_DIR/index.html"; }
exit 0
