---
name: java-code-style
description: The PetClinic backend's Java conventions — @Transactional only for 2+ DB updates, @RestControllerAdvice for error handling, @Validated on every @RequestBody, one property per line in builder chains. Use whenever writing, editing or reviewing Java under petclinic-backend/ (controllers, repositories, entities, DTOs, mappers, tests) — read it BEFORE writing the code, not after a review flags it.
---

# Java code style (petclinic-backend)

Apply these on the first pass. They are house rules, not suggestions.

## Transactions

Annotate with `@Transactional` **only when strictly necessary: 2 or more DB updates**
in the same method. A single `save`/`delete` is already atomic — an extra annotation
there is noise, and it hides the places where the boundary actually matters.

## Error handling

Global REST exception handling goes in a `@RestControllerAdvice`. Do not catch and
map exceptions inside a controller method.

## Validation

Every `@RequestBody` parameter carries `@Validated`. No exceptions — an unvalidated
body is how a constraint annotation on the DTO silently does nothing.

```java
public OwnerDto create(@Validated @RequestBody OwnerDto dto) { … }
```

## Builder chains

One property per line — unless the chain sets **only two** properties, which may
stay on one line.

```java
// 3+ properties: one per line
Visit.builder()
    .date(date)
    .description(description)
    .pet(pet)
    .build();

// exactly 2: one line is fine
Visit.builder().date(date).pet(pet).build();
```
