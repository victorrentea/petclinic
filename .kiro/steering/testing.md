---
inclusion: auto
name: testing
description: Testing guidelines for features spanning backend and frontend. Enforces end-to-end Playwright smoke tests for any full-stack feature.
---

# Testing: Full-Stack Features Require E2E Proof

Any feature touching both backend and frontend is NOT done until a Playwright smoke test passes in the browser.

## The Rule

Write at least one `petclinic-ui-test/tests/<feature>.spec.ts` that:
1. Navigates to the screen
2. Clicks/fills to trigger the feature
3. Asserts the visible result on the page

## Process

Before automating: open the page in the browser, confirm it works visually, identify selectors. Then write the test.

## Conventions

- Location: `petclinic-ui-test/tests/`
- Use Page Object pattern (`tests/pages/`)
- Use `ApiClient` helper for API-level setup (`tests/support/api-client.ts`)
- Both apps must be running (frontend :4200, backend :8080)
- Run: `npm test` from `petclinic-ui-test/`

## Skip only if

- Change is backend-only or frontend-only cosmetic — document why no e2e test.
