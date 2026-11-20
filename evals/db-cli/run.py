#!/usr/bin/env python3
"""Eval of the db-cli skill: does it activate, and what does it save?

Every task runs N times in two throwaway clones of HEAD: `with` (skill present) and
`without` (skill directory and every hint to it removed). Each run is a fresh headless
`claude -p` with no MCP server at all, so the only way to the database is the shell.

    evals/db-cli/run.py [--runs 7] [--model sonnet] [--parallel 6] [--out DIR]
    evals/db-cli/report.py DIR
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
SKILL = ".claude/skills/db-cli"


def make_arm(root: Path, arm: str) -> Path:
    dst = root / arm
    dst.mkdir(parents=True)
    archive = ["git", "archive", "HEAD"]
    tar = subprocess.run(archive, cwd=REPO, check=True, capture_output=True).stdout
    subprocess.run(["tar", "-x", "-C", str(dst)], input=tar, check=True)
    shutil.rmtree(dst / "evals", ignore_errors=True)  # the expected answers live there
    if arm == "without":
        shutil.rmtree(dst / SKILL)
        mcp = dst / ".mcp.json"
        hint = (r'\n\s*"//": "In case MCPs are disabled, '
                r'tell agent to use \.claude/skills/db-cli[^\n]*')
        mcp.write_text(re.sub(hint, "", mcp.read_text()))
        assert "db-cli" not in mcp.read_text()
    # a fresh one-commit repo: a clone would let the agent `git show` the removed skill back
    author = ["-c", "user.name=eval", "-c", "user.email=eval@example.com"]
    for cmd in (["init", "-q"], ["add", "-A"], [*author, "commit", "-qm", "petclinic"]):
        subprocess.run(["git", *cmd], cwd=dst, check=True)
    return dst


def run_one(job):
    task, arm, i, cwd, out, model = job
    log = out / f"{task['id']}.{arm}.{i}.jsonl"
    cmd = [
        "claude", "-p", task["prompt"], "--model", model,
        "--output-format", "stream-json", "--verbose",
        "--setting-sources", "project",
        "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
        "--permission-mode", "bypassPermissions",
        "--no-session-persistence", "--max-budget-usd", "3",
    ]
    env = {k: v for k, v in os.environ.items() if not k.startswith("CLAUDE")}
    t0 = time.time()
    with log.open("w") as f:
        proc = subprocess.run(
            cmd, cwd=cwd, env=env, timeout=900, stdout=f, stderr=subprocess.STDOUT
        )
    rc = proc.returncode
    print(f"{task['id']:<11}{arm:<8}#{i} rc={rc} {time.time() - t0:5.0f}s", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=7)
    ap.add_argument("--model", default="sonnet")
    ap.add_argument("--parallel", type=int, default=6)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--only", help="task id")
    a = ap.parse_args()
    out = a.out or Path(tempfile.mkdtemp(prefix="db-cli-eval-"))
    out.mkdir(parents=True, exist_ok=True)
    arms = {arm: make_arm(out / "arms", arm) for arm in ("with", "without")}
    tasks = [t for t in json.loads((HERE / "tasks.json").read_text()) if a.only in (None, t["id"])]
    # interleave arms so both see the same machine load and rate limits
    jobs = [(t, arm, i, arms[arm], out, a.model)
            for i in range(1, a.runs + 1) for t in tasks for arm in ("with", "without")]
    with ThreadPoolExecutor(a.parallel) as pool:
        list(pool.map(run_one, jobs))
    print(f"\nlogs in {out}\nnext: {HERE / 'report.py'} {out}")


if __name__ == "__main__":
    sys.exit(main())
