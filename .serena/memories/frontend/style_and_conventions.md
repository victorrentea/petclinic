# Frontend Style & Conventions

## File Structure Pattern
Feature modules follow consistent structure:
- `{feature}.module.ts` - Feature module
- `{feature}-routing.module.ts` - Routing
- `{feature}.ts` - Domain model/interface
- `{feature}.service.ts` - HTTP service
- `{feature}.service.spec.ts` - Service tests
- `{feature}-list/` - List component
- `{feature}-detail/` - Detail component
- `{feature}-add/` - Create component
- `{feature}-edit/` - Edit component

## Naming Conventions
- **Components**: kebab-case selectors with `app-` prefix
- **Directives**: camelCase selectors with `app` prefix
- **Services**: PascalCase with `Service` suffix
- **Interfaces/Models**: PascalCase
- **Files**: kebab-case with type suffix (`.component.ts`, `.service.ts`)

## Angular Patterns
- Constructor injection for HttpClient
- RxJS Observables for async operations
- Centralized error handling via `HttpErrorHandler`
- Environment-based API URL configuration
- `@Injectable()` decorator for services
- HTTP interceptors for cross-cutting concerns

## Code Style
- Line length ≤ 120 characters
- Use blank lines to separate logical blocks
- TypeScript strict mode
- ESLint + Prettier for formatting

## Testing
- Karma + Jasmine for unit tests
- Test doubles in `testing/` directory
- Shared test module for common setup
