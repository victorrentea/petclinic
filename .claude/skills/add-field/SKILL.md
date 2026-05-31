---
name: add-field
description: Add a new field to an existing domain entity, propagating the change across all layers (TypeORM entity, migration, DTO, mapper, OpenAPI). Explicit invocation only — user must type /add-field.
---

# Add Field to Entity

Add a new field to an existing domain entity, propagating the change across all layers.

## Instructions

Given:
- **Entity:** `$ENTITY` (e.g., `Owner`, `Pet`, `Vet`)
- **Field name:** `$FIELD_NAME`
- **Field type:** `$FIELD_TYPE`

Follow these steps **in order**, using TDD — write a failing test first, confirm it fails, then implement.

### 1. Write a failing test
- Add a test (e.g. an e2e spec under `test/` or a `*.spec.ts` next to the controller) that verifies the new field is present in the API response or accepted in a request.
- Run it and confirm it **fails**: `npm test -- path/to/file.spec.ts`

### 2. Update the TypeORM entity
- Add the field to `src/<domain>/<entity>.entity.ts`
- Use the appropriate `@Column({ name: '...', ... })` (snake_case DB column name)

### 3. Add a migration
- Add a new migration class under `src/migrations/` that `ALTER TABLE ... ADD COLUMN ...` for the new column (the schema is owned by migrations; `synchronize: false`)
- Apply it: `npm run migration:run`

### 4. Update the DTO(s)
- Add `$FIELD_NAME` to the relevant DTO under `src/<domain>/dto/` (request and/or response as appropriate)
- Add `class-validator` decorators (`@IsNotEmpty()`, `@Length()`, `@Matches()`, etc.) and `@ApiProperty(...)` from `@nestjs/swagger`

### 5. Update the mapper
- Add the field mapping in the stateless mapper function in `src/<domain>/<domain>.mapper.ts` (entity↔DTO, both directions as needed)

### 6. Regenerate the OpenAPI spec
```sh
npm run guardrail:openapi:generate
```
This rewrites the committed `openapi.yaml`. The frontend regenerates its TS types from it.

### 7. Run the failing test again — it should now **pass**
```sh
npm test -- path/to/file.spec.ts
```

## Constraints
- Constructor injection in controllers (no service layer)
- Stateless mapper functions for DTO mapping (no DI, no `@Injectable`)
- Line length ≤ 120 chars
- Follow existing naming conventions in the entity (snake_case DB columns)
