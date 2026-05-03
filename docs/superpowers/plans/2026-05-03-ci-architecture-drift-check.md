# CI Architecture Drift Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions workflow that runs the backend test suite on every push to `main` and every PR, fails the build when hand-edited architecture artifacts (`packages.puml`) drift from code, and silently auto-commits regenerated artifacts under `docs/generated/` when they drift.

**Architecture:** A single workflow file at `.github/workflows/architecture.yml`. Steps: checkout → set up Java 21 with Maven cache → `./mvnw test` (gates on test failures) → check `git diff petclinic-backend/docs/generated` → if dirty and the PR is from a fork, fail with an actionable message; otherwise commit a new commit (no amend) with `[skip ci]` and push back to the branch.

**Tech Stack:** GitHub Actions, `actions/checkout@v4`, `actions/setup-java@v4`, Maven 3.9.6 (via wrapper), Java 21 (Temurin), bash.

**Spec:** `docs/superpowers/specs/2026-05-03-ci-architecture-drift-check-design.md`

**Key file paths used in this plan:**
- New: `.github/workflows/architecture.yml`
- Existing (read-only references): `petclinic-backend/docs/generated/`, `petclinic-backend/docs/packages.puml`, `petclinic-backend/src/test/java/.../architecture/{ArchitectureTest,C4ModelExtractor,DomainModelExtractor}.java`

---

## Task 1: Create the architecture workflow

**Files:**
- Create: `.github/workflows/architecture.yml`

- [ ] **Step 1: Confirm `.github/workflows/` does not already contain an `architecture.yml`**

```bash
ls .github/workflows/architecture.yml 2>&1 || echo "OK: file does not exist yet"
```

Expected: `OK: file does not exist yet` (or `No such file or directory`).

- [ ] **Step 2: Create the workflow file with the full content**

Path: `.github/workflows/architecture.yml`

```yaml
name: Architecture Drift Check

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: write

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          # On pull_request events, head_ref is the PR's source branch.
          # On push events, ref_name is the pushed branch (main).
          ref: ${{ github.head_ref || github.ref_name }}
          # fetch-depth: 0 ensures we have enough history to push back without rejection.
          fetch-depth: 0

      - name: Set up Java 21
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'
          cache: maven

      - name: Run backend tests
        working-directory: petclinic-backend
        run: ./mvnw test

      - name: Detect drift in generated diagrams
        id: drift
        run: |
          if git diff --quiet petclinic-backend/docs/generated; then
            echo "drift=false" >> "$GITHUB_OUTPUT"
          else
            echo "drift=true"  >> "$GITHUB_OUTPUT"
            git --no-pager diff --stat petclinic-backend/docs/generated
          fi

      - name: Fail fork PRs that have drift
        if: steps.drift.outputs.drift == 'true' && github.event.pull_request.head.repo.fork == true
        run: |
          echo "::error::Generated diagrams under petclinic-backend/docs/generated are out of date."
          echo "::error::Run 'cd petclinic-backend && ./mvnw test -Dtest=C4ModelExtractor,DomainModelExtractor' locally and push the regenerated files."
          exit 1

      - name: Auto-commit regenerated diagrams
        if: steps.drift.outputs.drift == 'true' && github.event.pull_request.head.repo.fork != true
        run: |
          git config user.name  'github-actions[bot]'
          git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
          git add petclinic-backend/docs/generated
          git commit -m 'chore(arch): regenerate architecture diagrams [skip ci]'
          git push
```

- [ ] **Step 3: Sanity-check the YAML locally**

If `actionlint` is installed:

```bash
actionlint .github/workflows/architecture.yml
```

Expected: no output (success).

If `actionlint` is not installed, parse the YAML with Python instead:

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/architecture.yml')); print('YAML OK')"
```

Expected: `YAML OK`.

- [ ] **Step 4: Commit the workflow**

```bash
git add .github/workflows/architecture.yml
git commit -m "$(cat <<'EOF'
ci: add architecture drift workflow

Runs backend tests on push-to-main and PRs. Fails the build on
ArchUnit/test failures (hand-edited packages.puml drift). Silently
commits and pushes regenerated artifacts under docs/generated/ back
to the branch when they drift; fork PRs fail with an actionable
message because the workflow has no write access to the fork.
EOF
)"
```

Expected: a single new commit on the current branch.

---

## Task 2: Smoke-test the happy path on `main`

**Files:** None modified — this is purely an observation step.

- [ ] **Step 1: Push the workflow commit to main**

```bash
git push origin main
```

- [ ] **Step 2: Watch the first workflow run finish successfully**

```bash
gh run watch --exit-status $(gh run list --workflow=architecture.yml --branch=main --limit=1 --json databaseId --jq '.[0].databaseId')
```

Expected: workflow completes with status `success`. The `Detect drift in generated diagrams` step prints `drift=false` and the auto-commit step is skipped.

- [ ] **Step 3: Confirm no auto-commit was created**

```bash
git fetch origin main
git log --oneline origin/main -3
```

Expected: the most recent commit is the one you just pushed in Task 1 — no `chore(arch): regenerate architecture diagrams` commit appended.

---

## Task 3: Smoke-test the auto-commit drift path

**Files:** None permanently — this task uses a throwaway branch and an intentional drift trigger.

- [ ] **Step 1: Create a branch and introduce drift**

We need a code change that causes `C4ModelExtractor` or `DomainModelExtractor` to regenerate a different file. Adding a new field to a domain entity is the smallest such change, because it appears in `DomainModel.puml`.

```bash
git checkout -b ci-drift-smoke-test
```

Edit `petclinic-backend/src/main/java/org/springframework/samples/petclinic/model/Specialty.java` and add a String field:

```java
private String description;
```

The file should look like:

```java
package org.springframework.samples.petclinic.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "specialties")
@Getter
@Setter
public class Specialty {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    protected Integer id;

    private String name;

    private String description;
}
```

- [ ] **Step 2: Commit the code change WITHOUT regenerating diagrams locally**

```bash
git add petclinic-backend/src/main/java/org/springframework/samples/petclinic/model/Specialty.java
git commit --no-verify -m "test(ci): add Specialty.description to trigger diagram drift"
```

`--no-verify` skips the local pre-commit hook so we can simulate a developer who never enabled it. The diagrams under `docs/generated/` are now stale relative to the code.

- [ ] **Step 3: Push the branch and open a PR**

```bash
git push -u origin ci-drift-smoke-test
gh pr create --fill --base main
```

- [ ] **Step 4: Watch the workflow regenerate and push back**

```bash
gh run watch --exit-status $(gh run list --workflow=architecture.yml --branch=ci-drift-smoke-test --limit=1 --json databaseId --jq '.[0].databaseId')
```

Expected: workflow status is `success`. The `Auto-commit regenerated diagrams` step ran (visible in step output).

- [ ] **Step 5: Confirm the auto-commit landed on the PR branch and CI did NOT re-trigger**

```bash
git fetch origin ci-drift-smoke-test
git log --oneline origin/ci-drift-smoke-test -3
```

Expected: top commit is `chore(arch): regenerate architecture diagrams [skip ci]` authored by `github-actions[bot]`.

```bash
gh run list --workflow=architecture.yml --branch=ci-drift-smoke-test --limit=5
```

Expected: exactly one workflow run for this branch — the auto-commit's `[skip ci]` token suppressed the second run.

- [ ] **Step 6: Close the PR and delete the branch**

```bash
gh pr close --delete-branch ci-drift-smoke-test
```

Expected: PR closed and branch deleted both locally and on the remote.

---

## Task 4: Smoke-test the test-failure path

**Files:** None permanently — throwaway branch.

- [ ] **Step 1: Create a branch that breaks `ArchitectureTest.diagramPackagesMatchCodePackages`**

```bash
git checkout main
git pull
git checkout -b ci-failure-smoke-test
```

Edit `petclinic-backend/docs/packages.puml` and add a fake stereotype line that does not match any code package. Insert this line after the existing `[Security] <<..security>>` line:

```
[Ghost] <<..ghost>>
```

- [ ] **Step 2: Verify the test fails locally**

```bash
cd petclinic-backend
./mvnw test -Dtest=ArchitectureTest
cd ..
```

Expected: BUILD FAILURE. The output reports `diagramPackagesMatchCodePackages` failed because `ghost` is in the diagram but not in the code.

- [ ] **Step 3: Commit, push, and open a PR**

```bash
git add petclinic-backend/docs/packages.puml
git commit --no-verify -m "test(ci): introduce a fake puml stereotype to fail ArchitectureTest"
git push -u origin ci-failure-smoke-test
gh pr create --fill --base main
```

- [ ] **Step 4: Verify the workflow fails on `Run backend tests`**

```bash
gh run watch --exit-status $(gh run list --workflow=architecture.yml --branch=ci-failure-smoke-test --limit=1 --json databaseId --jq '.[0].databaseId') || true
```

Expected: workflow status is `failure`. The `Run backend tests` step shows the surefire report for `diagramPackagesMatchCodePackages`. The `Detect drift` and subsequent steps were skipped because the previous step failed.

- [ ] **Step 5: Close the PR and delete the branch**

```bash
gh pr close --delete-branch ci-failure-smoke-test
```

---

## Task 5: Document the workflow in AGENTS.md

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Open `AGENTS.md` and find the architecture-tests section**

Look for the bullet list that mentions `ArchitectureTest`, `C4ModelExtractor`, and `DomainModelExtractor`.

- [ ] **Step 2: Append a new bullet describing the CI gate**

Add this bullet at the end of the same list:

```markdown
- **CI:** `.github/workflows/architecture.yml` runs `./mvnw test` on every push to main and every PR. Test failures (e.g., `packages.puml` drift) fail the build. Drift in `docs/generated/` is auto-committed back to the branch with `[skip ci]`; fork PRs fail with an actionable message because the workflow has no write access.
```

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: describe architecture CI gate in AGENTS.md"
git push
```

Expected: `AGENTS.md` updated and pushed to main.

---

## Self-review notes

- Spec coverage:
  - Trigger on push-to-main and PRs → Task 1 step 2 (`on:` block).
  - Fail when hand-edited artifacts drift → Task 1 step 2 (the `Run backend tests` step gates everything; smoke-tested in Task 4).
  - Silently auto-commit regenerated `docs/generated/` → Task 1 step 2 (`Auto-commit regenerated diagrams`); smoke-tested in Task 3.
  - Fork PR handling: fail with message → Task 1 step 2 (`Fail fork PRs that have drift`).
  - Extra commit, no amend → `git commit -m '...'` followed by `git push`, no `--amend` or `--force`.
  - `[skip ci]` to prevent infinite loop → present in the auto-commit message; smoke-tested in Task 3 step 5.
- No placeholders.
- Type/name consistency: workflow step ids and outputs (`steps.drift.outputs.drift`) match between definition and use.
