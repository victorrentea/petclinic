# Guardrail D: Dependency Upgrade Discipline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix `dependabot.yml` to actually open weekly batched PRs for every ecosystem in the repo.

**Architecture:** Pure GitHub config — no CI, no app install, no scanner. Built-in Dependabot security alerts cover CVEs.

---

## Task 1: Rewrite `dependabot.yml`

**Files:**
- Modify: `.github/dependabot.yml`

- [ ] **Step 1: Replace contents**

Overwrite `.github/dependabot.yml` with:

```yaml
version: 2
updates:
  - package-ecosystem: "maven"
    directory: "/petclinic-backend"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "Etc/UTC"
    labels:
      - "dependencies"
      - "backend"
    reviewers:
      - "victorrentea"
    open-pull-requests-limit: 5
    groups:
      backend-minor-patch:
        patterns: ["*"]
        update-types:
          - "minor"
          - "patch"

  - package-ecosystem: "maven"
    directory: "/petclinic-database"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "Etc/UTC"
    labels:
      - "dependencies"
      - "database"
    reviewers:
      - "victorrentea"
    open-pull-requests-limit: 5
    groups:
      database-minor-patch:
        patterns: ["*"]
        update-types:
          - "minor"
          - "patch"

  - package-ecosystem: "npm"
    directory: "/petclinic-frontend"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "Etc/UTC"
    labels:
      - "dependencies"
      - "frontend"
    reviewers:
      - "victorrentea"
    open-pull-requests-limit: 5
    groups:
      frontend-minor-patch:
        patterns: ["*"]
        update-types:
          - "minor"
          - "patch"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "Etc/UTC"
    labels:
      - "dependencies"
      - "ci"
    reviewers:
      - "victorrentea"
    open-pull-requests-limit: 5
    groups:
      actions-minor-patch:
        patterns: ["*"]
        update-types:
          - "minor"
          - "patch"
```

- [ ] **Step 2: Validate YAML syntax**

Run:
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/dependabot.yml'))" && echo "yaml ok"
```
Expected: `yaml ok`.

---

## Task 2: Update GUARDRAILS.md

**Files:**
- Modify: `GUARDRAILS.md`

- [ ] **Step 1: Move row D from 🚧 to ✅**

Delete the row whose first cell is `**D**` from the "🚧 Planned" table. The 🚧 table will then be empty — replace it with a one-line note: `_All planned guardrails landed. New ideas live in 💡 below._`

In the "✅ In place" table, add a new row after `Build hygiene` with these three cells:
- `` **Dependency upgrade discipline** ``
- `Drive-by upgrades / known-CVE deps`
- ``Dependabot opens weekly batched (minor+patch) PRs per ecosystem (`/petclinic-backend`, `/petclinic-database`, `/petclinic-frontend`, `/`); major upgrades arrive as separate PRs. CVEs surface as GitHub Dependabot security alerts (built-in, public-repo).``

- [ ] **Step 2: Verify**

```bash
grep -A1 "Dependency upgrade discipline" GUARDRAILS.md
```

---

## Task 3: Commit and push

- [ ] **Step 1: Commit**

```bash
git add .github/dependabot.yml GUARDRAILS.md \
        docs/superpowers/specs/2026-05-10-dependency-discipline-design.md \
        docs/superpowers/plans/2026-05-10-dependency-discipline.md
git commit -m "feat(guardrail): weekly batched dependency upgrades via Dependabot"
```

- [ ] **Step 2: Push**

```bash
git pull --rebase origin main && git push origin main
```

After push, Dependabot picks up the new config within minutes; first batch of PRs opens on the next scheduled Monday.

---

## Self-review notes

- All four ecosystems covered (matches what's actually in the repo).
- Same schedule for all → easy to remember "Monday morning is dependency-PR review time."
- `open-pull-requests-limit: 5` keeps a runaway day from flooding the inbox if many majors release at once.
- Reviewer assignment is `victorrentea` (single user); change if a team becomes the owner.
- No CI changes → no risk of breaking existing pipelines.
