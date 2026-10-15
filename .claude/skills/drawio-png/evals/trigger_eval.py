#!/usr/bin/env python3
"""Run each prompt N times in headless `claude -p`; PASS = the Skill tool is called with drawio-png.
A run is killed (by its own PID) as soon as the verdict is known, to save tokens."""
import json, os, subprocess, sys, threading, time
from concurrent.futures import ThreadPoolExecutor
CWD = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()
here = os.path.dirname(os.path.abspath(__file__))
prompts = json.load(open(os.path.join(here, "prompts.json"))); reps = int(sys.argv[1]) if len(sys.argv) > 1 else 2
env = {k: v for k, v in os.environ.items() if not k.startswith("CLAUDE_CODE") and k != "CLAUDECODE"}

def one(job):
    pi, rep = job
    cmd = ["claude", "-p", prompts[pi], "--output-format", "stream-json", "--verbose",
           "--model", "opus", "--max-turns", "6", "--disallowedTools", "Edit", "Write", "NotebookEdit", "Agent"]
    p = subprocess.Popen(cmd, cwd=CWD, env=env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    timer = threading.Timer(240, p.kill); timer.start()
    verdict, tools = "FAIL", []
    for line in p.stdout:
        try: ev = json.loads(line)
        except ValueError: continue
        if ev.get("type") != "assistant": continue
        for b in ev["message"].get("content", []):
            if b.get("type") == "tool_use":
                inp = b.get("input", {})
                tools.append(b["name"] + (":" + str(inp.get("skill")) if b["name"] == "Skill" else ""))
                if b["name"] == "Skill" and "drawio" in str(inp.get("skill", "")):
                    verdict = "PASS"
        if verdict == "PASS": p.kill(); break
    p.wait(); timer.cancel()
    return {"prompt": pi + 1, "rep": rep + 1, "verdict": verdict, "tools_before_verdict": tools}

jobs = [(i, r) for i in range(len(prompts)) for r in range(reps)]
with ThreadPoolExecutor(5) as ex:
    res = list(ex.map(one, jobs))

for r in res: print(f"P{r['prompt']}#{r['rep']} {r['verdict']}  {' > '.join(r['tools_before_verdict'])[:150]}")
print(f"{sum(r['verdict']=='PASS' for r in res)}/{len(res)} PASS")
