# AGENTS.md

Guidance for work touching `petclinic-frontend/`.

## Commands

```sh
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
