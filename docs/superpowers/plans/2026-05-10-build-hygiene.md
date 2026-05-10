# Guardrail C: Build Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `ng build` fail on any webpack warning (after eliminating the lone existing protobufjs warning at source) and add a CI Javadoc check.

**Architecture:** Frontend gains `@angular-builders/custom-webpack` + a webpack `ignoreWarnings` rule + a strict-build wrapper script. CI gains two steps: `mvn javadoc:javadoc` and `npm run build`.

**Tech Stack:** `@angular-builders/custom-webpack@^16.0.1`, bash, GitHub Actions, Maven Javadoc plugin (already implicit).

---

## Task 1: Install custom-webpack builder and write the webpack config

**Files:**
- Modify: `petclinic-frontend/package.json`
- Add:    `petclinic-frontend/webpack.config.js`

- [ ] **Step 1: Add the dev dependency**

```bash
npm --prefix petclinic-frontend install --save-dev @angular-builders/custom-webpack@^16.0.1
```

This updates `petclinic-frontend/package.json` and `package-lock.json`. Verify it's in `devDependencies`:

```bash
grep -A1 '"@angular-builders/custom-webpack"' petclinic-frontend/package.json
```

- [ ] **Step 2: Create the webpack config**

Write `petclinic-frontend/webpack.config.js` with exactly:

```js
module.exports = {
  ignoreWarnings: [
    // Transitive via @opentelemetry/api → protobufjs uses dynamic require
    // for an internal "inquire" loader that webpack can't statically resolve.
    // The dynamic path is dead code in our usage; safe to suppress.
    { module: /protobufjs[\\/]+inquire/ },
  ],
};
```

---

## Task 2: Switch angular.json to the custom-webpack builder

**Files:**
- Modify: `petclinic-frontend/angular.json`

- [ ] **Step 1: Replace the build, serve, and test builders**

In `petclinic-frontend/angular.json`, find every occurrence of `"@angular-devkit/build-angular:browser"`. Replace with `"@angular-builders/custom-webpack:browser"`.

For `serve` (uses `dev-server`): replace `"@angular-devkit/build-angular:dev-server"` with `"@angular-builders/custom-webpack:dev-server"`.

For `test` (uses `karma`): replace `"@angular-devkit/build-angular:karma"` with `"@angular-builders/custom-webpack:karma"`.

- [ ] **Step 2: Add `customWebpackConfig` to each `options` block**

Inside the `options` object of every `build`, `serve`, and `test` `architect` entry, add:

```json
"customWebpackConfig": {
  "path": "./webpack.config.js"
}
```

- [ ] **Step 3: Verify**

Run `npm --prefix petclinic-frontend run build:raw 2>&1 | tail -10`. (Note: `build:raw` only exists after Task 3; for now just run `npm --prefix petclinic-frontend run build`.)

Expected output: build succeeds, **no** `Critical dependency` warning about protobufjs.

---

## Task 3: Add the strict-build wrapper

**Files:**
- Modify: `petclinic-frontend/package.json`
- Add:    `petclinic-frontend/scripts/build-strict.sh`

- [ ] **Step 1: Write the wrapper script**

Write `petclinic-frontend/scripts/build-strict.sh` with exactly:

```bash
#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
npm run build:raw 2>&1 | tee "$TMP"
if grep -qE '(^|[[:space:]])Warning:' "$TMP"; then
    echo
    echo "[build-strict] FAIL: ng build produced warnings (see above)." >&2
    exit 1
fi
```

Make it executable:

```bash
chmod +x petclinic-frontend/scripts/build-strict.sh
```

- [ ] **Step 2: Update package.json scripts**

In `petclinic-frontend/package.json`, change:

```json
"prebuild": "npm run generate:api",
"build": "ng build",
```

to:

```json
"prebuild": "npm run generate:api",
"build": "bash scripts/build-strict.sh",
"build:raw": "ng build",
```

- [ ] **Step 3: Smoke test**

```bash
npm --prefix petclinic-frontend run build 2>&1 | tail -5
echo "exit code: $?"
```

Expected: build succeeds, exit code 0, no `[build-strict] FAIL` line.

To test the negative path, temporarily edit `petclinic-frontend/webpack.config.js` to remove the `ignoreWarnings` entry, re-run, observe the failure, then restore.

---

## Task 4: Add the CI steps

**Files:**
- Modify: `.github/workflows/ci-guardrails.yml`

- [ ] **Step 1: Add the strict frontend build step**

After the `Regenerate TS types from openapi.yaml` step, insert:

```yaml
      - name: Strict frontend build
        working-directory: petclinic-frontend
        run: npm run build
```

- [ ] **Step 2: Add the Javadoc step**

After the `Run backend tests` step (and before `Regenerate TS types from openapi.yaml`), insert:

```yaml
      - name: Verify Javadoc
        working-directory: petclinic-backend
        run: ./mvnw -B -ntp -DskipTests -Dmaven.javadoc.failOnError=true javadoc:javadoc
```

- [ ] **Step 3: Verify YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci-guardrails.yml'))" && echo "yaml ok"
```

---

## Task 5: Update GUARDRAILS.md

**Files:**
- Modify: `GUARDRAILS.md`

- [ ] **Step 1: Move row C from 🚧 to ✅**

Delete the row whose first cell is `**C**` from the "🚧 Planned" table.

In the "✅ In place" table, insert a new row after the TS-OpenAPI sync row with these three cells:

- `` **Build hygiene** ``
- `Silent webpack/Javadoc warnings`
- ``Frontend `npm run build` fails on any webpack `Warning:` (custom-webpack + scripts/build-strict.sh; the lone protobufjs transitive-dep warning is suppressed at source via `ignoreWarnings`). CI also runs `mvn javadoc:javadoc -Dmaven.javadoc.failOnError=true`.``

In the 💡 list, add this bullet:

- `**Spring `@ConfigurationProperties` / `@Value` strict-mode.** Considered as part of guardrail C; dropped because Spring does not ship a built-in build-time check for undeclared `@Value` references and an ad-hoc rule is fragile.`

---

## Task 6: Commit and push

- [ ] **Step 1: Commit**

```bash
git add petclinic-frontend/package.json petclinic-frontend/package-lock.json \
        petclinic-frontend/angular.json petclinic-frontend/webpack.config.js \
        petclinic-frontend/scripts/build-strict.sh \
        .github/workflows/ci-guardrails.yml GUARDRAILS.md \
        docs/superpowers/specs/2026-05-10-build-hygiene-design.md \
        docs/superpowers/plans/2026-05-10-build-hygiene.md
git commit -m "feat(guardrail): build hygiene — fail on warnings (frontend) and Javadoc errors (backend)"
```

- [ ] **Step 2: Rebase and push**

```bash
git pull --rebase origin main && git push origin main
```

---

## Self-review notes

**Spec coverage:**
- C1 webpack warning suppression at source → Tasks 1, 2.
- C1 fail-on-warning wrapper → Task 3.
- C2 Javadoc CI step → Task 4 Step 2.
- CI strict frontend build → Task 4 Step 1.
- GUARDRAILS.md update → Task 5.

**Placeholder scan:** none — all snippets concrete.

**Type/name consistency:** `build-strict.sh` path, the `npm run build:raw` script name, and the `webpack.config.js` path are identical across spec, plan, package.json, and the wrapper.
