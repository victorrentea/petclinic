# frontend.md

Guidance for work touching `petclinic-frontend/` or `petclinic-test/`.

## Frontend Commands

```sh
cd petclinic-frontend
npm start                           # Dev server on localhost:4200
npm run build                       # Production build
npm test                            # Karma tests
npm run test-headless               # Headless Chrome tests
npm run lint                        # ESLint
npm run e2e                         # Protractor e2e tests
```

## Frontend Architecture

- Angular 16 SPA
- Angular Material + Bootstrap 3 UI stack
- Frontend services communicate with the backend REST API
- RxJS is used for async flows

## E2E Test Architecture

`petclinic-test/` contains the TypeScript Playwright suite that replaced the older Java Selenium tests.

- Tests live in `tests/` (for example `owners.spec.ts`)
- Page objects live in `tests/pages/`
- Tests expect the frontend at `http://localhost:4200` and the backend at `http://localhost:8080`
- Set `SKIP_SERVER_START=true` when Playwright should reuse already-running apps

Run E2E tests from the repository root:

```sh
./start-tests.sh
```

Or directly:

```sh
cd petclinic-test
npm install
npx playwright install chromium
SKIP_SERVER_START=true npm test
npm run test:ui
```
