# Owner Search Across Any Column — Design

## Problem
The Owners list currently filters only by `lastName` (starts-with). Users want a single search box that finds owners by any column (first name, last name, address, city, telephone).

## Scope
- Single text input on the owners list page.
- Substring match, case-insensitive, against `firstName`, `lastName`, `address`, `city`, `telephone` (OR semantics).
- DB-level filtering only (production: 100k owners — never load all into memory).
- Backward compatibility: not preserved. The `?lastName=` query param is replaced with `?search=`; the frontend is updated in the same change.

## Backend
- **OpenAPI** (`petclinic-backend/src/main/resources/openapi.yml`): rename `listOwners` query param `lastName` → `search`. Description: "Free-text substring search across firstName, lastName, address, city, telephone (case-insensitive)."
- **Repository** (`OwnerRepository`): replace `findByLastNameStartingWith` with:
  ```java
  @Query("""
      select o from Owner o
      where lower(o.firstName) like lower(concat('%', :q, '%'))
         or lower(o.lastName)  like lower(concat('%', :q, '%'))
         or lower(o.address)   like lower(concat('%', :q, '%'))
         or lower(o.city)      like lower(concat('%', :q, '%'))
         or lower(o.telephone) like lower(concat('%', :q, '%'))
      """)
  List<Owner> search(@Param("q") String q);
  ```
- **Controller** (`OwnerRestController.listOwners`): if `search` is null or blank → `findAll()`, else → `repository.search(search)`.

## Frontend
- `owner-list.component.html`: replace label "Last name" with "Search" and the empty-state hint with "No owners matching \"{{search}}\"". Update input `id`/`name` to `search`.
- `owner-list.component.ts`: rename `lastName` field → `search`, rename method → `searchOwners`. Empty string → reload all.
- `owner.service.ts`: existing `searchOwners` call updated to send `search` query param.

## Testing (TDD)
Write `OwnerRepositorySearchTest` first (Spring Data JPA slice test):
1. Persist 5 owners, each distinctive on a different column (`firstName=Zara`, `lastName=Quill`, `address=42 Maple Rd`, `city=Atlantis`, `telephone=5551234567`).
2. For each unique substring (e.g., `"zar"`, `"qui"`, `"maple"`, `"atlan"`, `"5551234"`) assert `search(q)` returns exactly the matching owner.
3. Assert case-insensitivity (`"ZAR"` matches `"Zara"`).
4. Assert blank/null behavior is **not** in the repository — handled at controller level.

Run, see RED, then implement.

Controller-level: existing controller tests (Postman/Newman or `@SpringBootTest`) covering `?lastName=` are updated to `?search=`.

## Out of Scope
- Pagination (existing endpoint doesn't paginate; that's a separate concern called out in memory for 100k scale, but not introduced here).
- Filter by pet name / visit data.
- Per-column filters or column dropdown.
- Maintaining the deprecated `lastName` query param.
