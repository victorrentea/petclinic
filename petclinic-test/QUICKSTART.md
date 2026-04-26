# Playwright Tests - Quick Start Guide

## Setup (One-time)

```bash
cd qa
npm install
npx playwright install chromium
```

## Running Tests

### Option 1: Against Running Applications (Fastest)

Start applications in one terminal:
```bash
cd ..
./run-all.sh
```

Run tests in another terminal:
```bash
cd qa
npm test
```

### Option 2: With Auto-Start (Convenient)

The test suite can start apps automatically (experimental):
```bash
cd qa
npm run start:apps &  # Start in background
sleep 30              # Wait for apps to be ready
npm test              # Run tests
```

### Option 3: Docker (Isolated)

Run everything in Docker containers:
```bash
cd qa
npm run test:docker
```

This builds images, starts all services, runs tests, and cleans up.

## Test Results

After each run:
- **Screenshots**: `qa/test-results/screenshots/` (git-ignored)
- **HTML Report**: Run `npm run show-report` to view
- **Console Output**: Shows pass/fail status

## Available Commands

```bash
npm test              # Run all tests (headless)
npm run test:ui       # Interactive UI mode
npm run test:headed   # See the browser
npm run test:debug    # Debug mode with breakpoints
npm run show-report   # View HTML report
```

## Troubleshooting

**Tests can't connect to apps:**
```bash
# Check backend
curl http://localhost:8080/api/owners

# Check frontend
curl http://localhost:4200
```

**Port conflicts:**
Kill existing processes on ports 8080 or 4200.

**Docker issues:**
```bash
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml build --no-cache
```

## Project Structure

```
qa/
├── tests/
│   ├── owners.spec.ts         # Test cases
│   ├── pages/
│   │   └── OwnersPage.ts      # Page Object
│   └── support/
│       └── api-client.ts      # API helper
├── test-results/              # Git-ignored
│   └── screenshots/           # Auto-captured screenshots
├── playwright.config.ts       # Test configuration
└── docker-compose.test.yml    # Docker setup
```

## Migration Notes

This suite **replaces** the old Java Selenium tests with:
- TypeScript + Playwright
- Auto-waiting for elements
- Built-in screenshots
- Faster execution
- Better error messages
- Docker support
