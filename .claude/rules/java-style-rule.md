---
paths:
  - "**/*.java"
---

# Java code style (petclinic)

House rules for backend Java. Apply them on the first pass — a reviewer flagging
one of these afterwards means it was written wrong.

## 1. `@Transactional` only when strictly necessary: 2+ DB updates

A single `save`/`delete` is already atomic in its own transaction, so annotating it
adds nothing and drowns out the methods where the boundary genuinely matters.

```java
// no annotation — one write
public void rename(Long id, String name) {
    ownerRepo.save(ownerRepo.findById(id).orElseThrow().withName(name));
}

// annotated — two writes must land together
@Transactional
public void transferPet(Long petId, Long newOwnerId) {
    petRepo.save(...);
    visitRepo.deleteByPetId(petId);
}
```

## 2. Error handling lives in `@RestControllerAdvice`

Global, in one place. A controller method never catches an exception to turn it into a
status code — throw and let the advice map it.

## 3. Every `@RequestBody` carries `@Validated`

Without it the constraint annotations on the DTO are silently inert, which is the worst
kind of missing validation: it looks present.

```java
public OwnerDto create(@Validated @RequestBody OwnerDto dto) { … }
```

## 4. Builder chains: one property per line

Unless the chain sets **only two** properties, which may stay on one line.

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
