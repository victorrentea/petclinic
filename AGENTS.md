# AGENTS.md

This file contains **repository-specific instructions** for coding agents working in this repo.
For general project documentation, commands, setup, and architecture overview, see `README.md` and `GUARDRAILS.md`.

## Subfolder-specific instructions

- Backend-specific rules live in `petclinic-backend/AGENTS.md`.

## CI workflow

After every `git push`:

1. Get the latest run ID with `gh run list --branch <branch> --limit 1`
2. Start watching it with `gh run watch <run-id> --exit-status`
3. If CI fails, inspect `gh run view <run-id> --log-failed` and fix task-related failures in the same session

## Task modifiers

- Always use **TDD**: write a failing test first, confirm it fails, then implement.
- Auto-push after commit if git username is `victorrentea` and repo is `github.com/victorrentea/*`.
