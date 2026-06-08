# Frontend (Angular 16 / Bootstrap 3)

## Commands
```sh
npm start                  # Dev server on localhost:4200
npm run build              # Production build (also regenerates api-types.ts via prebuild)
npm run generate:api       # Regenerate src/app/generated/api-types.ts from root openapi.yaml
npm test                   # Karma tests (headed)
npm run test-headless       # Karma tests (ChromeHeadless, used in CI)
npm run e2e                # Playwright e2e tests
npm run lint               # ESLint
```

## Architecture

**Module structure:** feature folders under `src/app/` — `owners/`, `pets/`, `vets/`, `visits/`, `pettypes/`, `specialties/`

**Key patterns:**
- `src/app/generated/api-types.ts` — auto-generated from root `openapi.yaml` (`npm run generate:api`); do not edit manually
- Bootstrap 3 for layout/styling, Angular Material for components
- Routing via Angular Router; lazy loading per feature module

## Code Preferences
- Keep line length ≤ 120 chars
- Avoid ternary unless it fits in half a line (~60 chars); use if/else otherwise
