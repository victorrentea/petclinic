# Add Field to Entity

Add a new field to an existing domain entity, propagating the change across all layers.

## Instructions

Given:
- **Entity:** `$ENTITY` (e.g., `Owner`, `Pet`, `Vet`)
- **Field name:** `$FIELD_NAME`
- **Field type:** `$FIELD_TYPE`

Follow these steps **in order**, using TDD — write a failing test first, confirm it fails, then implement.

### 1. Write a failing test
- Add a test in the appropriate `*Test` class (e.g., `OwnerTest`) that verifies the new field is present in the API response or request.
- Run the test and confirm it **fails**.

### 2. Update the OpenAPI spec
- Edit `petclinic-backend/src/main/resources/openapi.yml`
- Add `$FIELD_NAME` to the relevant DTO schema(s) (request and/or response as appropriate)

### 3. Regenerate code
```sh
cd petclinic-backend && ./mvnw clean install -DskipTests
```
This regenerates the DTOs in `target/generated-sources/`.

### 4. Update the JPA Entity
- Add the field to `model/$ENTITY.java`
- Use appropriate JPA annotations (`@Column`, `@NotNull`, etc.)
- Update Lombok annotations if needed

### 5. Update the MapStruct Mapper
- Add the field mapping in the relevant mapper (in `target/generated-sources/` or handwritten mapper)
- If a custom mapping expression is needed, add it via `@Mapping`

### 6. Update DB schema (if needed)
- Add a column to the relevant SQL script in `src/main/resources/db/`

### 7. Run the failing test again — it should now **pass**
```sh
cd petclinic-backend && ./mvnw test -Dtest=EntityNameTest
```

## Constraints
- Constructor injection only (no `@Autowired` in production code)
- Use Lombok where applicable
- Line length ≤ 120 chars
- Follow existing naming conventions in the entity

