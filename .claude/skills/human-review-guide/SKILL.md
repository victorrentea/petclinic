---
name: human-review-guide
description: Build a human-facing review.md for a change set (uncommitted, given commits, or a PR) — PlantUML diagram diffs, screenshots of impacted screens, a code-review summary, the core business logic, and the acceptance tests, each with code snippets and IntelliJ deep-links. Explicit invocation only — user types /human-review-guide.
disable-model-invocation: true
---

# /human-review-guide — assemble a review.md for a human

Produce **one file, `review/review.md`**, that lets a human review a change set fast:
diagram deltas, screenshots, the code-review summary, the core logic, and the
acceptance tests — every code reference a clickable IntelliJ deep-link.

You are the assembler, not the reviewer of record — surface everything a reviewer
needs and point at what deserves their eyes. Do **not** commit, push, or `--fix`.

## Step 0 — Resolve the change set (from `$ARGUMENTS`)

Pick the mode from what the user passed:

- **empty** → uncommitted work: `BASE=HEAD`, diff = `git --no-pager diff HEAD` (staged + unstaged).
- **a ref / range / SHA(s)** (e.g. `abc123`, `main..HEAD`, `HEAD~3`) → `BASE=<the older ref>`,
  diff = `git --no-pager diff $BASE..$HEAD`.
- **a PR** (`#123`, `123`, or a github URL) → `gh pr checkout <n>` (or `gh pr diff <n>`),
  set `BASE=$(gh pr view <n> --json baseRefName -q .baseRefName)`.

Establish two things and reuse them everywhere below:
- `CHANGED=$(git --no-pager diff --name-only $BASE...HEAD)` (or `HEAD` for uncommitted).
- `BASE` — the ref to diff *against* (used by the PlantUML tool).

Print a one-line scope banner: mode, refs, and `git --no-pager diff --stat`. If the
change set is empty, say "Nothing to review." and stop.

Create the output dir: `review/assets/`.

## Step 1 — PlantUML diagram deltas (only if any `*.puml` changed)

One bundled script covers all three architecture diagrams — domain model, DB
schema, and packages — diffing each against the merge-base with `$BASE`,
rendering them, and dropping everything into `review/assets/`:

```sh
.claude/skills/human-review-guide/scripts/collect-review-artifacts.sh $BASE
```

It produces, when the change set warrants it:

| Artifact | Use in review.md |
| --- | --- |
| `review/assets/<name>.diff.svg` | embed one per changed diagram |
| `review/assets/architecture.html` | standalone gallery — link it, don't inline it |
| `review/assets/SUMMARY.md` | same deltas as remote-rendered markdown (fallback) |

Additions render red, removals red + struck-through. Embed under
**## Architecture deltas**, one subsection per diagram, each with a one-line
plain-English note on what structurally changed (new entity, dropped relation,
moved component).

**If it prints `no architecture diagram changed`, omit the section entirely** —
that is a clean exit (0), not a failure. Do not retry it or diff the `.puml`
files by hand.

Notes:
- The script is a thin orchestrator over `scripts/architecture-diff.sh`,
  `puml_diff.py`, and `scripts/build_pr_gallery.py`. Call it rather than those
  directly, and never copy their logic into the skill — a second fork of the
  review pipeline would drift silently.
- `puml-diff-vs-git.sh` remains the *single-diagram* primitive. Reach for it only
  when you want one specific diagram against an unusual ref.
- Without `plantuml` on PATH the script skips local rendering and says so; fall
  back to the encoded plantuml.com URLs already in `SUMMARY.md`. The section
  survives, but the images then need the network.
- **PR mode:** CI publishes this same gallery to
  `https://victorrentea.github.io/petclinic/pr/<n>/` and links it from a sticky
  comment. Link that page — but still embed the SVGs locally, because the
  published gallery is deleted when the PR closes.
- `pr-diff/` is git-ignored scratch space and safe to regenerate; never commit it.

## Step 2 — Screenshots of impacted screens (only if frontend changed)

If any `petclinic-frontend/src/app/**` files changed, map each changed feature folder
(`owners`, `pets`, `vets`, `visits`, `pettypes`, `specialties`, `invoice`, …) to its
route and capture the current screen.

Pre-check the dev server: `curl -s -o /dev/null -w "%{http_code}" http://localhost:4200/`.
If not `200`, skip this section with the note *"frontend not running — screenshots
skipped (start ./start-frontend.sh)"* and continue; never abort the whole review.

When up, use `chrome-devtools-mcp`: `new_page` → `resize_page` 1280×800 →
`navigate_page` to `http://localhost:4200/<route>` → `take_screenshot` (png) into
`review/assets/<feature>-<state>.png`. One or two shots per impacted feature is
enough. Embed under **## Impacted screens** with a caption naming the route.

## Step 3 — Code-review summary

Run a **read-only** review of the same change set — invoke `/code-review` (no `--fix`,
no `--comment`). Distill its output into **## Code-review findings**: a short table
`severity · file:line · issue → suggestion`, most-severe first, each `file:line`
rendered as an IntelliJ deep-link (see IntelliJ links below). If it's clean, say so.

## Step 4 — Core business logic

Read the diff and identify the **substance** — the rules/decisions that changed, not
the plumbing (DTOs, mappers, imports, formatting). Under **## Core business logic**,
write 2–5 bullets in domain language ("a visit can no longer be booked in the past"),
each backed by a short **code snippet** (the few decisive lines) and an IntelliJ
deep-link to the exact line. This is the section a domain expert reads first.

## Step 5 — Acceptance tests

Find the tests that pin this behavior: backend `*Test.java` /
`petclinic-ui-test/features/**` / frontend `*.spec.ts` touched by or covering the
change. Under **## Acceptance tests**, list each as a deep-linked `file:line` with a
one-line "asserts that …". Then state plainly whether the changed business logic **is
covered** — and call out any behavior from Step 4 with **no** matching test.

## IntelliJ deep-links (use for every code reference)

Format each reference as a Markdown link whose target opens the exact line in IntelliJ:

```
[`Owner.java:42`](jetbrains://idea/navigate/reference?project=petclinic&path=<repo-relative-path>:42)
```

- `project=petclinic` (this repo's IntelliJ project name).
- `path` is **repo-relative** (e.g. `petclinic-backend/src/main/java/.../Owner.java`);
  line number appended after `:` (1-based). Requires JetBrains Toolbox installed.

## Output & wrap-up

- Write everything to `review/review.md`; keep image links **relative** (`assets/…png`)
  so the file is portable. Order sections: scope → Architecture deltas → Impacted
  screens → Code-review findings → Core business logic → Acceptance tests.
- End review.md with a **## Review these first** list: the 2–3 spots most deserving
  human judgment (riskiest change, uncovered logic, deferred finding).
- `review/` is a throwaway artifact — remind the human to delete it (or add to
  `.gitignore`) rather than commit it.
- Print the path to `review/review.md` and offer to open it. Do not commit or push.
