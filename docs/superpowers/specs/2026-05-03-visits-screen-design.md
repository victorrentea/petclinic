# Visits Screen — Design Spec

**Date:** 2026-05-03
**Status:** Approved (brainstorming)
**Scope:** Add a new top-level "Visits" tab and screen showing all visits in the system, mirroring the Owners screen layout. Read-only with an "Add Visit" button. No search initially.

---

## 1. Goals

- Provide a global view of all visits across the clinic, accessible from the navbar.
- Layout/UX consistent with the Owners screen.
- Single HTTP call from the frontend — no N+1, no client-side aggregation.
- Zero regression on existing usages of `VisitListComponent` (which remains a presentational subcomponent in `pet-list` and `visit-add`).

## 2. Out of scope

- Search / filter on the Visits screen (deferred).
- Edit / Delete buttons on rows (deferred — read-only screen).
- Pagination (visit volume is small for now).
- Reuse / refactor of `VisitListComponent` for the new page (kept separate to preserve current presentational role).
- Repair of `start-tests.sh` references to the obsolete `start-all.sh` (noted as follow-up; not done here).

## 3. Backend changes

### 3.1 Enrich `VisitDto` (openapi.yaml)

Add four optional, `readOnly` properties to the `VisitDto` schema (currently at `openapi.yaml:1548`). `readOnly` ensures they are populated by the server on `GET` and ignored on `POST`/`PUT` payloads, preserving compatibility with `POST /api/visits` (test-covered, not consumed by the frontend) and the nested `POST /api/owners/{ownerId}/pets/{petId}/visits`.

```yaml
petName:
  type: string
  description: Name of the pet that the visit belongs to.
  readOnly: true
ownerId:
  type: integer
  format: int32
  description: ID of the owner of the pet.
  readOnly: true
ownerFirstName:
  type: string
  readOnly: true
ownerLastName:
  type: string
  readOnly: true
```

After editing, regenerate DTOs via `./mvnw clean install` (per AGENTS.md — generated under `target/generated-sources/`).

### 3.2 `VisitMapper`

Extend `toVisitDto(Visit)` with explicit MapStruct mappings:

```java
@Mapping(source = "pet.id",              target = "petId")
@Mapping(source = "pet.name",            target = "petName")
@Mapping(source = "pet.owner.id",        target = "ownerId")
@Mapping(source = "pet.owner.firstName", target = "ownerFirstName")
@Mapping(source = "pet.owner.lastName",  target = "ownerLastName")
VisitDto toVisitDto(Visit visit);
```

For `toVisit(VisitDto)` and `toVisit(VisitFieldsDto)`: add `@Mapping(target = "...", ignore = true)` for the four new fields so they are not interpreted as inputs.

### 3.3 `VisitRepository` — avoid N+1

The relationships `Visit.pet` and `Pet.owner` are `LAZY`. After the DTO enrichment, mapping each visit triggers two lazy fetches per row, causing N+1 on `GET /api/visits`.

Mitigation: declare an explicit fetch-joined query used by the controller's list endpoint. Either override `findAll` with `@Query` or add a dedicated finder method, e.g.:

```java
@Query("SELECT v FROM Visit v JOIN FETCH v.pet p JOIN FETCH p.owner")
List<Visit> findAllWithPetAndOwner();
```

`VisitRestController.listVisits()` calls the new finder.

### 3.4 Tests (TDD)

Add to `VisitTest.java`:

- `listVisits returns enriched fields` — assert `petName`, `ownerId`, `ownerFirstName`, `ownerLastName` are populated for at least one row from sample data.
- (Optional) Repository-level test that confirms iterating the result outside an active transaction does not throw `LazyInitializationException`.

Existing tests on `POST /api/visits`, `PUT`, `DELETE`, and the nested `addVisitToOwner` must continue to pass unchanged.

## 4. Frontend changes

### 4.1 Navbar tab (`app.component.html`)

Add a new top-level item between Owners and Veterinarians. Style follows the existing simple links (Pet Types / Specialties), not the dropdown pattern:

```html
<li>
  <a routerLink="/visits" routerLinkActive="active" title="visits">
    <span class="glyphicon glyphicon-calendar" aria-hidden="true"></span>
    <span> Visits</span>
  </a>
</li>
```

### 4.2 Routing (`visits-routing.module.ts`)

Replace the current mapping for path `visits` (which points to the presentational `VisitListComponent` and renders empty) with the new page component:

```ts
{ path: 'visits',         component: VisitsPageComponent },   // CHANGED
{ path: 'visits/add',     component: VisitAddComponent },
{ path: 'visits/:id/edit', component: VisitEditComponent },
```

### 4.3 New component `VisitsPageComponent`

Location: `petclinic-frontend/src/app/visits/visits-page/`
Files: `visits-page.component.ts`, `.html`, `.css`, `.spec.ts`. Declared in `visits.module.ts`.

**Behavior:**
- On init: call `VisitService.getVisits()` (already defined; currently dead code — this becomes its first consumer).
- Sort descending by `date` (ISO `YYYY-MM-DD`, lexicographic compare is correct).
- Render a Bootstrap-styled table mirroring the Owners list: headers `Date | Description | Pet | Owner`.
- Owner cell renders as a `routerLink` to `/owners/{ownerId}`.
- "Add Visit" button under the table navigates to `/visits/add`.
- Empty state: when load completes and `visits.length === 0`, show "No visits found.".

**TypeScript skeleton:**

```ts
@Component({ selector: 'app-visits-page', templateUrl: './visits-page.component.html' })
export class VisitsPageComponent implements OnInit {
  visits: Visit[] = [];
  errorMessage: string;
  isDataReceived = false;

  constructor(private router: Router, private visitService: VisitService) {}

  ngOnInit() {
    this.visitService.getVisits()
      .pipe(finalize(() => this.isDataReceived = true))
      .subscribe(
        visits => this.visits = visits.sort((a, b) => b.date.localeCompare(a.date)),
        error => this.errorMessage = error as any);
  }

  addVisit() { this.router.navigate(['/visits/add']); }
}
```

### 4.4 `Visit` interface (`visits/visit.ts`)

Extend with the four optional enriched fields (the existing `pet?` and `petId?` remain for current consumers `visit-add`, `visit-edit`):

```ts
export interface Visit {
  id: number;
  date: string;
  description: string;
  pet?: Pet;
  petId?: number;
  petName?: string;          // NEW
  ownerId?: number;          // NEW
  ownerFirstName?: string;   // NEW
  ownerLastName?: string;    // NEW
}
```

### 4.5 Frontend tests (TDD — Karma)

`visits-page.component.spec.ts`:

- `should create`
- `should load and sort visits descending by date on init` (mock `VisitService.getVisits()`)
- `should display "No visits found" when service returns empty list`
- `should navigate to /visits/add when Add Visit clicked`
- `should render owner cell as a link to /owners/{ownerId}`

Existing specs untouched: `visit-list.component.spec.ts`, `visit-add.component.spec.ts`, `visit-edit.component.spec.ts`, `pet-list.component.spec.ts` must remain green.

## 5. E2E test (Playwright)

Project: `petclinic-ui-test/`. Pattern follows `tests/owners.spec.ts`.

**New files:**
- `tests/visits.spec.ts`
- `tests/pages/VisitsPage.ts` (Page Object)

**Modified:**
- `tests/support/api-client.ts` — add `fetchVisits(): Promise<Visit[]>`, plus a `sortedByDate` helper.

**Tests:**

1. `shows all visits on initial load` — fetch `GET /api/visits`, open `/visits`, wait for row count, assert rows match the API payload (date, description, petName, owner full name).
2. `rows are sorted descending by date`.
3. `owner link navigates to owner detail` — assert URL matches `/owners/\d+`.

Each test takes a full-page screenshot in `afterEach`, identical to `owners.spec.ts:19-27`. Screenshots land in `test-results/screenshots/` (git-ignored).

**`VisitsPage` API:** `open()`, `waitForVisitsCount(n)`, `getVisitRows()`, `getDates()`, `clickFirstOwnerLink()`. Anchored on the `#visitsTable` id from the page template.

## 6. Implementation order

1. **Backend (TDD)**
   1. Add failing test in `VisitTest.java` for enriched fields.
   2. Edit `openapi.yaml` — add 4 `readOnly` fields to `VisitDto`.
   3. `./mvnw clean install` — regenerate DTOs.
   4. Update `VisitMapper` (5 mappings on `toVisitDto`, `ignore` on `toVisit*`).
   5. Add `findAllWithPetAndOwner` (or `@Query` override) in `VisitRepository`; switch controller.
   6. Test passes. Run full `./mvnw test` (incl. ArchUnit / C4 / DomainModel tests).
2. **Frontend (TDD)**
   1. Extend `Visit` interface.
   2. Write failing `visits-page.component.spec.ts`.
   3. Implement `VisitsPageComponent` (`.ts`, `.html`, `.css` minimal); declare in `visits.module.ts`.
   4. Repoint `/visits` route in `visits-routing.module.ts`.
   5. Add navbar tab in `app.component.html`.
   6. `npm test -- --watch=false` green.
3. **E2E**
   1. Add `fetchVisits` + helpers to `api-client.ts`.
   2. Add `VisitsPage.ts`.
   3. Add `visits.spec.ts` with three tests + screenshot.
   4. Manual run sequence:
      ```
      ./start-database.sh   # terminal 1
      ./start-backend.sh    # terminal 2
      ./start-frontend.sh   # terminal 3
      ./start-tests.sh      # terminal 4
      ```

## 7. Risks & considerations

- **N+1 on listVisits:** addressed by `JOIN FETCH` query (§3.3). Without this, the screen is correct but produces 1 + 2N queries.
- **Architecture tests:** `ArchitectureTest`, `C4ModelExtractorTest`, `DomainModelExtractorTest` regenerate `docs/generated/` artifacts. CI auto-commits drift with `[skip ci]`. Local runs may produce diffs in `docs/generated/`; expected.
- **`POST /api/visits` compatibility:** new fields are `readOnly` — clients sending old payloads continue to work.
- **`VisitService.getVisits()`** is currently dead code; this design makes the new component its first consumer. No other consumers exist, so the change of return shape (additional fields) is safe.
