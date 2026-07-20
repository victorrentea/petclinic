---
name: multi-review
description: Review the current diff — first a cheap deterministic SonarQube-in-Docker pre-pass (fix + re-scan until clean), then fan out to three single-focused reviewer subagents in parallel, auto-apply the safe quality cleanups, and tell the human which areas to review first. Explicit invocation only — user types /multi-review.
---

# /multi-review — review, fix, hand off

Run a quality review of the **current uncommitted changes**, apply the low-risk
fixes yourself, and end by pointing the human at what still needs their eyes.

## Steps

1. **Confirm there's something to review.** Run `git --no-pager diff --stat HEAD`.
   If empty, say "Nothing to review." and stop.

2. **Cheap deterministic pre-pass FIRST — exhaust SonarQube before spending tokens on the LLM reviewers.**
   Run `.claude/skills/multi-review/sonar-diff-review.sh` (boots a reused SonarQube
   container in Docker and scans only the changed backend Java files). Then loop on
   its **exit code**:
   - **exit 0** (Sonar clean, or nothing for it to scan) → the cheap pre-pass is done;
     go to step 3 (the LLM reviewers).
   - **exit 2** (Sonar found issues) → read its printed findings and
     `petclinic-backend/target/sonar-diff-review.json`. **Fix** the clearly-safe /
     mechanical ones (same auto-fix-vs-defer triage as step 4); leave genuine
     judgment calls for the human. Then **re-run the script** to confirm. Repeat this
     fix→re-scan loop until Sonar reports exit 0 (or only human-deferred issues remain
     — cap at 3 iterations, then move on and list the rest for the human).
   - **exit 1** (Sonar could not run — e.g. Docker down / disk full) → note it briefly
     and continue to step 3 anyway; never block the review on Sonar infrastructure.
   Do not fix anything beyond what Sonar flagged during this pre-pass.

3. **Fan out in parallel.** In ONE message, make THREE `Agent` calls at once (so they
   run concurrently — never one after another): `reviewer-reuse`,
   `reviewer-simplification`, `reviewer-efficiency`. Give each the same task:
   *"Review the current working-tree change (`git --no-pager diff HEAD`) for your single
   dimension. Return findings as a short list of `file:line — issue → suggestion`. If clean, say so."*
   Collect the three results into one set of findings grouped by dimension
   (Reuse / Simplification / Efficiency), dropping duplicates.

4. **Triage each finding:**
   - **Auto-fix** — mechanical, low-risk, clearly correct (dead code, obvious
     duplication, a needless allocation, a trivially simpler form). Apply it.
   - **Defer to human** — anything ambiguous, behavior-changing, or a judgment
     call. Leave it untouched.
   This is **quality only** — do not chase correctness bugs here; if you happen to
   spot one, just note it for the human.

5. **Apply the safe fixes** and keep a short list of what you changed (file + what).

6. **Hand off (the important part).** End your response with this section, ordered
   by risk — widest blast radius and deferred findings first:

   ```
   ## Review these first (human)
   - <file:area> — <why it needs human judgment: deferred finding / risky change / high blast radius>
   ```

   Be specific about files and why. If nothing needs human review, say so explicitly.

## Output shape
1. One-line summary: `Sonar: S issues fixed over R rounds · N LLM findings · auto-fixed X · deferred Y`.
2. What you auto-fixed (bullets with paths), separating the Sonar pre-pass fixes from the LLM-review fixes.
3. The **Review these first (human)** section.

Do not commit or push — leave that to the human.
