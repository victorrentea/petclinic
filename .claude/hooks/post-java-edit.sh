#!/usr/bin/env bash
# PostToolUse hook: runs after editing a Java file.
#   1. Spotless: format the file via spotless:apply
#   2. FQCN check: warn Claude when fully-qualified class names appear in code
# example: victor.training.petclinic.rest.error.ExceptionControllerAdvice.buildProblemDetail

set -uo pipefail

INPUT=$(cat)
FILE=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || true)

printf '%s' "$FILE" | grep -qE '\.java$' || exit 0

# ── 1. Spotless ───────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUTPUT=$(cd "$REPO_ROOT/petclinic-backend" && mvn spotless:apply -q 2>&1)
STATUS=$?
if [ $STATUS -ne 0 ]; then
    echo "$OUTPUT"
    exit $STATUS
fi

# ── 2. FQCN check (lexical — ignores strings, text blocks, char literals, comments) ──
# A full Java parser (tree-sitter / JavaParser) is overkill for a hook. Instead a
# tiny char-by-char lexer blanks out the *contents* of string/char literals, text
# blocks, and comments (newlines preserved so line numbers stay accurate), then the
# FQCN regex matches only what's left — i.e. real code, not strings like the
# "org.springframework...AutoConfiguration" values in @SpringBootTest properties.
[[ -f "$FILE" ]] || exit 0

FILE_PATH="$FILE" python3 - <<'PY'
import json, os, re, sys

path = os.environ['FILE_PATH']
try:
    src = open(path, encoding='utf-8').read()
except OSError:
    sys.exit(0)

# Scanner: replace literal/comment CONTENT with spaces, keep newlines intact.
out = []
i, n = 0, len(src)
NORMAL, LINE, BLOCK, STR, CHAR, TEXT = range(6)
state = NORMAL
while i < n:
    c = src[i]
    nx = src[i + 1] if i + 1 < n else ''
    if state == NORMAL:
        if c == '/' and nx == '/':
            state = LINE; out.append('  '); i += 2
        elif c == '/' and nx == '*':
            state = BLOCK; out.append('  '); i += 2
        elif src[i:i + 3] == '"""':
            state = TEXT; out.append('   '); i += 3
        elif c == '"':
            state = STR; out.append(' '); i += 1
        elif c == "'":
            state = CHAR; out.append(' '); i += 1
        else:
            out.append(c); i += 1
    elif state == LINE:
        out.append('\n') if c == '\n' else out.append(' ')
        if c == '\n':
            state = NORMAL
        i += 1
    elif state == BLOCK:
        if c == '*' and nx == '/':
            state = NORMAL; out.append('  '); i += 2
        else:
            out.append('\n' if c == '\n' else ' '); i += 1
    elif state == STR:
        if c == '\\':
            out.append('  '); i += 2
        elif c == '"':
            state = NORMAL; out.append(' '); i += 1
        else:
            out.append('\n' if c == '\n' else ' '); i += 1
    elif state == CHAR:
        if c == '\\':
            out.append('  '); i += 2
        elif c == "'":
            state = NORMAL; out.append(' '); i += 1
        else:
            out.append(' '); i += 1
    elif state == TEXT:
        if src[i:i + 3] == '"""':
            state = NORMAL; out.append('   '); i += 3
        else:
            out.append('\n' if c == '\n' else ' '); i += 1

clean = ''.join(out).split('\n')
orig = src.split('\n')

# lowercase.segment(.segment)+.UpperCamel — a dotted name ending in a Type
fqcn = re.compile(r'[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+\.[A-Z][a-zA-Z0-9]*')
findings = []
for lineno, line in enumerate(clean, 1):
    lead = line.lstrip()
    if lead.startswith('import ') or lead.startswith('package '):
        continue  # FQCNs are mandatory here
    if fqcn.search(line):
        findings.append(f'{lineno}:{orig[lineno - 1].strip()}')

if not findings:
    sys.exit(0)

msg = ('FQCNs found in ' + path + ' — replace with simple names + add imports:\n'
       + '\n'.join(findings))
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PostToolUse', 'additionalContext': msg}}))
PY
