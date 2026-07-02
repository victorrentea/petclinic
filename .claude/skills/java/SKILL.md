---
name: java
description: PetClinic backend Java/Spring conventions. Load whenever reviewing, writing, or rewriting Java code in petclinic-backend/ — enforces DI, transaction, mapping, validation, exception-handling, and Lombok/builder style rules.
---

# Java / Spring conventions (petclinic-backend)

Apply these when reviewing or rewriting Java. They are the code owner's
preferences (originally from `copilot-instructions.md`).

## Dependency injection
- Constructor injection in production code (via Lombok `@RequiredArgsConstructor`).
- `@Autowired` only in tests.

## Transactions
- `@Transactional` only when strictly necessary — not blanket on every service method.

## DTO mapping
- Use MapStruct for DTO ↔ entity mapping; don't hand-roll mappers.

## Validation & exception handling
- `@Validated` on `@RequestBody` controller params.
- Global exception handling lives in a `@RestControllerAdvice`; don't scatter
  try/catch-to-HTTP conversions across controllers.

## Lombok
- Use Lombok deliberately: `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`,
  `@Getter`/`@Setter` — and `@Getter`/`@Setter` selectively, not reflexively on
  every field.

## Builder style
- Builder chains: one property per line, unless there are only 2 properties total
  (then a single line is fine).
