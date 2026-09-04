---
name: java-code-style
description: Java code style rules for petclinic-backend — constructor injection, no Lombok, MapStruct, @Transactional, @Validated, equals/hashCode/toString. Use whenever writing, editing, or reviewing Java code in petclinic-backend.
---

# Java code style (petclinic-backend)

- Keep methods < 50 lines
- Use constructor injection in `src/main`, `@Autowired` only in tests
- Use `@Transactional` only when strictly necessary: 2+ DB updates
- MapStruct generates most DTO mappers (`mapper/`); `VisitMapper` is a hand-written `@Component`
  because its mapping is not field-to-field. MapStruct stays — it is a different library from Lombok
- Global REST exception handling is done via `@RestControllerAdvice`
- Apply `@Validated` on each `@RequestBody`
- No Lombok in `petclinic-backend`: accessors, constructors and loggers are written by hand
  (`private static final Logger log = LoggerFactory.getLogger(X.class);`). Enforced by the
  `no-lombok` ast-grep rule. `petclinic-chatbot` is a separate module and still uses it.
- Write only the `equals`/`hashCode`/`toString` a class actually needs, not all three reflexively
