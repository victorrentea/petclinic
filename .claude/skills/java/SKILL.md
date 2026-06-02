---
name: java
description: Load this skill whenever the task involves reading or writing Java code. 
---

# Java Coding Rules

Apply these rules on every Java file you read or write.

## Injection
- Constructor injection in production code (`@RequiredArgsConstructor`).
- `@Autowired` only in tests.

## Transactions
- `@Transactional` only when strictly necessary — don't add it by default.

## DTO Mapping
- Use MapStruct for entity↔DTO conversion. Never map manually.

## Validation & Error Handling
- `@Validated` on `@RequestBody` parameters.
- Global exception handling via `@RestControllerAdvice` — no try/catch in controllers.

## Lombok
- `@Slf4j`, `@RequiredArgsConstructor` by default.
- `@Builder`, `@Getter`, `@Setter` selectively — only when actually needed.

## Formatting
- Line length ≤ 120 chars.
- Builder chains: one property per line, unless only 2 properties total.

## Testing
- Never ask before running tests after refactoring — just run them.
