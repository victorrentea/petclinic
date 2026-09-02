#!/usr/bin/env bash
# Java/Maven test coverage from the terminal, reporting only the uncovered lines.
# Wraps JaCoCo: runs the tests, then reduces target/site/jacoco/jacoco.xml to
# clickable `src/main/java/.../File.java:12-15,20` gap refs.
set -euo pipefail

usage() {
  cat <<'EOF'
coverage.sh [options] [module-dir]

  module-dir            Maven module to measure (default: cwd, or the single
                        child module that has a src/main/java)

Running
  -n, --no-run          Reuse the existing jacoco.exec / jacoco.xml, skip `mvn test`
  -f, --force-run       Re-run the tests even if a fresh report exists
  -t, --test PATTERN    Pass through as -Dtest=PATTERN (marks the run PARTIAL)
  -o, --offline         Run maven with -o

Reporting
  -c, --class SUBSTR    Only classes whose fully-qualified name contains SUBSTR
                        (repeatable)
  -m, --max N           Show at most N classes, worst first (default 20; 0 = all)
  -b, --branches        Also list lines with partially-covered branches
  -a, --all             Include classes that are 100% covered
  -q, --quiet           Totals only, no per-class gaps
      --keep-generated  Do not filter out generated/boilerplate classes
      --csv             Also print the jacoco.csv path
      --html            Open target/site/jacoco/index.html at the end
  -h, --help            This

Exit code is 0 unless the tests fail.
EOF
}

MODULE=""; RUN=auto; TESTPAT=""; MVN_FLAGS=(); FILTERS=(); MAX=20
SHOW_BRANCHES=0; SHOW_ALL=0; QUIET=0; SKIP_GENERATED=1; SHOW_CSV=0; OPEN_HTML=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|--no-run)         RUN=never ;;
    -f|--force-run)      RUN=always ;;
    -t|--test)           TESTPAT="$2"; shift ;;
    -o|--offline)        MVN_FLAGS+=(-o) ;;
    -c|--class)          FILTERS+=("$2"); shift ;;
    -m|--max)            MAX="$2"; shift ;;
    -b|--branches)       SHOW_BRANCHES=1 ;;
    -a|--all)            SHOW_ALL=1 ;;
    -q|--quiet)          QUIET=1 ;;
    --keep-generated)    SKIP_GENERATED=0 ;;
    --csv)               SHOW_CSV=1 ;;
    --html)              OPEN_HTML=1 ;;
    -h|--help)           usage; exit 0 ;;
    -*)                  echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
    *)                   MODULE="$1" ;;
  esac
  shift
done

# ---- locate the maven module -------------------------------------------------
if [[ -z "$MODULE" ]]; then
  if [[ -d src/main/java ]]; then
    MODULE="$PWD"
  else
    # exactly one child module with sources -> use it, otherwise make the user say
    # (no mapfile: macOS ships bash 3.2)
    CANDIDATES=()
    while IFS= read -r d; do
      [[ -n "$d" ]] && CANDIDATES+=("$d")
    done < <(find . -maxdepth 2 -name pom.xml -not -path './target/*' \
      -exec dirname {} \; | while read -r p; do [[ -d "$p/src/main/java" ]] && echo "$p"; done)
    # narrow to modules that actually measure coverage
    JACOCO=()
    for d in "${CANDIDATES[@]+"${CANDIDATES[@]}"}"; do
      grep -q jacoco "$d/pom.xml" 2>/dev/null && JACOCO+=("$d")
    done
    [[ ${#JACOCO[@]} -ge 1 ]] && CANDIDATES=("${JACOCO[@]}")

    if [[ ${#CANDIDATES[@]} -eq 1 ]]; then
      MODULE="${CANDIDATES[0]}"
    else
      echo "Cannot tell which module to measure; pass one explicitly." >&2
      printf '  %s\n' "${CANDIDATES[@]:-<none found>}" >&2
      exit 2
    fi
  fi
fi
MODULE="$(cd "$MODULE" && pwd)"
[[ -f "$MODULE/pom.xml" ]] || { echo "no pom.xml in $MODULE" >&2; exit 2; }

XML="$MODULE/target/site/jacoco/jacoco.xml"
CSV="$MODULE/target/site/jacoco/jacoco.csv"
HTML="$MODULE/target/site/jacoco/index.html"

# ---- guard: the IDE must not be compiling into the same target/ --------------
if [[ "$RUN" != never ]] && pgrep -f 'JUnit|JavaTestAgent|idea_rt.jar' >/dev/null 2>&1; then
  echo "WARNING: a JetBrains test runner looks active. It writes the same" >&2
  echo "         $MODULE/target/classes and will corrupt this run." >&2
  echo "         Wait for it to finish, or re-run with -n." >&2
fi

# ---- run the tests -----------------------------------------------------------
PARTIAL=""
[[ -n "$TESTPAT" ]] && PARTIAL=" PARTIAL (-Dtest=$TESTPAT: unloaded classes read as 0%)"

need_run=0
case "$RUN" in
  always) need_run=1 ;;
  never)  need_run=0 ;;
  auto)   [[ -f "$XML" ]] || need_run=1 ;;
esac

if [[ $need_run -eq 1 ]]; then
  echo "==> mvn test in $MODULE${TESTPAT:+ (-Dtest=$TESTPAT)}"
  MVN_ARGS=(test "${MVN_FLAGS[@]+"${MVN_FLAGS[@]}"}")
  [[ -n "$TESTPAT" ]] && MVN_ARGS+=("-Dtest=$TESTPAT" -DfailIfNoSpecifiedTests=false)
  if ! (cd "$MODULE" && mvn "${MVN_ARGS[@]}" > "$MODULE/target/coverage-run.log" 2>&1); then
    echo "Tests FAILED. Failures below; coverage numbers are unreliable." >&2
    grep -E '^\[ERROR\].*(Tests run|<<<)' "$MODULE/target/coverage-run.log" | head -40 >&2 || true
    echo "Full log: $MODULE/target/coverage-run.log" >&2
    exit 1
  fi
  grep -E '^\[(INFO|WARNING)\] Tests run: .*, Time elapsed' "$MODULE/target/coverage-run.log" \
    | awk '{t+=$4; f+=$6; e+=$8; s+=$10} END {printf "    %d tests, %d failures, %d errors, %d skipped\n", t, f, e, s}' \
    || true
fi

[[ -f "$XML" ]] || {
  echo "No $XML." >&2
  echo "Is the jacoco-maven-plugin wired in pom.xml (prepare-agent + report)?" >&2
  echo "Ad-hoc alternative:" >&2
  echo "  mvn org.jacoco:jacoco-maven-plugin:prepare-agent test org.jacoco:jacoco-maven-plugin:report" >&2
  exit 2
}

# ---- reduce the XML to gaps --------------------------------------------------
FILTERS_JOINED="$(IFS=$'\n'; echo "${FILTERS[*]:-}")"
export XML MODULE MAX SHOW_BRANCHES SHOW_ALL QUIET SKIP_GENERATED PARTIAL FILTERS_JOINED

python3 <<'PY'
import os, re, sys
import xml.etree.ElementTree as ET

xml      = os.environ['XML']
module   = os.environ['MODULE']
max_n    = int(os.environ['MAX'])
branches = os.environ['SHOW_BRANCHES'] == '1'
show_all = os.environ['SHOW_ALL'] == '1'
quiet    = os.environ['QUIET'] == '1'
skip_gen = os.environ['SKIP_GENERATED'] == '1'
partial  = os.environ['PARTIAL']
filters  = [f for f in os.environ['FILTERS_JOINED'].split('\n') if f]

root = ET.parse(xml).getroot()

def pct(missed, covered):
    total = missed + covered
    return 100.0 * covered / total if total else None

def fmt(p):
    return f'{p:5.1f}%' if p is not None else '    -'

def ranges(nums):
    """[3,4,5,9] -> '3-5,9'"""
    out, start, prev = [], None, None
    for n in sorted(nums):
        if start is None:
            start = prev = n
        elif n == prev + 1:
            prev = n
        else:
            out.append(f'{start}-{prev}' if prev > start else f'{start}')
            start = prev = n
    if start is not None:
        out.append(f'{start}-{prev}' if prev > start else f'{start}')
    return ','.join(out)

GENERATED = re.compile(r'(MapperImpl|\$\$|_\$\$_|Application$|Config(uration)?$)')

classes, pkg_totals = [], {}
for pkg in root.findall('package'):
    pkg_name = pkg.get('name').replace('/', '.')
    agg = pkg_totals.setdefault(pkg_name, [0, 0, 0, 0])

    # source-file line detail, keyed by file name within the package
    files = {}
    for sf in pkg.findall('sourcefile'):
        missed, partial_br = [], []
        for ln in sf.findall('line'):
            nr = int(ln.get('nr'))
            if int(ln.get('ci', 0)) == 0 and int(ln.get('mi', 0)) > 0:
                missed.append(nr)
            elif int(ln.get('mb', 0)) > 0:
                partial_br.append(nr)
        files[sf.get('name')] = (missed, partial_br)

    for cl in pkg.findall('class'):
        fqn = cl.get('name').replace('/', '.')
        if '$' in fqn.rsplit('.', 1)[-1] and not show_all:
            pass  # nested classes still counted; their lines live in the same sourcefile
        counters = {c.get('type'): (int(c.get('missed')), int(c.get('covered')))
                    for c in cl.findall('counter')}
        lm, lc = counters.get('LINE', (0, 0))
        bm, bc = counters.get('BRANCH', (0, 0))
        agg[0] += lm; agg[1] += lc; agg[2] += bm; agg[3] += bc

        src = cl.get('sourcefilename')
        missed, partial_br = files.get(src, ([], []))
        classes.append(dict(fqn=fqn, pkg=pkg_name, src=src, lm=lm, lc=lc, bm=bm, bc=bc,
                            missed=missed, partial=partial_br))

# de-dup nested classes onto their outer sourcefile so lines aren't printed twice
by_file = {}
for c in classes:
    key = (c['pkg'], c['src'])
    fresh = dict(
        pkg=c['pkg'], src=c['src'], fqn=c['fqn'],
        lm=0, lc=0, bm=0, bc=0,
        missed=c['missed'], partial=c['partial'],
    )
    e = by_file.setdefault(key, fresh)
    if len(c['fqn']) < len(e['fqn']):
        e['fqn'] = c['fqn']
    e['lm'] += c['lm']; e['lc'] += c['lc']; e['bm'] += c['bm']; e['bc'] += c['bc']
entries = list(by_file.values())

# ---- totals ----
tot = [0, 0, 0, 0]
for a in pkg_totals.values():
    tot = [t + x for t, x in zip(tot, a)]

print()
print(f'COVERAGE  line {fmt(pct(tot[0], tot[1]))}  branch {fmt(pct(tot[2], tot[3]))}'
      f'   ({tot[0]} lines uncovered){partial}')
print()
for name in sorted(pkg_totals):
    a = pkg_totals[name]
    if a[0] + a[1] == 0:
        continue
    print(f'  {name:<44} line {fmt(pct(a[0], a[1]))}  branch {fmt(pct(a[2], a[3]))}')

if quiet:
    sys.exit(0)

# ---- gaps ----
if filters:
    entries = [e for e in entries if any(f.lower() in e['fqn'].lower() for f in filters)]
if skip_gen and not filters:
    entries = [e for e in entries if not GENERATED.search(e['fqn'])]
if not show_all:
    entries = [e for e in entries if e['missed'] or (branches and e['partial'])]

entries.sort(key=lambda e: (-e['lm'], e['fqn']))
shown = entries if max_n == 0 else entries[:max_n]

print()
if not shown:
    print('No uncovered lines.' + (' (filters applied)' if filters else ''))
else:
    print('UNCOVERED LINES (worst first)')
    print()
    for e in shown:
        rel = f"src/main/java/{e['pkg'].replace('.', '/')}/{e['src']}"
        path = rel if os.path.exists(os.path.join(module, rel)) else e['src']
        print(f"  {path}  line {fmt(pct(e['lm'], e['lc']))}")
        if e['missed']:
            print(f"    uncovered: {path}:{ranges(e['missed'])}")
        if branches and e['partial']:
            print(f"    half-branched: {path}:{ranges(e['partial'])}")
    if max_n and len(entries) > max_n:
        print(f'\n  ... {len(entries) - max_n} more classes with gaps (-m 0 for all)')
if skip_gen and not filters:
    print('\n  (generated/boilerplate classes filtered out; --keep-generated to see them)')
PY

[[ $SHOW_CSV  -eq 1 ]] && echo && echo "csv:  $CSV"
echo "html: $HTML"
[[ $OPEN_HTML -eq 1 ]] && { command -v open >/dev/null && open "$HTML"; }
exit 0
