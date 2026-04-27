# AGENTS.md

Guidance for work touching `petclinic-test/`.

## E2E Test Architecture

`petclinic-test/` contains the TypeScript Playwright suite that replaced the older Java Selenium tests.

- Tests live in `tests/` (for example `owners.spec.ts`)
- Page objects live in `tests/pages/`
- Tests expect the frontend at `http://localhost:4200` and the backend at `http://localhost:8080`
- Set `SKIP_SERVER_START=true` when Playwright should reuse already-running apps

## Commands

From the repository root:

```sh
./start-tests.sh
```

Directly from `petclinic-test/`:

```sh
npm install
npx playwright install chromium
SKIP_SERVER_START=true npm test
npm run test:ui
```
