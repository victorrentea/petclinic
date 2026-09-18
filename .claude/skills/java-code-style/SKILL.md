---
name: java-code-style
description: The Java conventions this backend is held to — line length, method size, dependency injection, `@Transactional`, REST error handling and request validation, and which of equals/hashCode/toString to write. Use before writing or editing any `.java` file under `petclinic-backend/`, and when reviewing Java in this repo.
---

# Java code style

Rules for `petclinic-backend/src/**/*.java`. Apply them on the first pass, not after review.

## Formatting
- Keep line length < 120 chars.
- Keep methods under 30 lines.
- Indentation is 4 spaces for Java — `.editorconfig` at the repo root overrides the
  2-space default; honour it rather than whatever the surrounding editor guesses.

## Wiring
- Constructor injection in `src/main`. `@Autowired` is for tests only — a constructor
  makes the dependency list a compile-time fact and keeps the class newable in a unit test.
- Use `@Transactional` only when strictly necessary: 2+ DB updates in one method. A single
  repository call is already transactional; annotating it just widens the window.

## REST layer
- Global exception handling goes in a `@RestControllerAdvice`, never in try/catch inside a
  controller — one place decides status codes and error bodies.
- Apply `@Validated` on every `@RequestBody`, so bad input fails at the edge with a 400
  instead of surfacing as a constraint violation deeper in.

## Object protocol
- Write only the `equals` / `hashCode` / `toString` a class actually needs, not all three
  reflexively. JPA entities in particular rarely want generated `equals`/`hashCode` over
  a mutable id.
