# Backend (NestJS/TypeScript)

NestJS 10 REST API + MCP server. TypeORM + PostgreSQL.

## Commands
```sh
npm run build                       # nest build
npm run start:dev                   # watch mode
npm test                            # Jest unit tests
npm test -- path/to/file.spec.ts    # single file (or --testNamePattern="...")
npm run test:e2e                    # Jest e2e tests
npm run migration:run               # apply TypeORM migrations (schema + seed data)
```

## Architecture

**Layered structure (NO service layer):**
1. REST Controllers (`src/<domain>/<name>.controller.ts`) - inject TypeORM repositories directly via `@InjectRepository(Entity)`
2. Mappers (`src/<domain>/<name>.mapper.ts`) - stateless plain functions for entity↔DTO conversion (no DI)
3. Repository Layer - TypeORM repositories (no hand-written repository classes)
4. Domain Model (`src/<domain>/<name>.entity.ts`) - TypeORM entities

**Key patterns:**
- DTOs hand-written in `src/<domain>/dto/` with `class-validator` decorators
- Global RFC-7807 ProblemDetail exception filter (`src/common/all-exceptions.filter.ts`)
- `openapi.yaml` at project root is generated output (OpenAPI sync guardrail), not a source spec

**MCP server:** exposed over SSE at `/sse` (POST messages at `/mcp/messages`), authenticated with `X-API-Key` (maps key → owner id); see `src/mcp/`.

## Database
- Schema is owned by TypeORM migrations under `src/migrations/` (`synchronize: false`, never auto-DDL)
- Migrations are idempotent; `start-backend-ts.sh` runs them automatically

## Security
- Disabled by default; enable via `PETCLINIC_SECURITY_ENABLE=true`
- HTTP Basic auth backed by `users`/`roles` tables (bcrypt); `@Roles()` decorator + `RolesGuard`
- Roles: `ROLE_OWNER_ADMIN`, `ROLE_VET_ADMIN`, `ROLE_ADMIN`; default user: `admin`/`admin`
