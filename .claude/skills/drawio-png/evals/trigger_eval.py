#!/usr/bin/env python3
"""Run each phrasing in prompts.json REPS times (default 2) in headless `claude -p`.

A run PASSES only if it calls the Skill tool with drawio-png. Each run is killed by its own
PID as soon as the verdict is known, to save tokens.
"""
import json
import os
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor

ROOT = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()
HERE = os.path.dirname(os.path.abspath(__file__))
PROMPTS = json.load(open(os.path.join(HERE, "prompts.json")))
REPS = int(sys.argv[1]) if len(sys.argv) > 1 else 2
# A nested session started with the parent's session variables refuses to run or mixes state.
ENV = {
    k: v for k, v in os.environ.items()
    if not k.startswith("CLAUDE_CODE") and k != "CLAUDECODE"
}


def tool_uses(line):
    try:
        event = json.loads(line)
    except ValueError:
        return []
    if event.get("type") != "assistant":
        return []
    return [b for b in event["message"].get("content", []) if b.get("type") == "tool_use"]


def run_once(job):
    prompt_index, rep = job
    cmd = [
        "claude", "-p", PROMPTS[prompt_index], "--output-format", "stream-json", "--verbose",
        "--model", "opus", "--max-turns", "6",
        "--disallowedTools", "Edit", "Write", "NotebookEdit", "Agent",
    ]
    proc = subprocess.Popen(
        cmd, cwd=ROOT, env=ENV, text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    timer = threading.Timer(240, proc.kill)
    timer.start()
    verdict, tools = "FAIL", []
    for line in proc.stdout:
        for use in tool_uses(line):
            skill = str(use.get("input", {}).get("skill", ""))
            tools.append(use["name"] + (":" + skill if use["name"] == "Skill" else ""))
            if use["name"] == "Skill" and "drawio" in skill:
                verdict = "PASS"
        if verdict == "PASS":
            proc.kill()
            break
    proc.wait()
    timer.cancel()
    return prompt_index + 1, rep + 1, verdict, tools


jobs = [(i, r) for i in range(len(PROMPTS)) for r in range(REPS)]
with ThreadPoolExecutor(5) as pool:
    results = list(pool.map(run_once, jobs))
for prompt_no, rep_no, verdict, tools in results:
    print(f"P{prompt_no}#{rep_no} {verdict}  {' > '.join(tools)[:150]}")
passed = sum(verdict == "PASS" for _, _, verdict, _ in results)
print(f"{passed}/{len(results)} PASS")
sys.exit(0 if passed == len(results) else 1)
