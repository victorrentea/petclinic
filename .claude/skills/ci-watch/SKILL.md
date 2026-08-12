---
name: ci-watch
description: Watch the GitHub Actions run for a pushed commit and repair the build if it goes red — read the failing job logs, diagnose, fix, commit, push, and keep going until CI is green. Use after a push, when asked "is CI green", "did the build pass", "watch the CI", "fix the build", or when a push-landed tripwire hands over a SHA. Also covers what does NOT count as a red build (cancelled runs, Actions outages, transient gh errors).
allowed-tools: Bash(.claude/skills/ci-watch/scripts/watch-ci.sh:*), Bash(gh:*), Bash(git:*)
---

# Watch the CI, and fix it when it breaks

`scripts/watch-ci.sh [sha]` blocks until the `ci.yml` run for a commit reaches a
verdict, then **encodes that verdict as its exit status**. The SHA defaults to `HEAD`.

```sh
.claude/skills/ci-watch/scripts/watch-ci.sh              # HEAD
.claude/skills/ci-watch/scripts/watch-ci.sh 3c7c5cf9     # a specific commit
```

**Never `&` it and never discard its exit status** — the exit status *is* the verdict.
Beyond that, how you run it depends on which agent you are, because only one of the
two can be woken up again:

- **Claude Code** — launch it as a **background Bash task** (`run_in_background: true`)
  and keep working. It polls for minutes; blocking on it wastes the whole wait, and the
  harness re-invokes you when it exits.
- **Copilot CLI** — run it in the **foreground and wait**. There is no
  background-completion callback, so a backgrounded watch would simply lose its exit
  status. The shell tool caps a command at **~3 min** and then hands control back with
  the process *still running* — that is not a verdict. Keep reading the command's
  output until it actually exits, and do not substitute a one-shot `gh run view` poll
  for it. A `ci.yml` run takes ~5 min, so expect at least one such continuation.

### Why a background Bash task and not a Monitor (Claude Code)

Monitor is for *streams* — one notification per occurrence. This script produces
exactly **one** verdict and exits, which is the case Monitor's own guidance sends to
`run_in_background`. Three reasons it stays that way:

- **The verdict is the exit status, not a stdout line.** Monitor treats stdout as the
  event stream and only reports the exit code in passing; the whole `0 = green /
  non-zero = repair` contract needs that status handed back.
- **A Monitor filter can go silent on failure** — grep for the success marker and a
  crash looks identical to "still running." This script always prints a terminal line
  and always exits.
- **Monitor times out at 5 min by default (1 h max).** A `ci.yml` run with the Sonar
  gate can outlast that.

Streaming per-job results as they land *would* be a legitimate Monitor use, and would
surface a failure earlier — but it would also invite acting on a partial signal (a job
that fails then passes on retry, a supersede-cancel), which is exactly what the
false-red guarding below exists to prevent. One authoritative verdict is the point.

## The three verdicts

| Exit | Output | What you must do |
|---|---|---|
| `0` | `CI passed for <sha>` | Report it. Done. |
| **non-zero** | `CI FAILED (<conclusion>)` | **Repair the build.** See below. |
| `0` | anything starting `⚠️` | **Not** a verdict. Do *not* repair, do *not* claim green. |

That third row is the one that matters, and it is why the exit status is not simply
`gh run watch`'s. A **false red is far more damaging than a false green**: it sends
you off "fixing" a perfectly healthy build and pushing changes nobody asked for. So
the script refuses to report red unless GitHub gives an authoritative failing
conclusion. These are all `⚠️` non-verdicts, never red:

- **`cancelled`** — almost always a newer push superseding the run (concurrency
  cancel), or a manual cancel. Not a build failure.
- **No job ever started** (no runner assigned, zero steps) — an Actions capacity or
  outage problem. Zero steps ran, so no gate evaluated the code; there is nothing
  to repair.
- **Empty or unknown conclusion** — a transient `gh` problem (401, network, rate
  limit), not a build result.
- **`ci.yml` never started** within ~2 min — the commit is simply *unverified*. Not
  green, not red. Re-run the script later, or `gh workflow run ci.yml`.

`ci.yml` is the only gate that counts. A push fires several workflows
(`pages-mirror`, `diagram-preview`, GitHub's implicit `pages-build-deployment`), and
an unscoped `gh run list` returns whichever registered first — that produced a real
**false green** on 2026-08-06, reporting success off `pages-build-deployment` while
`ci.yml` had not started at all. Every lookup in the script is scoped to `ci.yml`
on purpose. Do not "simplify" that away.

## When it goes red

Repair it **automatically — do not ask for permission**, and repair it **even if
somebody else broke it**. Any red build you catch is yours to fix.

1. **Read the actual failure**, don't guess:
   ```sh
   gh run view <run-id> --log-failed
   ```
2. **Diagnose the root cause.** A failing assertion is a real signal — fix the code,
   not the test, unless the test is provably wrong. Do not delete, skip, or loosen a
   test to get green; that is defeating the gate, not repairing it.
3. **Reproduce locally when it's cheap** (`mvn test -Dtest=...`, `npm test`). Beware
   the traps in the project's CLAUDE.md — never run `mvn test` while IntelliJ is
   building, and remember `-Dtest=...` makes coverage look falsely low.
4. **Fix, commit, push.** The push re-arms the tripwire, which hands you a fresh SHA —
   so a new watch starts on its own. Don't hand-roll a second watch for the same push.
5. **Loop until green**, reporting what you changed each round.

If two rounds fail to move the failure, stop and surface it rather than pushing a
third speculative fix — a build that resists two informed attempts usually needs a
decision, not another commit.

Bear in mind the Sonar gate in `ci.yml` is what actually fails builds on coverage
(`new_coverage` 80%), and a local `mvn test` never checks it — so "tests pass
locally" is not evidence the build is repaired.

## How this gets triggered

`.claude/hooks/watch-ci-after-push.sh` is a post-tool-use tripwire on shell commands.
**One script serves both agents**, registered twice:

| Agent | Registered in | Invoked as |
|---|---|---|
| Claude Code | `.claude/settings.json` → `PostToolUse` / `Bash` | `watch-ci-after-push.sh` |
| Copilot CLI | `.github/hooks/watch-ci-after-push.json` → `postToolUse` | `watch-ci-after-push.sh --copilot` |

All the detection is shared; `--copilot` only swaps the JSON envelope (Copilot takes
`additionalContext` at the top level, Claude nests it under `hookSpecificOutput`) and
the one sentence about foreground-vs-background above. Copilot finds this skill through
`.github/skills` → `../.claude/skills`, so there is a single copy of everything.

The tripwire does **not** parse your command to decide whether you pushed; it reads the
reflog on the upstream remote-tracking ref, which is authoritative — a push from the
*other* petclinic checkout never touches this repo's reflog — and it de-dupes per
delivered SHA, so several tool calls after one push start exactly one watch. The de-dupe
stamp is per-agent (`.git/pushwatch-last-sha.<agent>`), so a Claude session and a Copilot
session in the same checkout don't mute each other.

The tripwire hands over the SHA and the one-line command; it deliberately does **not**
inline this repair protocol, because the green path is the common one and does not
need it. Consult this skill when the watch comes back red, or when driving a watch
by hand.
