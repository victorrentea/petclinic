# Spring PetClinic - Full Stack Application

[![Java Build Status](https://github.com/spring-petclinic/petclinic-rest/actions/workflows/maven-build-master.yml/badge.svg)](https://github.com/spring-petclinic/petclinic-rest/actions/workflows/maven-build-master.yml)
[![Docker Build Status](https://github.com/spring-petclinic/petclinic-rest/actions/workflows/docker-build.yml/badge.svg)](https://github.com/spring-petclinic/petclinic-rest/actions/workflows/docker-build.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=spring-petclinic_petclinic-rest&metric=alert_status)](https://sonarcloud.io/dashboard?id=spring-petclinic_petclinic-rest)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=spring-petclinic_petclinic-rest&metric=coverage)](https://sonarcloud.io/dashboard?id=spring-petclinic_petclinic-rest)

Full-stack veterinary clinic management application with:
- **Backend**: Spring Boot REST API (Java 21)
- **Frontend**: Angular SPA

[See the presentation of the Spring Petclinic Framework version](http://fr.slideshare.net/AntoineRey/spring-framework-petclinic-sample-application)

## Architecture Overview

This is a full-stack implementation with clear separation:
- `petclinic-backend/` - Spring Boot REST API
- `petclinic-frontend/` - Angular client

### Domain model
Auto-generated from JPA annotations by `DomainModelExtractorTest`. Source: [`petclinic-backend/docs/generated/DomainModel.puml`](petclinic-backend/docs/generated/DomainModel.puml).

## Setup (one-time per clone)

```sh
./install-all.sh
```

Installs all maven/npm dependencies **and** points git at `.githooks/`
(`git config core.hooksPath .githooks`) so the project's hooks run for
everyone — not just the original author.

The active hooks (read them — they're short shell scripts):

- `.githooks/pre-commit` — gitleaks secrets scan, custom `secrets.env` value
  scan, and TypeScript types regen when `openapi.yaml` is staged.
- `.githooks/pre-push` — when backend / `openapi.yaml` / `db.sql` changed:
  runs the 6 architecture/extractor guardrail tests, checks generated
  artifacts haven't drifted, and lints `openapi.yaml` with Spectral.

To bypass once: `git commit --no-verify` / `git push --no-verify`. To
disable persistently: `git config --unset core.hooksPath`.

## Quick Start - Run Full Stack

```sh
./run-all.sh
```

Then access:
- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:8080
- **Swagger UI**: http://localhost:8080/swagger-ui.html

## Backend (Spring Boot REST API)

Located in `petclinic-backend/`

### Run Backend Only

```sh
cd petclinic-backend
./mvnw spring-boot:run
```

### Backend Tech Stack
- Java 21
- Spring Boot 3.x
- Spring Data JPA
- OpenAPI 3.1 / Swagger
- PostgreSQL (embedded or standalone)
- MapStruct for DTO mapping

### 📖 OpenAPI REST API Documentation

API documentation (OAS 3.1): [http://localhost:8080/v3/api-docs](http://localhost:8080/v3/api-docs)

### API endpoints

Browse the live endpoint catalogue in Swagger UI: [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html).

### API First

The backend follows the [API First](https://swagger.io/resources/articles/adopting-an-api-first-approach/) approach: the OpenAPI spec at [`petclinic-backend/src/main/resources/openapi.yml`](petclinic-backend/src/main/resources/openapi.yml) is the source of truth. Build-time code generation produces:

- DTO classes under `victor.training.petclinic.rest.dto`
- API template interfaces that controllers implement

Generated code lives in `target/generated-sources/`; controllers wire concrete behaviour onto the generated interfaces.

### Database Configuration

**Dev:** Embedded PostgreSQL (Java jar) — start it with:
```sh
./start-database.sh   # launches embedded Postgres on localhost:5432
```

**Tests** use an embedded PostgreSQL that starts automatically — no setup needed.

Or use docker-compose:
```sh
cd petclinic-backend
docker-compose --profile postgres up
```

### Security Configuration

Basic authentication is **disabled by default**. To enable:

```properties
petclinic.security.enable=true
```

**Roles**:
- `OWNER_ADMIN` → Owner, Pet, PetType, Visit endpoints
- `VET_ADMIN` → PetType, Specialty, Vet endpoints
- `ADMIN` → User management

Default user: `admin` / `admin`

### Testing

**Unit Tests**:
```sh
cd petclinic-backend
./mvnw test
```

**Performance Tests (JMeter)**:
```sh
jmeter -n -t src/test/jmeter/petclinic-jmeter-crud-benchmark.jmx \
  -Jthreads=100 -Jduration=600 -l results/petclinic-test-results.jtl
```

**Guardrail Tests** (`./mvnw test` covers them by default):
- `PackagesArchUnitTest` — ArchUnit rules enforce package dependencies match `petclinic-backend/docs/packages.puml`
- `C4ModelExtractorTest` — regenerates `petclinic-backend/docs/generated/C4.dsl` and the C4 PlantUML/SVG views
- `DomainModelExtractorTest` — regenerates `petclinic-backend/docs/generated/DomainModel.{puml,png}` from JPA annotations

CI (`.github/workflows/architecture.yml`) auto-commits drift in `docs/generated/` back to the branch with `[skip ci]`; failures in `packages.puml` (hand-edited) fail the build.

## Frontend (Angular SPA)

Located in `petclinic-frontend/`

### Run Frontend Only

```sh
cd petclinic-frontend
npm install
npm start
```

Frontend runs at: http://localhost:4200

### Frontend Tech Stack
- Angular 16
- Angular Material
- Bootstrap 3
- RxJS

### Prerequisites
- Node.js 16+
- npm

<img width="1427" alt="petclinic-angular2" src="https://cloud.githubusercontent.com/assets/838318/23263243/f4509c4a-f9dd-11e6-951b-69d0ef72d8bd.png">

## Docker Support

**Backend**:
```sh
docker run -p 8080:8080 springcommunity/petclinic-rest
```

**Build with Jib**:
```sh
cd petclinic-backend
mvn compile jib:build -Djib.to.auth.username=xxx -Djib.to.auth.password=xxx
```

## Observability (optional)

Local Grafana LGTM (metrics + logs + traces) plus zero-code OpenTelemetry
instrumentation for both backend and frontend, queryable from Claude Code via
`mcp-grafana`.

### 1. Start the stack

```sh
./start-grafana.sh               # Grafana at http://localhost:3300 (admin/admin)
./start-database.sh              # if not already running
./start-backend.sh               # auto-downloads the OTel Java agent on first run
( cd petclinic-frontend && npm start )
```

### 2. Use the app, then explore

Open http://localhost:4200, browse around. Then in Grafana:
- **Explore → Tempo** — distributed traces (browser → backend → JDBC)
- **Explore → Loki** — backend logs (with `trace_id` for correlation)
- **Explore → Prometheus (Mimir)** — JVM, HTTP, and `postgresql_*` metrics

### 3. Install `mcp-grafana` and query from Claude Code

```sh
brew install mcp-grafana
# or
go install github.com/grafana/mcp-grafana/cmd/mcp-grafana@latest
```

The repo's `.mcp.json` registers it automatically when you open Claude Code in
this directory. Then ask things like:

- "What's the average latency of `GET /api/owners` in the last 10 minutes?"
- "Show me logs from traces that hit `OwnerController.findById`."
- "What's the requests-per-second on the backend right now?"

### Limitations

- **IntelliJ play button** on `@SpringBootApplication` does NOT attach the
  OTel agent — it bypasses `start-backend.sh`. To use observability from
  IntelliJ, either run via `./mvnw spring-boot:run` from the terminal, or set
  the following in your Run Configuration's "VM options":
  ```
  -javaagent:./.tools/opentelemetry-javaagent.jar
  -Dotel.service.name=petclinic-backend
  -Dotel.exporter.otlp.endpoint=http://localhost:4318
  -Dotel.exporter.otlp.protocol=http/protobuf
  ```
- Frontend instrumentation works only with `npm start` (dev). Production
  builds skip the dev-server proxy.
- Default credentials (`admin/admin`) are local-demo only. Never publish.
- The host port for Grafana is **3300** (not 3000) because port 3000 was
  already taken on the dev machine; container internal port is unchanged.
- The stack is **opt-in** — it's not part of `start-all.sh`. Students without
  Docker can ignore everything in this section.

### Stop

```sh
./stop-observability.sh
```

## Development

### Generated Code (Backend)

Some backend classes are generated during build time:

| Package | Tool |
|---------|------|
| `victor.training.petclinic.mapper` | MapStruct |
| `victor.training.petclinic.rest.dto` | OpenAPI Generator |

Run to generate:
```sh
cd petclinic-backend
mvn clean install
```

### Looking for Something Specific?

| Component | Location |
|-----------|----------|
| Backend REST controllers | [petclinic-backend/src/main/java/.../rest](petclinic-backend/src/main/java/org/springframework/samples/petclinic/rest) |
| Backend repositories | [petclinic-backend/src/main/java/.../repository](petclinic-backend/src/main/java/org/springframework/samples/petclinic/repository) |
| Backend domain model | [petclinic-backend/src/main/java/.../model](petclinic-backend/src/main/java/org/springframework/samples/petclinic/model) |
| Frontend components | [petclinic-frontend/src/app](petclinic-frontend/src/app) |
| OpenAPI spec | [petclinic-backend/src/main/resources/openapi.yml](petclinic-backend/src/main/resources/openapi.yml) |

## Related Projects

The Spring Petclinic master branch in the main [spring-projects](https://github.com/spring-projects/spring-petclinic)
GitHub org is the "canonical" implementation, currently based on Spring Boot and Thymeleaf.

This project is one of the [several forks](https://spring-petclinic.github.io/docs/forks.html) 
hosted in a special GitHub org: [spring-petclinic](https://github.com/spring-petclinic).

## Contributing

The [issue tracker](https://github.com/spring-petclinic/petclinic-rest/issues) is the preferred channel for bug reports, features requests and submitting pull requests.

For pull requests, editor preferences are available in [.editorconfig](.editorconfig).

