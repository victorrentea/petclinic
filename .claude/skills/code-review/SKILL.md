---
name: code-review
description: Review the current diff via the review-boss agent, auto-apply the safe quality cleanups, then tell the human which areas to review first. Explicit invocation only — user types /code-review.
disable-model-invocation: true
---

# /code-review — review, fix, hand off

Run a quality review of the **current uncommitted changes**, apply the low-risk
fixes yourself, and end by pointing the human at what still needs their eyes.

## Steps

1. **Confirm there's something to review.** Run `git --no-pager diff --stat HEAD`.
   If empty, say "Nothing to review." and stop.

2. **Get the report.** Spawn the `review-boss` agent (Agent tool, `subagent_type:
   review-boss`) with: *"Review the current working-tree diff and return your
   aggregated findings grouped by dimension (Reuse / Simplification / Efficiency)."*
   review-boss fans out to its three reviewers in parallel and returns one report.

3. **Triage each finding:**
   - **Auto-fix** — mechanical, low-risk, clearly correct (dead code, obvious
     duplication, a needless allocation, a trivially simpler form). Apply it.
   - **Defer to human** — anything ambiguous, behavior-changing, or a judgment
     call. Leave it untouched.
   This is **quality only** — do not chase correctness bugs here; if you happen to
   spot one, just note it for the human.

4. **Apply the safe fixes** and keep a short list of what you changed (file + what).

5. **Hand off (the important part).** End your response with this section, ordered
   by risk — widest blast radius and deferred findings first:

   ```
   ## Review these first (human)
   - <file:area> — <why it needs human judgment: deferred finding / risky change / high blast radius>
   ```

   Be specific about files and why. If nothing needs human review, say so explicitly.

## Output shape
1. One-line summary: `N findings · auto-fixed X · deferred Y`.
2. What you auto-fixed (bullets with paths).
3. The **Review these first (human)** section.

Do not commit or push — leave that to the human.
