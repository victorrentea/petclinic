# PetClinic - Full Stack Application

Full-stack veterinary clinic management application with:
- **Backend**: NestJS 10 REST API (TypeScript, TypeORM, PostgreSQL)
- **Frontend**: Angular 16 SPA
## Architecture Overview

This is a full-stack implementation with clear separation:
- `petclinic-backend-ts/` - NestJS REST API + MCP server (the only backend)
- `petclinic-frontend/` - Angular client
- `petclinic-observability/` - Grafana LGTM observability stack
- `petclinic-ui-test/` - Playwright end-to-end tests

database.password=SECRET123
### Domain model

Core entities and relationships:
- **Owner** 1→N **Pet** N→1 **PetType**
- **Pet** 1→N **Visit**
- **Vet** N→N **Specialty** (via the `vet_specialties` join table)
- **User** 1→N **Role**

## Setup (one-time per clone)

```sh
./install-all.sh
```

Installs all npm dependencies **and** points git at `.githooks/`
(`git config core.hooksPath .githooks`) so the project's hooks run for
everyone — not just the original author.

The active hooks (read them — they're short shell scripts):

- `.githooks/pre-commit` — gitleaks secrets scan, custom `secrets.env` value
  scan, and TypeScript types regen when `openapi.yaml` is staged.
- `.githooks/pre-push` — when the backend / `openapi.yaml` changed: runs the
  guardrail tests (schema/entity sync + OpenAPI sync), checks generated
  artifacts haven't drifted, and lints `openapi.yaml` with Spectral.

To bypass once: `git commit --no-verify` / `git push --no-verify`. To
disable persistently: `git config --unset core.hooksPath`.

## Quick Start - Run Full Stack

Each script is foreground; run them in separate terminals:

```sh
./start-database.sh        # PostgreSQL via Docker Compose on localhost:5432
./start-backend-ts.sh      # NestJS backend on localhost:8080
./start-frontend.sh        # Angular dev server on localhost:4200
```

Then access:
- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:8080/api
- **Swagger UI**: http://localhost:8080/swagger-ui

## Backend (NestJS REST API)

Located in `petclinic-backend-ts/`

### Run Backend Only

```sh
./start-backend-ts.sh
```

This builds the project, runs the TypeORM migrations (schema + seed data), and
boots NestJS on port 8080. For iterative development:

```sh
cd petclinic-backend-ts
npm run start:dev          # watch mode
```

### Backend Tech Stack
- NestJS 10
- TypeORM 0.3
- PostgreSQL
- TypeScript (strict mode)
- OpenAPI / Swagger (`@nestjs/swagger`)
- An MCP server exposed over SSE at `/sse`

### REST API Documentation

Browse the live endpoint catalogue in Swagger UI:
[http://localhost:8080/swagger-ui](http://localhost:8080/swagger-ui).

The committed `openapi.yaml` at the project root is generated output (kept in
sync by the OpenAPI guardrail) and drives the frontend's TypeScript type
generation.

### Database Configuration

**Dev:** PostgreSQL via Docker Compose — start it with:

```sh
./start-database.sh        # PostgreSQL on localhost:5432
```

The schema is owned by TypeORM migrations under `src/migrations/`
(`synchronize: false` — never auto-DDL) and seeded with sample data. Apply them
with:

```sh
cd petclinic-backend-ts
npm run migration:run      # idempotent; start-backend-ts.sh runs this for you
```

### Security Configuration

HTTP Basic authentication is **disabled by default** (permit all). To enable:

```sh
PETCLINIC_SECURITY_ENABLE=true
```

Role-based access is enforced by a `@Roles()` decorator + `RolesGuard`. Roles:
- `ROLE_OWNER_ADMIN` → Owner, Pet, PetType, Visit endpoints
- `ROLE_VET_ADMIN` → PetType, Specialty, Vet endpoints
- `ROLE_ADMIN` → User management

Default user: `admin` / `admin`

### Testing

```sh
cd petclinic-backend-ts
npm test                   # Jest unit tests
npm run test:e2e           # Jest e2e tests
```

## Frontend (Angular SPA)

Located in `petclinic-frontend/`

### Run Frontend Only

```sh
cd petclinic-frontend
npm install
npm start
```

Frontend runs at http://localhost:4200 and talks to the backend at
http://localhost:8080/api.

### Frontend Tech Stack
- Angular 16
- Angular Material
- Bootstrap 3
- RxJS

### Prerequisites
- Node.js 16+
- npm

## Observability (optional)

Local Grafana LGTM (metrics + logs + traces) plus zero-code OpenTelemetry
auto-instrumentation, queryable from Claude Code via `mcp-grafana`.

### 1. Start the stack

```sh
./start-observability.sh         # Grafana at http://localhost:3300 (admin/admin)
./start-database.sh              # if not already running
./start-backend-ts.sh
( cd petclinic-frontend && npm start )
```

The backend exports OpenTelemetry traces/metrics/logs to the LGTM stack over
OTLP on `:4318`.

### 2. Use the app, then explore

Open http://localhost:4200, browse around. Then in Grafana:
- **Explore → Tempo** — distributed traces (browser → backend → DB)
- **Explore → Loki** — backend logs (with `trace_id` for correlation)
- **Explore → Prometheus (Mimir)** — HTTP and runtime metrics

### 3. Install `mcp-grafana` and query from Claude Code

```sh
brew install mcp-grafana
# or
go install github.com/grafana/mcp-grafana/cmd/mcp-grafana@latest
```

The repo's `.mcp.json` registers it automatically when you open Claude Code in
this directory. Then ask things like:

- "What's the average latency of `GET /api/owners` in the last 10 minutes?"
- "Show me logs from traces that hit the owners controller."
- "What's the requests-per-second on the backend right now?"

### Limitations

- Frontend instrumentation works only with `npm start` (dev). Production
  builds skip the dev-server proxy.
- Default credentials (`admin/admin`) are local-demo only. Never publish.
- The host port for Grafana is **3300** (not 3000) because port 3000 was
  already taken on the dev machine; container internal port is unchanged.
- The stack is **opt-in** — it's not started by default. Students without
  Docker can ignore everything in this section.

### Stop

Press `Ctrl+C` in the `./start-observability.sh` terminal — it tears the stack
down on exit.

## End-to-End Tests

Playwright tests live in `petclinic-ui-test/`. With the backend and frontend
running:

```sh
./start-ui-tests.sh
```

## Development

### Looking for Something Specific?

| Component | Location |
|-----------|----------|
| Backend REST controllers | [petclinic-backend-ts/src/&lt;domain&gt;/*.controller.ts](petclinic-backend-ts/src) |
| Backend entities | [petclinic-backend-ts/src/&lt;domain&gt;/*.entity.ts](petclinic-backend-ts/src) |
| Backend mappers | [petclinic-backend-ts/src/&lt;domain&gt;/*.mapper.ts](petclinic-backend-ts/src) |
| Backend migrations | [petclinic-backend-ts/src/migrations](petclinic-backend-ts/src/migrations) |
| Frontend components | [petclinic-frontend/src/app](petclinic-frontend/src/app) |
| OpenAPI spec (generated) | [openapi.yaml](openapi.yaml) |

## Contributing

For pull requests, editor preferences are available in [.editorconfig](.editorconfig).
