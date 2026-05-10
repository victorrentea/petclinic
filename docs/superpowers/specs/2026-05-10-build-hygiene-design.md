# Guardrail C: Build Hygiene Fail-on-Warnings — Design

**Date:** 2026-05-10
**Status:** Approved for planning

## Goal

Stop silent quality regressions slipping into the codebase via warnings nobody reads. Currently `ng build` exits 0 with a known transitive warning; that warning is invisible in CI logs and conditions every reader to ignore future warnings.

## Scope

Two independent sub-guardrails. Spring `@ConfigurationProperties` strict mode considered earlier is dropped — Spring does not ship a built-in build-time check for undeclared `@Value` references and a half-baked rule is worse than none.

### C1: Frontend — `ng build` fails on any warning

Eliminate the existing protobufjs warning at source via webpack `ignoreWarnings`, then add a wrapper script that fails the build when any `Warning:` line appears in `ng build` output.

### C2: Backend — `mvn javadoc:javadoc` fails on Javadoc errors

CI-only step that runs `./mvnw javadoc:javadoc` with `failOnError=true`. Local `mvn test` is untouched.

## Files

### C1 (frontend)

- **Modify** `petclinic-frontend/package.json`:
  - Add devDependency `@angular-builders/custom-webpack` pinned to `^16.0.1` (Angular 16 compatible).
  - Rename script `"build": "ng build"` → `"build:raw": "ng build"`; add `"build": "bash scripts/build-strict.sh"`. The `prebuild` hook (`npm run generate:api`) keeps firing because npm resolves it before `build:strict` runs.
  - Note: the explicit `prebuild` hook only fires for the `build` script name in legacy npm; document that the strict wrapper invokes the underlying `ng build` so types are still regenerated.

- **Modify** `petclinic-frontend/angular.json`:
  - For each project section that has `architect.build.builder`, swap `@angular-devkit/build-angular:browser` → `@angular-builders/custom-webpack:browser` and add `"customWebpackConfig": { "path": "./webpack.config.js" }` under `options`.
  - Same for `architect.serve.builder` and `architect.test.builder` so the suppression applies in dev mode and tests, otherwise local DX shows the warning while CI/build doesn't (inconsistent).

- **Add** `petclinic-frontend/webpack.config.js`:
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

- **Add** `petclinic-frontend/scripts/build-strict.sh` (executable):
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

### C2 (backend)

- **Modify** `.github/workflows/ci-guardrails.yml`:
  - After the existing `Run backend tests` step, add:
    ```yaml
    - name: Verify Javadoc
      working-directory: petclinic-backend
      run: ./mvnw -B -ntp -DskipTests -Dmaven.javadoc.failOnError=true javadoc:javadoc
    ```
  - After the `Regenerate TS types from openapi.yaml` step, add:
    ```yaml
    - name: Strict frontend build
      working-directory: petclinic-frontend
      run: npm run build
    ```

### GUARDRAILS.md

- Move row C from 🚧 to ✅. Drop the explicit "Spring config-properties metadata" mention from the description (no longer in scope).

## What it catches

- ✅ A new transitive dep introduces a webpack warning → frontend build fails.
- ✅ Someone hand-edits a `@SuppressWarnings` or removes the protobufjs ignore-rule → drift surfaces immediately.
- ✅ A new `@param` referenced in Javadoc but missing from the method → Javadoc step fails in CI.
- ❌ Logical regressions that don't generate warnings (compile cleanly but behave wrong) — that's what tests are for.

## Cost

- Local `npm run build` adds ~1s wrapper overhead vs. raw `ng build`.
- CI gains ~30s for `mvn javadoc:javadoc` and ~10s for the strict frontend build (the actual `ng build` runs once via the wrapper).

## Non-goals

- Spring `@ConfigurationProperties` strict checking — moved back to 💡 with explicit "no off-the-shelf solution" caveat.
- ESLint warnings-as-errors — Angular 16 already exposes `--max-warnings 0` for that and it is out of scope here (lint is a separate concern from build hygiene).
- Maven plugin upgrades — out of scope.

## Caveats

- `@angular-builders/custom-webpack@^16.0.1` is a community package, not maintained by Google. It is widely used (>1M weekly downloads) and the Angular CLI's official escape hatch for custom webpack config in v16. The dependency upgrade discipline guardrail (D, planned next) will pick this up.
- The `Warning:` grep in the wrapper is intentionally broad. False positives (any literal log line containing `Warning:`) would fail the build — acceptable trade-off since `ng build`'s normal output never contains that string after suppression.
