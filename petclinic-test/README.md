# PetClinic E2E Tests (Playwright)

TypeScript/Playwright tests for the Owners page.

## Setup (once)

```sh
npm install
npx playwright install chromium
```

## Run

Apps must be running first (`../start-all.sh`), then:

```sh
npm test              # headless
npm run test:ui       # interactive
npm run test:headed   # visible browser
npm run test:debug    # step-through
npm run show-report   # HTML report
npm run test:docker   # fully isolated in Docker
```

> Override frontend URL: `BASE_URL=http://... npx playwright test`
