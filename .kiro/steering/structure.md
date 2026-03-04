---
inclusion: auto
---

# Project Structure

## Root Organization
```
petclinic-angular/
├── src/app/              # Application source code
├── e2e/                  # End-to-end tests
├── angular.json          # Angular CLI configuration
├── package.json          # Dependencies and scripts
└── karma.conf.js         # Test configuration
```

## Application Architecture

The app follows Angular's feature module pattern with domain-driven organization:

```
src/app/
├── app.component.ts           # Root component
├── app.module.ts              # Root module
├── app-routing.module.ts      # Root routing
├── error.service.ts           # Global error handling
├── http-error.interceptor.ts  # HTTP error interceptor
│
├── owners/                    # Owner management feature
│   ├── owner.ts              # Domain model
│   ├── owner.service.ts      # HTTP service
│   ├── owners.module.ts      # Feature module
│   ├── owners-routing.module.ts
│   ├── owner-list/           # List component
│   ├── owner-detail/         # Detail component
│   ├── owner-add/            # Add component
│   └── owner-edit/           # Edit component
│
├── pets/                      # Pet management feature
├── vets/                      # Veterinarian feature
├── visits/                    # Visit management feature
├── pettypes/                  # Pet type management
├── specialties/               # Specialty management
│
├── parts/                     # Shared UI components
│   ├── welcome/              # Landing page
│   ├── page-not-found/       # 404 page
│   └── game-of-life/         # Demo feature
│
└── testing/                   # Test utilities
    ├── router-stubs.ts       # Router test doubles
    └── testing.module.ts     # Shared test module
```

## Module Organization Pattern

Each feature module follows this structure:
- `{feature}.module.ts` - Feature module definition
- `{feature}-routing.module.ts` - Feature routing
- `{feature}.ts` - Domain model/interface
- `{feature}.service.ts` - HTTP service for API calls
- `{feature}.service.spec.ts` - Service unit tests
- `{feature}-list/` - List/search component
- `{feature}-detail/` - Detail view component
- `{feature}-add/` - Create form component
- `{feature}-edit/` - Edit form component

## Naming Conventions

- Components: kebab-case selectors with `app-` prefix
- Directives: camelCase selectors with `app` prefix
- Services: PascalCase with `Service` suffix
- Interfaces/Models: PascalCase
- Files: kebab-case with type suffix (`.component.ts`, `.service.ts`)

## Service Pattern

Services use:
- `@Injectable()` decorator
- Constructor injection for HttpClient
- RxJS Observables for async operations
- Centralized error handling via `HttpErrorHandler`
- Environment-based API URL configuration
