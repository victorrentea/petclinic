---
description: Autonomous CI fixer for the main branch. Loops until CI is green, fixing failures each iteration.
---

You are a remote autonomous agent fixing the CI build on https://github.com/victorrentea/petclinic (branch: main).

**CRITICAL: Do NOT end your turn until you have personally observed a CI run complete with every step green.
Pushing a fix and reporting "CI should be green" is NOT acceptable. You must wait for the run to finish and verify it yourself.
Loop indefinitely: check → fix → push → wait (subscribe to PR) → verify green → loop if not.**

## Step 1 — Get the latest CI run

Use `mcp__github__list_commits` to get the latest commit SHA on main, then use
`mcp__github__pull_request_read` with `get_check_runs` on any open PR, or check commit
status via the GitHub API to find the latest workflow run conclusion.

If you cannot determine the run status via MCP tools, fall back to reading the
`petclinic-frontend/coverage/lcov.info` or recent git log to infer what happened.

## Step 2 — Evaluate

- **Conclusion is `success` AND workflow contains a `npm run test-headless` step** →
  print `CI is green and Angular tests are wired up. Nothing to do.` and STOP.
- **Still in progress / queued** → wait (subscribe or poll), then re-evaluate.
- **Failed** → continue to Step 3.

## Step 3 — Diagnose the failure

Pull failure logs using any available GitHub MCP tool or API.

Known failure patterns and their fixes:

| Pattern | Fix |
|---|---|
| `SonarCloud Quality Gate` fails `new_coverage < 80%` | Add/improve tests; ensure `sonar.javascript.lcov.reportPaths` is set and the Angular test step runs with `--code-coverage` |
| `SonarCloud Quality Gate` fails `new_duplicated_lines_density > 3%` | Refactor duplicated code; do NOT add `continue-on-error: true` |
| Angular test step missing | Add before `Strict frontend build`: `npm run test-headless -- --code-coverage` |
| Compilation / build error | Read the log, fix the source, run locally if possible |
| Any other failure | Read the log, identify root cause, apply minimal targeted fix |

**Never** add `continue-on-error: true` to bypass a quality gate — fix the root cause.

## Step 4 — Fix

Apply a minimal, targeted fix. Constraints:

- Never push to main with `--force`.
- Never skip hooks (`--no-verify`).
- Do NOT touch generated artifacts: `openapi.yaml`,
  `petclinic-frontend/src/app/generated/api-types.ts`.
- If multiple things are broken, fix the most fundamental one per iteration.

## Step 5 — Commit and push

```bash
git add <changed files>
git -c user.email=noreply@anthropic.com -c user.name='Claude Remote Agent' \
  commit -m 'ci: <concise description of fix>'
git push -u origin main
```

If push is rejected (someone else pushed), `git pull --rebase` and retry once.

## Step 6 — Wait for CI

After pushing, wait for the new CI run to complete:

- If an open PR exists that tracks main, use `mcp__github__subscribe_pr_activity` to
  receive CI events, then re-evaluate in Step 2 when a `check_run` event arrives.
- Otherwise, poll `mcp__github__get_commit` or equivalent until the check state
  transitions from `pending`/`in_progress` to `success` or `failure`.

## Step 7 — Loop

Go back to Step 2. Do not stop until CI is green.

## Final status line

When done (CI green), print exactly one line:

> CI is green. Last fix: <one-sentence summary> | Run: <run id or commit SHA>
