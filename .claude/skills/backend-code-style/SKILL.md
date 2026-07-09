---
name: backend-code-style
description: PetClinic backend code-style conventions the owner requires. Use when writing or reviewing Java under petclinic-backend/.
---

# Backend code style (owner's preferences)

The conventions to match when writing or modifying Java in `petclinic-backend/`.

## Dependency injection
- Constructor injection in production, via Lombok `@RequiredArgsConstructor`.
- `@Autowired` only in tests.

## Persistence & transactions
- `@Transactional` only where strictly necessary.

## Mapping
- MapStruct for DTO ↔ entity mapping.

## Web layer
- Global exception handling in a `@RestControllerAdvice`.
- Validate request bodies: `@Validated` on the controller, `@Valid` on the `@RequestBody`.

## Lombok
Use only these, and only where they earn it:
- `@Slf4j`
- `@RequiredArgsConstructor`
- `@Builder`
- `@Getter` / `@Setter`

## Formatting
- Line length ≤ 120 chars.
- Builder chains: one property per line — unless there are only 2 properties total.

## Tests
- Run the tests after refactoring, without asking.
