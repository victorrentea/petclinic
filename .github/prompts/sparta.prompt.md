---
mode: agent
description: Run all tests and, if green, commit and push to master with a conventional commit message
---

Run all tests across the full stack:

1. **Backend unit tests**: run `./mvnw test` in `petclinic-backend/`
2. **Frontend unit tests**: run `npm run test-headless` in `petclinic-frontend/`

If **any** test fails, stop immediately and report the failures — do NOT commit or push.

If **all** tests pass:
- Stage all uncommitted changes: `git add -A`
- Inspect the diff with `git diff --cached` to understand what changed
- Write a commit message following [Conventional Commits](https://www.conventionalcommits.org/):
  - Format: `<type>(<scope>): <short summary>`
  - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`, `perf`
  - Scope: the affected module or layer (e.g. `owner`, `visit`, `frontend`, `e2e`)
  - Example: `feat(owner): add phone number validation`
- Commit: `git commit -m "<message>"`
- Push to master: `git push origin master`

Report the final commit hash and message after a successful push.

