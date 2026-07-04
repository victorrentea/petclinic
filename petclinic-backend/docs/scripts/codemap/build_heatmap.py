#!/usr/bin/env python3
"""Build per-file codemap data.

Inputs:
  - /tmp/claude/bug_issues.txt : one issue number per line
  - REPO_DIR git history       : walked via subprocess
  - REPO_DIR working tree      : for current bytes/lines

Output:
  - OUT_DIR/codemap.tsv : path \t bytes \t lines \t commits \t bug_commits \t commits_per_kloc \t bugs_per_kloc \t bugs_per_commit
    Filtered to non-test .java files present in current tree.
    Sorted by bugs_per_kloc desc.
"""
import os
import re
import subprocess
import sys
from collections import defaultdict

_here = os.path.dirname(os.path.abspath(__file__))
def _git_root(start):
    try:
        return subprocess.check_output(["git", "-C", start, "rev-parse", "--show-toplevel"],
                                       text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return start
REPO_DIR = os.path.abspath(os.environ.get("HEATMAP_REPO") or _git_root(_here))
OUT_DIR = os.path.abspath(os.environ.get("HEATMAP_OUT") or REPO_DIR)
os.makedirs(OUT_DIR, exist_ok=True)
EXTRA_PRUNE = {d for d in os.environ.get("HEATMAP_PRUNE", "").split(",") if d}
BUG_FILE = os.environ.get("HEATMAP_BUG_FILE", os.path.join(OUT_DIR, "bug_issues.txt"))
# Optional: a regex on the commit SUBJECT flags a bug-fix commit directly
# (used for repos like petclinic that have no GitHub bug labels but use
# conventional commits, e.g. HEATMAP_BUG_COMMIT_REGEX="^(fix|bugfix)(\\(|:|!)").
_bug_subj_src = os.environ.get("HEATMAP_BUG_COMMIT_REGEX")
BUG_SUBJECT_RE = re.compile(_bug_subj_src, re.IGNORECASE) if _bug_subj_src else None
OUT_FILE = os.path.join(OUT_DIR, "codemap.tsv")
COMPLEXITY_FILE = os.path.join(OUT_DIR, "complexity-per-file.tsv")
FANIO_FILE = os.path.join(OUT_DIR, "fanio-per-file.tsv")

# load bug issue set (optional — absent for repos without a bug-issue list)
bug_ids = set()
if os.path.exists(BUG_FILE):
    with open(BUG_FILE) as f:
        bug_ids = {int(line.strip()) for line in f if line.strip()}
print(f"loaded {len(bug_ids)} bug/regression issue numbers", file=sys.stderr)
if BUG_SUBJECT_RE:
    print(f"also flagging bug commits via subject regex: {_bug_subj_src!r}", file=sys.stderr)

# regex for gh-NNN refs (case-insensitive). also accept "#NNN" when paired with closes/fixes.
GH_RE = re.compile(r'\bgh-(\d+)\b', re.IGNORECASE)
HASH_RE = re.compile(r'(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b', re.IGNORECASE)

# walk git log
SENT = "___COMMIT___"
FSENT = "___FILES___"
# %ae = author email (stable identity for counting DISTINCT committers per file)
fmt = f"{SENT}%n%H%n%ae%n%s%n%b%n{FSENT}"
proc = subprocess.Popen(
    ["git", "-C", REPO_DIR, "log", "--no-merges", "--name-only", f"--pretty=format:{fmt}"],
    stdout=subprocess.PIPE, text=True, errors="replace",
)
assert proc.stdout

commits_per_file = defaultdict(int)
bug_commits_per_file = defaultdict(int)
committers_per_file = defaultdict(set)   # distinct author identities (emails) per file
total_commits = 0
total_bug_commits = 0

# Per-package (district) aggregates for the Code City "package mode". Sets so the
# counts are EXACT distinct values (a commit/author touching several files in a
# package counts once) — not obtainable by summing the per-file counts.
commits_per_package = defaultdict(set)      # distinct commit SHAs per package
bug_commits_per_package = defaultdict(set)  # distinct bugfix commit SHAs per package
committers_per_package = defaultdict(set)   # distinct author identities per package

# Same, per Maven/Gradle module (Code City "module mode").
commits_per_module = defaultdict(set)
bug_commits_per_module = defaultdict(set)
committers_per_module = defaultdict(set)


def _district(path):
    """Dotted Java package for a repo-relative path (mirrors render_codecity._district)."""
    parts = path.split("/")
    if "java" in parts:
        j = parts.index("java")
        pkg = parts[j + 1:-1]
        if pkg:
            return ".".join(pkg)
    if len(parts) > 1:
        return parts[-2]
    return "root"


# ── Maven/Gradle module map ──────────────────────────────────────────────────
# A module = a directory holding a build descriptor: pom.xml (Maven) or any
# *.gradle / *.gradle.kts (Gradle — note Spring names its per-module script after
# the module, e.g. spring-core/spring-core.gradle, not build.gradle). Each file
# belongs to its NEAREST such ancestor; files under none fall to "" (repo root).
# Discovered from the working tree, honouring the same prunes. Descriptor-only
# dirs with no source (e.g. a shared gradle/ script folder) yield empty modules
# that are simply never emitted.
def _is_build_descriptor(fn):
    return fn == "pom.xml" or fn.endswith(".gradle") or fn.endswith(".gradle.kts")


def _discover_module_dirs():
    dirs = set()
    for root, subdirs, files in os.walk(REPO_DIR):
        parts = root.split(os.sep)
        if any(p == ".git" for p in parts) or any(p in EXTRA_PRUNE for p in parts):
            subdirs[:] = []
            continue
        if any(_is_build_descriptor(fn) for fn in files):
            rel = os.path.relpath(root, REPO_DIR)
            dirs.add("" if rel == "." else rel.replace(os.sep, "/"))
    return dirs


MODULE_DIRS = _discover_module_dirs()
# Longest first, so the nearest (deepest) enclosing module wins.
_MODULE_DIRS_SORTED = sorted((m for m in MODULE_DIRS if m), key=len, reverse=True)
print(f"discovered {len(MODULE_DIRS)} Maven/Gradle module dir(s)", file=sys.stderr)


def _module(path):
    """Repo-relative dir of the nearest ancestor module ('' = the repo-root module)."""
    d = path.rsplit("/", 1)[0] if "/" in path else ""
    for m in _MODULE_DIRS_SORTED:
        if d == m or d.startswith(m + "/"):
            return m
    return ""


def _counts_toward_diagram(fp):
    """Same inclusion rule as the file walk below: non-test .java, no package-info."""
    if not fp.endswith(".java") or fp.rsplit("/", 1)[-1] == "package-info.java":
        return False
    segs = fp.split("/")
    for i in range(len(segs) - 1):
        if segs[i] == "src" and segs[i + 1] in ("test", "testFixtures"):
            return False
    return True

buf = []
state = "expect_sent"
sha = None
author = None
msg_lines = []
file_lines = []

def flush_commit():
    global total_commits, total_bug_commits
    if sha is None:
        return
    msg = "\n".join(msg_lines)
    subject = msg_lines[0] if msg_lines else ""
    refs = set(int(m) for m in GH_RE.findall(msg))
    for m in HASH_RE.findall(msg):
        refs.add(int(m))
    is_bug = bool(refs & bug_ids)
    if BUG_SUBJECT_RE and BUG_SUBJECT_RE.search(subject):
        is_bug = True
    total_commits += 1
    if is_bug:
        total_bug_commits += 1
    for fp in file_lines:
        if not fp:
            continue
        commits_per_file[fp] += 1
        if author:
            committers_per_file[fp].add(author)
        if is_bug:
            bug_commits_per_file[fp] += 1
    # Roll this commit up to each distinct package it touched (exact, deduped).
    for pkg in {_district(fp) for fp in file_lines if fp and _counts_toward_diagram(fp)}:
        commits_per_package[pkg].add(sha)
        if author:
            committers_per_package[pkg].add(author)
        if is_bug:
            bug_commits_per_package[pkg].add(sha)
    # ...and to each distinct Maven/Gradle module it touched.
    for mod in {_module(fp) for fp in file_lines if fp and _counts_toward_diagram(fp)}:
        commits_per_module[mod].add(sha)
        if author:
            committers_per_module[mod].add(author)
        if is_bug:
            bug_commits_per_module[mod].add(sha)

for raw in proc.stdout:
    line = raw.rstrip("\n")
    if line == SENT:
        flush_commit()
        sha = None
        author = None
        msg_lines = []
        file_lines = []
        state = "expect_sha"
        continue
    if state == "expect_sha":
        sha = line
        state = "expect_author"
        continue
    if state == "expect_author":
        author = line
        state = "in_msg"
        continue
    if state == "in_msg":
        if line == FSENT:
            state = "in_files"
            continue
        msg_lines.append(line)
        continue
    if state == "in_files":
        if line:  # skip blanks between commits
            file_lines.append(line)
        continue
flush_commit()
proc.wait()

print(f"walked {total_commits} commits, {total_bug_commits} flagged as bug-linked", file=sys.stderr)
print(f"touched {len(commits_per_file)} distinct file paths (across all history)", file=sys.stderr)

# collect current java files (non-test) + their bytes + line counts
java_files = []
for root, dirs, files in os.walk(REPO_DIR):
    # prune hidden + test dirs
    parts = root.split(os.sep)
    if any(p == ".git" for p in parts) or any(p in EXTRA_PRUNE for p in parts):
        dirs[:] = []
        continue
    skip = False
    for i in range(len(parts) - 1):
        if parts[i] == "src" and parts[i+1] in ("test", "testFixtures"):
            skip = True
            break
    if skip:
        dirs[:] = []
        continue
    for fn in files:
        if fn == "package-info.java":
            continue  # only package annotations/Javadoc — keep it out of the diagram
        if fn.endswith(".java"):
            java_files.append(os.path.join(root, fn))

print(f"found {len(java_files)} current non-test java files", file=sys.stderr)

# load cognitive complexity per file
complexity = {}
if os.path.exists(COMPLEXITY_FILE):
    with open(COMPLEXITY_FILE) as f:
        next(f)  # header
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 2:
                complexity[parts[0]] = int(parts[1])
    print(f"loaded complexity for {len(complexity)} files", file=sys.stderr)
else:
    print(f"WARN: {COMPLEXITY_FILE} not found, complexity will be 0", file=sys.stderr)

# load fan_in / fan_out per file
fan_in_map, fan_out_map = {}, {}
if os.path.exists(FANIO_FILE):
    with open(FANIO_FILE) as f:
        next(f)
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 3:
                fan_in_map[parts[0]] = int(parts[1])
                fan_out_map[parts[0]] = int(parts[2])
    print(f"loaded fan-in/out for {len(fan_in_map)} files", file=sys.stderr)
else:
    print(f"WARN: {FANIO_FILE} not found, fan-in/out will be 0", file=sys.stderr)

rows = []
for ap in java_files:
    rel = os.path.relpath(ap, REPO_DIR)
    try:
        sz = os.path.getsize(ap)
        with open(ap, "rb") as f:
            lines = sum(1 for _ in f)
    except OSError:
        continue
    commits = commits_per_file.get(rel, 0)
    bug_commits = bug_commits_per_file.get(rel, 0)
    committers = len(committers_per_file.get(rel, ()))
    cog = complexity.get(rel, 0)
    fi = fan_in_map.get(rel, 0)
    fo = fan_out_map.get(rel, 0)
    kloc = lines / 1000.0 if lines else 0
    commits_per_kloc = (commits / kloc) if kloc else 0
    bugs_per_kloc = (bug_commits / kloc) if kloc else 0
    bugs_per_commit = (bug_commits / commits) if commits else 0
    cog_per_kloc = (cog / kloc) if kloc else 0
    rows.append((rel, sz, lines, commits, bug_commits, commits_per_kloc, bugs_per_kloc, bugs_per_commit, cog, cog_per_kloc, fi, fo, committers))

rows.sort(key=lambda r: (r[6], r[4], r[3]), reverse=True)

with open(OUT_FILE, "w") as f:
    f.write("path\tbytes\tlines\tcommits\tbug_commits\tcommits_per_kloc\tbugs_per_kloc\tbugs_per_commit\tcognitive_complexity\tcomplexity_per_kloc\tfan_in\tfan_out\tcommitters\n")
    for r in rows:
        f.write(f"{r[0]}\t{r[1]}\t{r[2]}\t{r[3]}\t{r[4]}\t{r[5]:.2f}\t{r[6]:.2f}\t{r[7]:.3f}\t{r[8]}\t{r[9]:.2f}\t{r[10]}\t{r[11]}\t{r[12]}\n")

print(f"wrote {len(rows)} rows to {OUT_FILE}", file=sys.stderr)

# ── Per-package aggregates for Code City "package mode" ──────────────────────
# Additive metrics (size, LOC, complexity, coupling) sum over the package's
# files; commits / bug_commits / committers are EXACT distinct counts from the
# per-package sets built during the git walk. Ratios recompute from the totals.
OUT_FILE_PKG = os.path.join(OUT_DIR, "codemap-packages.tsv")
pkg_agg = {}  # package -> [files, bytes, lines, cog, fan_in, fan_out]
for r in rows:
    pkg = _district(r[0])
    a = pkg_agg.setdefault(pkg, [0, 0, 0, 0, 0, 0])
    a[0] += 1        # files
    a[1] += r[1]     # bytes
    a[2] += r[2]     # lines
    a[3] += r[8]     # cognitive_complexity
    a[4] += r[10]    # fan_in
    a[5] += r[11]    # fan_out

pkg_rows = []
for pkg, (files, sz, lines, cog, fi, fo) in pkg_agg.items():
    commits = len(commits_per_package.get(pkg, ()))
    bug_commits = len(bug_commits_per_package.get(pkg, ()))
    committers = len(committers_per_package.get(pkg, ()))
    kloc = lines / 1000.0 if lines else 0
    commits_per_kloc = (commits / kloc) if kloc else 0
    bugs_per_kloc = (bug_commits / kloc) if kloc else 0
    bugs_per_commit = (bug_commits / commits) if commits else 0
    cog_per_kloc = (cog / kloc) if kloc else 0
    pkg_rows.append((pkg, files, sz, lines, commits, bug_commits, commits_per_kloc,
                     bugs_per_kloc, bugs_per_commit, cog, cog_per_kloc, fi, fo, committers))

pkg_rows.sort(key=lambda r: (r[6], r[5], r[4]), reverse=True)

with open(OUT_FILE_PKG, "w") as f:
    f.write("package\tfiles\tbytes\tlines\tcommits\tbug_commits\tcommits_per_kloc\tbugs_per_kloc\tbugs_per_commit\tcognitive_complexity\tcomplexity_per_kloc\tfan_in\tfan_out\tcommitters\n")
    for r in pkg_rows:
        f.write(f"{r[0]}\t{r[1]}\t{r[2]}\t{r[3]}\t{r[4]}\t{r[5]}\t{r[6]:.2f}\t{r[7]:.2f}\t{r[8]:.3f}\t{r[9]}\t{r[10]:.2f}\t{r[11]}\t{r[12]}\t{r[13]}\n")

print(f"wrote {len(pkg_rows)} package rows to {OUT_FILE_PKG}", file=sys.stderr)

# ── Per-module aggregates for Code City "module mode" ────────────────────────
# Additive metrics sum over the module's files; commits / bug_commits / committers
# are EXACT distinct counts from the per-module sets built during the git walk.
OUT_FILE_MOD = os.path.join(OUT_DIR, "codemap-modules.tsv")
mod_agg = {}  # module -> [files, bytes, lines, cog, fan_in, fan_out]
for r in rows:
    mod = _module(r[0])
    a = mod_agg.setdefault(mod, [0, 0, 0, 0, 0, 0])
    a[0] += 1        # files
    a[1] += r[1]     # bytes
    a[2] += r[2]     # lines
    a[3] += r[8]     # cognitive_complexity
    a[4] += r[10]    # fan_in
    a[5] += r[11]    # fan_out

mod_rows = []
for mod, (files, sz, lines, cog, fi, fo) in mod_agg.items():
    commits = len(commits_per_module.get(mod, ()))
    bug_commits = len(bug_commits_per_module.get(mod, ()))
    committers = len(committers_per_module.get(mod, ()))
    kloc = lines / 1000.0 if lines else 0
    commits_per_kloc = (commits / kloc) if kloc else 0
    bugs_per_kloc = (bug_commits / kloc) if kloc else 0
    bugs_per_commit = (bug_commits / commits) if commits else 0
    cog_per_kloc = (cog / kloc) if kloc else 0
    mod_rows.append((mod, files, sz, lines, commits, bug_commits, commits_per_kloc,
                     bugs_per_kloc, bugs_per_commit, cog, cog_per_kloc, fi, fo, committers))

mod_rows.sort(key=lambda r: (r[3], r[4]), reverse=True)   # by lines, then commits

with open(OUT_FILE_MOD, "w") as f:
    f.write("module\tfiles\tbytes\tlines\tcommits\tbug_commits\tcommits_per_kloc\tbugs_per_kloc\tbugs_per_commit\tcognitive_complexity\tcomplexity_per_kloc\tfan_in\tfan_out\tcommitters\n")
    for r in mod_rows:
        f.write(f"{r[0]}\t{r[1]}\t{r[2]}\t{r[3]}\t{r[4]}\t{r[5]}\t{r[6]:.2f}\t{r[7]:.2f}\t{r[8]:.3f}\t{r[9]}\t{r[10]:.2f}\t{r[11]}\t{r[12]}\t{r[13]}\n")

print(f"wrote {len(mod_rows)} module rows to {OUT_FILE_MOD}", file=sys.stderr)
