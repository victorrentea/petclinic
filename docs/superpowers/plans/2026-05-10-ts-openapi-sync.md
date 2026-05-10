# Guardrail B: TS ↔ OpenAPI Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect drift between `openapi.yaml` and `petclinic-frontend/src/app/generated/api-types.ts` at commit time and in CI; auto-fix where possible.

**Architecture:** Reuse the existing `npm run generate:api` script. Pre-commit regenerates and stages. CI regenerates, fails on drift for fork PRs, auto-commits drift back to main otherwise — matching the existing C4/db.sql pattern.

**Tech Stack:** `openapi-typescript` (already a dev dep), GitHub Actions `setup-node`.

---

## Task 1: Pre-commit hook adds TS regen + stage

**Files:**
- Modify: `.githooks/pre-commit`

- [ ] **Step 1: Append the TS regen block**

Open `.githooks/pre-commit`. After the existing line `git add "$ROOT/petclinic-backend/docs/generated"` and the closing echo, append exactly:

```bash

# ── Frontend: regenerate TS types from openapi.yaml ────────────────────────
if command -v npm >/dev/null 2>&1 && [ -d "$ROOT/petclinic-frontend/node_modules" ]; then
  echo "[pre-commit] Regenerating TS types from openapi.yaml..."
  npm --prefix "$ROOT/petclinic-frontend" run generate:api --silent
  git add "$ROOT/petclinic-frontend/src/app/generated/api-types.ts"
  echo "[pre-commit] api-types.ts regenerated and staged."
else
  echo "[pre-commit] ⚠️  npm or petclinic-frontend/node_modules missing — skipping TS-types regen."
  echo "[pre-commit]    Install with: cd petclinic-frontend && npm install"
fi
```

- [ ] **Step 2: Verify the hook**

Run:
```bash
bash -n .githooks/pre-commit && echo "syntax ok"
```
Expected: `syntax ok`.

- [ ] **Step 3: Smoke-test the regen by hand**

Run:
```bash
npm --prefix petclinic-frontend run generate:api --silent && git status petclinic-frontend/src/app/generated/api-types.ts
```
Expected: command succeeds, working tree shows `api-types.ts` either unchanged or with a tiny diff that you can verify is benign.

---

## Task 2: CI workflow regenerates and auto-commits drift

**Files:**
- Modify: `.github/workflows/ci-guardrails.yml`

- [ ] **Step 1: Add a Setup Node step before the backend test step**

Open `.github/workflows/ci-guardrails.yml`. After the `Set up Java 21` step (around line 24-29) and before the `Install PostgreSQL 16 client` step, insert:

```yaml
      - name: Set up Node 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: petclinic-frontend/package-lock.json

      - name: Install frontend dependencies
        working-directory: petclinic-frontend
        run: npm ci
```

- [ ] **Step 2: Add the regen step after `./mvnw test`**

After the `Run backend tests` step (the one that runs `./mvnw test`), insert:

```yaml
      - name: Regenerate TS types from openapi.yaml
        working-directory: petclinic-frontend
        run: npm run generate:api --silent
```

- [ ] **Step 3: Extend the drift check**

Find the step `name: Detect drift in regenerated artifacts`. Change its `git diff --quiet` line from:
```bash
if git diff --quiet petclinic-backend/docs/generated db.sql; then
```
to:
```bash
if git diff --quiet petclinic-backend/docs/generated db.sql petclinic-frontend/src/app/generated/api-types.ts; then
```
And update the line just below it (the `--stat` echo on drift) similarly to include the same path.

- [ ] **Step 4: Extend the auto-commit step**

Find the step `name: Auto-commit regenerated artifacts`. Change:
```bash
git add petclinic-backend/docs/generated db.sql
```
to:
```bash
git add petclinic-backend/docs/generated db.sql petclinic-frontend/src/app/generated/api-types.ts
```

- [ ] **Step 5: Verify YAML syntax**

Run:
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci-guardrails.yml'))" && echo "yaml ok"
```
Expected: `yaml ok`.

---

## Task 3: Update GUARDRAILS.md

**Files:**
- Modify: `GUARDRAILS.md`

- [ ] **Step 1: Move row B from 🚧 to ✅**

Delete the row whose first cell is `**B**` from the "🚧 Planned" table.

In the "✅ In place" table, insert a new row after `JpaSchemaValidateTest` with these three cells:
- `` **TS ↔ OpenAPI sync** ``
- `Frontend stale generated types`
- ``Pre-commit and CI both run `npm run generate:api`; resulting `petclinic-frontend/src/app/generated/api-types.ts` is auto-staged locally and auto-committed by CI on drift, matching the C4/db.sql pattern.``

- [ ] **Step 2: Verify**

Run:
```bash
grep -A1 "TS ↔ OpenAPI" GUARDRAILS.md
```
Expected: row appears in the in-place table.

---

## Task 4: Commit and push

- [ ] **Step 1: Stage and commit**

```bash
git add .githooks/pre-commit .github/workflows/ci-guardrails.yml GUARDRAILS.md \
        docs/superpowers/specs/2026-05-10-ts-openapi-sync-design.md \
        docs/superpowers/plans/2026-05-10-ts-openapi-sync.md
git commit -m "feat(guardrail): TS ↔ OpenAPI sync — regen api-types.ts in pre-commit and CI"
```

The pre-commit hook will exercise itself, including the new TS regen block. Pass is required.

- [ ] **Step 2: Rebase and push**

```bash
git pull --rebase origin main && git push origin main
```

CI will run the new guardrail on this very push and either confirm clean or auto-commit the regenerated `api-types.ts` back to main.

---

## Self-review notes

**Spec coverage:**
- Pre-commit regen + stage → Task 1
- CI Setup Node + ci + regen → Task 2 Steps 1, 2
- Drift check extended → Task 2 Step 3
- Auto-commit extended → Task 2 Step 4
- GUARDRAILS.md update → Task 3

**Placeholder scan:** none — all bash and YAML snippets are concrete.

**Type/name consistency:** path `petclinic-frontend/src/app/generated/api-types.ts` is identical across pre-commit hook, CI workflow drift check, CI auto-commit step, GUARDRAILS.md row, and the spec.
