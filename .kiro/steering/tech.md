---
inclusion: auto
---

# Technology Stack

## Framework & Core Libraries
- Angular 16.2.1 (TypeScript 4.9.5)
- Angular Material 16.2.1 for UI components
- RxJS 6.3.1 for reactive programming
- Bootstrap 3.3.7 for styling
- Moment.js for date handling

## Build System
- Angular CLI 16.2.0
- Webpack (via Angular CLI)
- TypeScript compiler

## Testing
- Jasmine for unit tests
- Karma for test runner
- Protractor for e2e tests

## Code Quality
- ESLint with Angular ESLint plugin
- Prettier for code formatting
- Single quotes enforced for TypeScript

## Common Commands

```bash
# Development server (runs on http://localhost:4200)
npm start

# Build for production
npm run build

# Run unit tests
npm test

# Run unit tests in headless mode (CI)
npm run test-headless

# Run linter
npm run lint

# Run e2e tests
npm run e2e
```

## Environment Configuration
- Development: `src/environments/environment.ts`
- Production: `src/environments/environment.prod.ts`
- REST API URL configured via `environment.REST_API_URL`
