# AGENTS.md

Guidance for AI coding agents (GitHub Copilot CLI, and any `AGENTS.md`-aware tool)
working in this repository. This is the vendor-neutral companion to `CLAUDE.md`;
keep the two in sync when project conventions change.

## Project overview

Full-stack **PetClinic**: an Angular frontend and a Spring Boot backend that manage
veterinary-clinic operations (owners, pets, vets, visits, specialties).

- `petclinic-backend/` — Spring Boot 3.5 REST API (Java 21)
- `petclinic-frontend/` — Angular 16 SPA (Angular Material + Bootstrap 3)

## Commands

Full stack — each script is foreground; run them in separate terminals:

```sh
./install-all.sh        # one-time: mvn install + npm install for all modules
./start-database.sh     # embedded Postgres on localhost:5432
./start-backend.sh      # Spring Boot on localhost:8080 (also hosts Spring AI MCP at /mcp)
./start-frontend.sh     # Angular dev server on localhost:4200
```

Backend (`petclinic-backend/`):

```sh
mvn spring-boot:run                    # run backend
mvn test                               # run tests
mvn clean install                      # build + regenerate MapStruct mappers
mvn test -Dtest=ClassName#methodName   # run a single test
```

Frontend (`petclinic-frontend/`):

```sh
npm start               # dev server on localhost:4200
npm run build           # production build
npm run test-headless   # headless Chrome unit tests
npm run e2e             # Protractor e2e tests
```

## Architecture

**Backend — layered, no service layer:**

1. REST Controllers (`.../rest/`) — expose API endpoints
2. Mappers (`mapper/`) — MapStruct entity↔DTO conversion
3. Repositories (`repository/`) — Spring Data JPA interfaces
4. Domain model (`model/`) — JPA entities (Owner, Pet, Vet, Visit, Specialty, PetType, User, Role)

Data flow: `Request → Controller → Repository / Mapper → JPA Entity` and back.

- DTOs are hand-written in `.../rest/dto/` (not generated).
- MapStruct mapper implementations are generated into `target/generated-sources/annotations/`;
  regenerate with `mvn clean install`.
- `openapi.yaml` at the repo root is **generated output** (from `OpenApiExtractorTest`), not a
  source spec — do not hand-edit it.

**Domain relationships:** Owner 1→N Pet N→1 PetType · Pet 1→N Visit · Vet N↔N Specialty
(via `vet_specialties`) · User 1→N Role.

**API:** REST at `http://localhost:8080/api/` (`/owners`, `/pets`, `/vets`, `/visits`,
`/pettypes`, `/specialties`, `/users`). OpenAPI UI at `/swagger-ui.html`.

## Database

- **Dev:** embedded PostgreSQL via `./start-database.sh` (localhost:5432).
- **Tests:** embedded PostgreSQL, auto-started in-process — no setup needed.

## Security

Disabled by default. Enable with `petclinic.security.enable=true`. Roles: `OWNER_ADMIN`,
`VET_ADMIN`, `ADMIN`. Default dev user: `admin`/`admin`.

## Code conventions (owner's preferences)

- **Constructor injection** for production code (`@RequiredArgsConstructor`); `@Autowired`
  only in tests.
- `@Transactional` **only when strictly necessary**.
- **MapStruct** for all DTO mapping.
- Global exception handling in a single `@RestControllerAdvice`.
- `@Validated` on `@RequestBody`.
- Lombok: only `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`, and `@Getter`/`@Setter`
  (used selectively).
- Line length ≤ 120 chars.
- Builder chains: one property per line, unless there are only 2 properties total.

## Working agreements

- Write non-trivial code using **TDD**.
- **Always run tests after any refactoring** — never ask first.
- Keep comments concise; prefer explanatory variable/method names over comments.
- Keep explanations concise.
- **Challenge ambiguous prompts** and say so when a request looks wrong.
- Never bypass verification: `git commit --no-verify` / `git push --no-verify` are forbidden.

## Guardrails & living architecture

See [GUARDRAILS.md](GUARDRAILS.md) for guardrail tests, living-architecture diagrams, and
CI drift checks. The pre-commit hook lives in `.githooks/` (`git config core.hooksPath .githooks`).
