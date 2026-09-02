#!/usr/bin/env python3
"""Generate docs/generated/MavenModules.puml — the Maven module dependency graph.

This repo has no aggregator/reactor pom at its root (see the comment in
petclinic-chatbot/pom.xml): petclinic-backend, petclinic-chatbot, petclinic-database
and refactoring-legacy are four independent, standalone Maven builds, each with its
own external <parent> (spring-boot-starter-parent, or none). "The module graph" is
therefore a question with a real, checkable answer — either these projects declare
Maven <dependency> edges on one another, or they don't — and the only trustworthy way
to answer it is to ask Maven's own dependency resolver, not to eyeball <dependency>
blocks across four pom.xml files.

For each discovered pom, this runs:

    mvn -f <pom> dependency:tree -Dincludes=<every discovered project's groupId:artifactId>

`dependency:tree` walks the *resolved* graph (inherited/BOM-managed versions,
exclusions, everything Maven itself would use to build), and `-Dincludes` prunes it
down to edges that land on one of this repo's own artifacts. Anything printed beneath
the root line is a real inter-project dependency; nothing beneath it means exactly
what it looks like: no edge. This is why it beats reading poms by eye and beats
depgraph-maven-plugin here — depgraph's module-graph output assumes a reactor
(<modules> + a parent aggregator), which this repo deliberately does not have; run
over standalone poms it would draw the same conclusion this script does, with a
plugin dependency this repo doesn't otherwise carry.

Projects are discovered by walking the repo for pom.xml (pruning target/, node_modules/,
.git/, .tools/, etc.) rather than a hardcoded list, so adding or removing a Maven
project changes the diagram next time this runs, with no edit to this script.

Usage:
    maven_modules_to_puml.py [--out PATH] [--mvn-cmd "mvn"]

Stdlib only, except for the `mvn` subprocess calls themselves.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_OUT = REPO_ROOT / "petclinic-backend" / "docs" / "generated" / "MavenModules.puml"

# Same spirit as scripts/list-unversioned-deps.py's PRUNE_DIRS: build output,
# vendored/cloned tool checkouts, and VCS internals never hold a *source* pom.
PRUNE_DIRS = {"target", "node_modules", ".git", ".claude", ".worktrees", ".tools", ".idea", ".codegraph"}

POM_NS = "http://maven.apache.org/POM/4.0.0"

# A tree line for a dependency that matched -Dincludes looks like:
#   [INFO] +- victor.training.agentic:petclinic-database:jar:1.0:compile
# (or the file written by -DoutputFile, without the "[INFO] " prefix). The root line
# of the tree carries no leading tree-drawing glyphs.
TREE_LINE_RE = re.compile(r"^[\s+\\|`-]*([\w.\-]+):([\w.\-]+):[\w.\-]+:[\w.\-]+(?::[\w.\-]+)?\s*$")


@dataclass(frozen=True)
class Project:
    pom: Path
    group_id: str
    artifact_id: str

    @property
    def gav(self) -> str:
        return f"{self.group_id}:{self.artifact_id}"

    @property
    def alias(self) -> str:
        """A PlantUML identifier safe to use unquoted (letters/digits/underscore
        only) — artifactIds conventionally contain hyphens, which are not legal in
        an unquoted PlantUML alias. Used only as the wiring identifier; the
        artifactId itself is still what's shown, as the quoted display name."""
        return re.sub(r"[^0-9A-Za-z_]", "_", self.artifact_id)


def find_project_poms(root: Path) -> list[Path]:
    poms: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in PRUNE_DIRS]
        if "pom.xml" in filenames:
            poms.append(Path(dirpath) / "pom.xml")
    return sorted(poms)


def _strip_ns(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def read_identity(pom: Path) -> Project:
    """groupId:artifactId of the project itself — direct children of <project>,
    falling back to <parent><groupId> when the project inherits its groupId (Maven's
    own rule; none of this repo's poms actually need the fallback today)."""
    root = ET.parse(pom).getroot()
    group_id = None
    artifact_id = None
    parent_group_id = None
    for child in root:
        tag = _strip_ns(child.tag)
        if tag == "groupId":
            group_id = (child.text or "").strip()
        elif tag == "artifactId":
            artifact_id = (child.text or "").strip()
        elif tag == "parent":
            for gc in child:
                if _strip_ns(gc.tag) == "groupId":
                    parent_group_id = (gc.text or "").strip()
    if artifact_id is None:
        raise ValueError(f"{pom}: no <artifactId>")
    return Project(pom=pom, group_id=group_id or parent_group_id or "?", artifact_id=artifact_id)


def dependency_tree_edges(project: Project, all_projects: list[Project], mvn_cmd: str) -> list[str]:
    """Run `mvn dependency:tree` restricted to this repo's own artifacts and return
    the artifactIds this project depends on (possibly empty)."""
    includes = ",".join(sorted({p.gav for p in all_projects}))
    with tempfile.NamedTemporaryFile(mode="r", suffix=".txt", delete=False) as tmp:
        out_file = Path(tmp.name)
    try:
        result = subprocess.run(
            [mvn_cmd, "-q", "-f", str(project.pom), "dependency:tree",
                f"-Dincludes={includes}", f"-DoutputFile={out_file}"],
            cwd=project.pom.parent, capture_output=True, text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"mvn dependency:tree failed for {project.pom}:\n{result.stdout}\n{result.stderr}")
        lines = out_file.read_text().splitlines() if out_file.exists() else []
    finally:
        out_file.unlink(missing_ok=True)

    edges: list[str] = []
    for line in lines[1:]:  # line 0 is the project's own GAV (the tree root)
        m = TREE_LINE_RE.match(line)
        if not m:
            continue
        dep_group, dep_artifact = m.group(1), m.group(2)
        if dep_artifact == project.artifact_id and dep_group == project.group_id:
            continue
        edges.append(dep_artifact)
    return edges


def render_puml(projects: list[Project], edges: list[tuple[str, str]], skipped_dirs: list[str]) -> str:
    # Deliberately NOT PlantUML's `[Name]` bracket shorthand (which packages.puml uses):
    # that form forces the wiring identifier to be the display text verbatim, and
    # puml_diff.py's structural differ, when an element is removed entirely, re-emits it
    # as `component "<s>Name</s>" as Name` — reusing Name as an *unquoted* PlantUML
    # identifier. Maven artifactIds conventionally contain hyphens (petclinic-backend,
    # refactoring-legacy, ...), which are not legal there, so a bracket-form removal
    # diff fails to render ("Error line N", confirmed empirically against this file).
    # `component "artifactId (groupId)" as safe_alias` sidesteps it: the quoted text
    # can be anything, and the differ never needs to turn it into an identifier.
    alias_by_artifact = {p.artifact_id: p.alias for p in projects}
    lines = [
        "@startuml",
        "",
        "title Maven Module Graph",
        "caption Diagram generated from `mvn dependency:tree -Dincludes=<this repo's own groupId:artifactId>`",
        "footer */pom.xml -> petclinic-backend/docs/scripts/mavenmodules/gen-maven-modules.sh "
        "-> petclinic-backend/docs/generated/MavenModules.puml",
        "",
        "skinparam shadowing false",
        "skinparam componentStyle rectangle",
        "skinparam nodesep 20",
        "skinparam ranksep 30",
        "",
    ]
    for p in projects:
        lines.append(f'component "{p.artifact_id} ({p.group_id})" as {p.alias}')
    lines.append("")
    for source, target in edges:
        lines.append(f"{alias_by_artifact[source]} --> {alias_by_artifact[target]}")
    if edges:
        lines.append("")

    # No legend when there are no edges. The picture already says it — four boxes and
    # nothing between them is not a statement that needs a paragraph under it, and the
    # paragraph is what a reader sees first at diagram size.
    lines.append("")
    lines.append("@enduml")
    return "\n".join(lines) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--mvn-cmd", default="mvn")
    args = ap.parse_args(argv)

    pom_paths = find_project_poms(REPO_ROOT)
    if not pom_paths:
        print("no pom.xml found under the repo -- nothing to diagram", file=sys.stderr)
        return 1

    projects = [read_identity(p) for p in pom_paths]

    all_edges: list[tuple[str, str]] = []
    for project in projects:
        for target_artifact in dependency_tree_edges(project, projects, args.mvn_cmd):
            all_edges.append((project.artifact_id, target_artifact))

    # Top-level siblings that carry no pom.xml at all -- called out explicitly so the
    # diagram states they were considered and ruled out, not silently missed.
    skipped = sorted(
        d.name for d in REPO_ROOT.iterdir()
        if d.is_dir() and d.name not in PRUNE_DIRS
        and not (d / "pom.xml").exists()
        and any((d / f).exists() for f in ("package.json",))
    )

    puml = render_puml(projects, all_edges, skipped)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(puml)
    print(f"wrote {out_path}", file=sys.stderr)
    print(f"projects: {[p.gav for p in projects]}", file=sys.stderr)
    print(f"edges: {all_edges or 'none'}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
