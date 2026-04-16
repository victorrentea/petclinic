---
description: Commit and push immediately with no intermediate approvals.
argument-hint: Optional commit intent (for example: "fix owners pagination bug").
---
Execute a fast, non-interactive commit-and-push flow now.

Rules:
1. Do not ask for confirmation.
2. If there are no local changes, stop and report "No changes to commit."
3. Stage everything with `git add -A`.
4. Build a concise Conventional Commit message from the actual staged diff.
   - Prefer scope when obvious (for example: `feat(frontend): ...`, `fix(backend): ...`).
   - If the user provided intent text, incorporate it in the subject.
5. Commit with that message.
6. Push immediately to the current branch (`git push`).
7. Return exactly:
   - branch name
   - commit hash
   - commit message
   - push result

Safety constraints:
- Never run destructive git commands.
- Never amend existing commits unless explicitly requested.
- Never include secrets in commit messages.
