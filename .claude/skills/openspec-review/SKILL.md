---
name: openspec-review
description: Use when openspec artifacts were just generated (after propose) or before implementation starts (before apply). Spawns an isolated subagent to review proposal, design, and tasks for internal consistency and flags serious issues before coding begins.
---

# OpenSpec Artifact Review

## Overview

Before touching code, an isolated subagent reviews the three artifact files for internal consistency. BLOCKING issues pause the flow; NOTEs are shown but don't stop progress.

## Steps

1. **Get artifact paths**
   ```bash
   openspec status --change "<name>" --json
   ```
   From the JSON, find paths for all artifacts with `status: "done"`.

2. **Read each artifact file** (proposal.md, design.md, tasks.md or schema equivalents)

3. **Spawn review subagent**

   Use the **Agent tool** with `subagent_type: "general-purpose"` and `model: "opus"`. Tell the subagent to do research only — no file edits. Pass the full content of all artifact files in the prompt.

   **Review prompt to send:**
   ```
   You are reviewing OpenSpec artifacts for internal consistency BEFORE implementation.
   Do NOT edit any files. Research only.

   Review these artifacts and check for:
   - ALIGNMENT: Does the design address every goal stated in the proposal?
   - COVERAGE: Do the tasks implement all design decisions? Any missing steps?
   - CONTRADICTIONS: Conflicting statements between files?
   - GAPS: Unaddressed risks, unclear ownership, ambiguous acceptance criteria?
   - FEASIBILITY: Vague or technically risky tasks?

   Rate each finding:
   - BLOCKING — must be fixed before coding starts
   - NOTE — minor, advisory only

   Format findings as:
   [BLOCKING] <one-sentence description>
   [NOTE] <one-sentence description>

   Maximum 6 findings. If no issues: reply "No issues found."
   ```

4. **Present findings**

   - If **any BLOCKING** findings: display them prominently, then ask the user:
     > "Found blocking issues in the design artifacts. Fix them now, or proceed anyway?"
     Use AskUserQuestion with options: "Fix artifacts first" / "Proceed anyway"
     If user chooses "Fix artifacts first": STOP here. User should update artifacts and re-run propose or continue.

   - If **only NOTEs**: show them briefly (collapsed if > 3), then continue.

   - If **no issues**: say "Review passed — no inconsistencies found." and continue.

## Guardrails

- Subagent must NOT modify any files
- Keep total review output under 250 words
- Do NOT invent issues — only flag clear problems evident from the artifact text
- If artifacts are missing or incomplete, report that instead of reviewing
