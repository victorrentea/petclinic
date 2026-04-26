# QA E2E Tests (Playwright)

Playwright E2E test suite for the PetClinic application's Owners page.

## Features

- TypeScript-based Playwright tests
- Page Object Model pattern
- Automatic screenshot capture after each test in `test-results/screenshots/` (git-ignored)
- Multiple execution modes:
  - With applications started automatically
  - Against running applications
  - In Docker containers

## Prerequisites

- Node.js 18+
- Chrome browser (for local runs)
- Docker & Docker Compose (for Docker runs)
- Backend and Frontend applications (when running in-process)

## Installation

```sh
npm install
npx playwright install chromium
```

## Running Tests

### 1. Against Running Applications

If you already have the backend (port 8080) and frontend (port 4200) running:

```sh
npm test
```

### 2. With Auto-Start of Applications

The test suite can automatically start both applications before running tests:

```sh
# This will:
# 1. Start backend on port 8080
# 2. Start frontend on port 4200
# 3. Wait for both to be ready
# 4. Run tests
# 5. Keep apps running (Ctrl+C to stop)
npm run test:with-apps
```

**Note:** Run tests in a separate terminal while apps are running.

### 3. In Docker

Run tests in isolated Docker containers:

```sh
npm run test:docker
```

This will:
- Build backend and frontend Docker images
- Start all services
- Run Playwright tests in a container
- Clean up after completion

### 4. Other Test Modes

```sh
# Interactive UI mode
npm run test:ui

# Headed mode (see browser)
npm run test:headed

# Debug mode (step through tests)
npm run test:debug

# View HTML report
npm run show-report
```

## Custom Configuration

You can override the default URLs:

```sh
# For local runs
BASE_URL=https://your-frontend npx playwright test

# For Docker runs (edit docker-compose.test.yml)
```

## Test Structure

```
tests/
├── pages/
│   └── OwnersPage.ts          # Page Object Model
├── support/
│   └── api-client.ts          # API helper for backend calls
└── owners.spec.ts             # Test specifications
```

## What the Tests Verify

1. **Initial Load**: All owners from the backend API are displayed on the page
2. **Search Filter**: Filtering by last name prefix shows only matching owners

## Screenshots

After each test run, screenshots are automatically saved to:
```
test-results/screenshots/
```

This directory is git-ignored. Screenshots include:
- Full page capture
- Timestamp in filename
- Test name in filename

## Troubleshooting

### Tests Fail to Connect

Ensure applications are running:
```sh
# Backend
curl http://localhost:8080/api/owners

# Frontend
curl http://localhost:4200
```

### Port Already in Use

If ports 8080 or 4200 are in use, stop existing processes or configure different ports.

### Docker Issues

```sh
# Clean up Docker resources
docker-compose -f docker-compose.test.yml down -v

# Rebuild images
docker-compose -f docker-compose.test.yml build --no-cache
```

## Migration from Selenium

This test suite replaces the previous Java Selenium tests with modern Playwright implementation:

**Improvements:**
- Faster execution
- Better error messages
- Auto-waiting for elements
- Built-in screenshot/video capture
- Multiple browser support
- TypeScript type safety
- Easier CI/CD integration
