#!/usr/bin/env python3
"""Can a weak model read what drawio.py prints, with no word about the format?

Feeds the output for both diagrams to cheap Copilot CLI models and grades their answers to
questions/ground truth that only a correct reading gets right (null cells, multiplicities, edge
direction, quoted cells). Usage: comprehension_eval.py [reps] [model ...]
DRAWIO=<other drawio.py> runs the same questions against another version of the script.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor

ROOT = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()
DRAWIO = os.environ.get("DRAWIO", os.path.join(ROOT, ".claude/skills/drawio-png/drawio.py"))
DIAGRAMS = ["petclinic-backend/docs/Deployment.drawio.png",
            "petclinic-backend/docs/ConceptualModel.drawio.png"]
MODELS = [
    "gpt-5.6-luna", "gpt-6-luna", "claude-haiku-4.5", "gemini-3.8-flash", "mai-code-1.1-flash"]
args = sys.argv[1:]
REPS = int(args.pop(0)) if args and args[0].isdigit() else 2
MODELS = args or MODELS

QUESTIONS = {  # id: (question, expected answer, kind of comparison)
    "q1": (
        "Deployment: which vertices have an edge pointing INTO Backend? List of labels.",
        ["Frontend", "Chatbot"], "set"),
    "q2": ("Deployment: on which port does the Notification Service listen?", "8090", "eq"),
    "q3": (
        "Deployment: list every edge whose traced attribute is \"no\", each as \"From -> To\".",
        ["Pet Owner -> Frontend", "Veterinarian -> Frontend", "Pet Owner -> Chatbot",
            "Chatbot -> Backend"], "set"),
    "q4": (
        "Deployment: which edge has no traced attribute at all? As \"From -> To\".",
        "Chatbot -> OpenAI", "eq"),
    "q5": (
        "Deployment: what tech does the SMS gateway use? \"unknown\" if the diagram doesn't say.",
        "unknown", "eq"),
    "q6": (
        "Deployment: per the diagram, why is the Chatbot -> Backend call not traced? One sentence.",
        r"otel|agent", "regex"),
    "q7": (
        "Deployment: which vertices are of kind external? List of labels.",
        ["OpenAI", "SMS gateway"], "set"),
    "q8": ("Conceptual model: can one Owner have \"one\" or \"many\" Pets?", "many", "eq"),
    "q9": (
        "Conceptual model: is Vet-Specialty \"one-to-one\", \"one-to-many\", \"many-to-one\" or "
        "\"many-to-many\"?", "many-to-many", "eq"),
    "q10": ("Conceptual model: which concept has many Visits? One label.", "Pet", "eq"),
}


def prompt() -> str:
    outputs = "\n\n".join(
        f"$ drawio.py {d}\n"
        + subprocess.check_output([sys.executable, DRAWIO, d], cwd=ROOT, text=True)
        for d in DIAGRAMS)
    questions = "\n".join(f"{q}: {text}" for q, (text, _, _) in QUESTIONS.items())
    return (
        "Below is what a tool printed for two draw.io diagrams. Answer only from it.\n\n"
        f"{outputs}\nQuestions:\n{questions}\n\n"
        "Reply with ONE JSON object and nothing else, keys q1..q10, "
        "each a string or a list of strings.")


def norm(value) -> str:
    return re.sub(r"\s*-+>\s*", " -> ", re.sub(r"\s+", " ", str(value))).strip().lower()


def correct(answer, expected, kind) -> bool:
    if kind == "set":
        return isinstance(answer, list) and {norm(a) for a in answer} == {norm(e) for e in expected}
    if kind == "regex":
        return bool(re.search(expected, str(answer), re.I))
    return norm(answer) == norm(expected)


def run_once(job):
    model, _rep = job
    with tempfile.TemporaryDirectory() as empty:  # no repo: no instructions or files to peek at
        out = subprocess.run(
            ["copilot", "-p", PROMPT, "--model", model, "--available-tools=",
                "--no-custom-instructions", "-s"],
            cwd=empty, capture_output=True, text=True, timeout=300).stdout
    match = re.search(r"\{.*\}", out, re.S)
    try:
        answers = json.loads(match.group(0)) if match else {}
    except ValueError:
        answers = {}
    wrong = [q for q, (_, expected, kind) in QUESTIONS.items()
        if not correct(answers.get(q), expected, kind)]
    return model, wrong, {q: answers.get(q) for q in wrong}


PROMPT = prompt()
jobs = [(m, r) for m in MODELS for r in range(REPS)]
with ThreadPoolExecutor(5) as pool:
    results = list(pool.map(run_once, jobs))
for model, wrong, got in results:
    score = f"{len(QUESTIONS) - len(wrong)}/{len(QUESTIONS)}"
    print(f"{model:20} {score}  " + json.dumps(got, ensure_ascii=False)[:300])
total = len(results) * len(QUESTIONS)
right = total - sum(len(w) for _, w, _ in results)
print(f"{right}/{total} answers right, {len(PROMPT)} chars of prompt")
sys.exit(0 if right == total else 1)
