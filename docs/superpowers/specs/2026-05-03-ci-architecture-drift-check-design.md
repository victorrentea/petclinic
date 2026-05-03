# CI Architecture Drift Check — Design

**Date:** 2026-05-03
**Status:** Proposed

## Problem

Architecture diagrams under `petclinic-backend/docs/generated/` are produced by JUnit tests (`C4ModelExtractor`, `DomainModelExtractor`). A developer who modifies the codebase but does not run those tests can land on `main` without regenerating the diagrams, leaving the version on GitHub silently out of sync with the code.

The hand-written `petclinic-backend/docs/packages.puml` has a separate failure mode: if its package stereotypes diverge from the actual code packages, `ArchitectureTest` already fails the build locally — but only when someone runs the test.

We need a remote enforcement mechanism that:

1. Runs the full backend test suite on every push to `main` and every pull request.
2. **Fails** the build when a hand-edited artifact (notably `packages.puml`) is wrong — a human must fix it.
3. **Silently auto-corrects** generated artifacts that have drifted, without blocking the merge.

## Design

### Single GitHub Actions workflow: `.github/workflows/architecture.yml`

**Triggers:**

- `push` to `main`
- `pull_request` (any target branch)

**Permissions:** `contents: write` (needed to push regenerated artifacts back).

**Steps:**

1. **Checkout.** For PRs, check out the PR head branch (`ref: ${{ github.head_ref }}`) so we can push back to it. For pushes to main, default `ref` is fine.
2. **Set up Java 21 (Temurin) with Maven cache** via `actions/setup-java@v4`.
3. **Run `cd petclinic-backend && ./mvnw test`.**
   - If `ArchitectureTest` (or any other test) fails → the workflow fails. The PR cannot be merged; pushes to main are flagged red.
4. **Detect drift:** `git diff --quiet petclinic-backend/docs/generated`.
   - **Exit code 0 (clean):** done.
   - **Exit code 1 (dirty):**
     a. Configure git user as `github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>`.
     b. **For fork PRs:** the workflow has no write access to the fork's branch. Fail the step with a clear message: *"Generated diagrams are out of date. Run `cd petclinic-backend && ./mvnw test -Dtest=C4ModelExtractor,DomainModelExtractor` locally and push the changes."* This applies when `github.event.pull_request.head.repo.fork == true`.
     c. **Otherwise:** stage `petclinic-backend/docs/generated`, commit as a **new** commit (no amend, no force-push) with message `chore(arch): regenerate architecture diagrams [skip ci]`, and push to the branch. The `[skip ci]` token prevents an infinite loop by suppressing the next workflow run.

### Why this shape

- **Tests run first, drift check second.** If tests fail, the diagrams might be invalid anyway; we don't want to push half-baked artifacts.
- **`[skip ci]` on the auto-commit** keeps the workflow from re-triggering itself.
- **Extra commit, not amend.** Amending would rewrite a commit the developer has already pushed, force a push, and break local checkouts. An additional commit is non-destructive and visible in PR history.
- **Fail loudly for forks.** Auto-push needs write access to the source branch; forks are read-only from the upstream's perspective. Failing with an actionable message preserves the contract that `main` and PR branches always match the code.

## Out of scope

- Branch protection rules (must be configured by a repo admin via GitHub UI).
- Renaming the auto-commit author or signing the auto-commit.
- Frontend tests / build (this workflow is backend-only).
- Caching the PlantUML PNG renderer; relies on Maven cache hit.

## Files affected

- **New:** `.github/workflows/architecture.yml`.
- **No code changes** in the backend tests or the existing pre-commit hook — both stay as-is. The pre-commit hook keeps its role as a fast local convenience; the CI workflow is the authoritative gate.

## Open questions

None at design time.
