# AGENTS.md

This file contains **backend-specific instructions** for coding agents working under `petclinic-backend/`.

## Backend architecture rules

- Use the existing layered structure:
  - REST controllers in `.../rest/`
  - mappers in `.../mapper/`
  - repositories in `.../repository/`
  - entities in `.../model/`
- **There is no service layer.** Go directly from controller to repository / mapper.
- DTOs in `src/main/java/.../rest/dto/` are **hand-written**, not generated.
- `openapi.yaml` at repo root is **generated output**, not a source spec.

## Coding conventions

- Use **constructor injection** in production code; use `@Autowired` only in tests.
- Use `@Transactional` only when it is strictly necessary.
- Use MapStruct for DTO mapping.
- Use global exception handling via `@RestControllerAdvice`.
- Put `@Validated` on `@RequestBody` parameters.
- Use Lombok selectively: `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`, `@Getter` / `@Setter`.
- Keep line length at **120 chars max**.
- Builder chains should use **one property per line**, unless there are only 2 properties total.
