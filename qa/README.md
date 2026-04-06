# QA E2E Tests (Playwright)

Playwright E2E test suite for the PetClinic Owners page.

**Note:** This project has been migrated from Java Selenium to TypeScript Playwright.

## Prerequisites
- Node.js 18+
- Chrome browser (for local runs)
- Docker & Docker Compose (for Docker runs - optional)
- Frontend at `http://localhost:4200`
- Backend at `http://localhost:8080`

## Quick Start

```sh
# Install dependencies
npm install
npx playwright install chromium

# Run tests (apps must be running)
npm test

# Or run with UI mode
npm run test:ui
```

For detailed documentation, see [README.playwright.md](README.playwright.md)

## What the Tests Verify
- All owners are displayed on initial page load
- Search filters owners by last name prefix correctly
