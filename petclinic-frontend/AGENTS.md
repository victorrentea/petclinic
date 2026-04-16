# Frontend Agent Guidance

## Common Commands

```sh
npm start                           # Dev server on localhost:4200
npm run build                       # Production build
npm test                            # Karma tests
npm run test-headless               # Headless Chrome tests
npm run e2e                         # Protractor e2e tests
```

## Architecture
- Angular 16 with Material + Bootstrap 3
- Services communicate with backend REST API at http://localhost:8080/api/
- RxJS for async operations

