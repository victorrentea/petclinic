# Visits Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global "Visits" tab and read-only screen mirroring the Owners page, fed by a single enriched `GET /api/visits` call (no N+1).

**Architecture:** Backend `VisitDto` gets four `readOnly` fields (`petName`, `ownerId`, `ownerFirstName`, `ownerLastName`), MapStruct populates them, and `VisitRepository` adds a `JOIN FETCH` finder. Frontend introduces a new `VisitsPageComponent` that lives at `/visits` (replacing the dead mapping to `VisitListComponent`). Existing `VisitListComponent` stays untouched (still used by `pet-list` and `visit-add`). Playwright E2E in `petclinic-ui-test/` covers the screen against live data.

**Tech Stack:** Spring Boot 3.5 + Java 21, MapStruct, OpenAPI codegen, Spring Data JPA; Angular 16 + Bootstrap 3 + Karma/Jasmine; Playwright for E2E.

**Spec:** `docs/superpowers/specs/2026-05-03-visits-screen-design.md`

---

## File Structure

**Backend — modified:**
- `openapi.yaml` (root) — add 4 readOnly fields to `VisitDto` schema
- `petclinic-backend/src/main/java/.../mapper/VisitMapper.java` — add 4 `@Mapping` lines on `toVisitDto`, `ignore` on `toVisit*`
- `petclinic-backend/src/main/java/.../repository/VisitRepository.java` — add `findAllWithPetAndOwner` with `@Query`
- `petclinic-backend/src/main/java/.../rest/VisitRestController.java` — `listVisits` calls the new finder
- `petclinic-backend/src/test/java/.../rest/VisitTest.java` — add `getAll_returnsEnrichedFields`

**Frontend — modified:**
- `petclinic-frontend/src/app/visits/visit.ts` — add 4 optional fields
- `petclinic-frontend/src/app/visits/visits-routing.module.ts` — repoint `/visits`
- `petclinic-frontend/src/app/visits/visits.module.ts` — declare new component
- `petclinic-frontend/src/app/app.component.html` — add navbar tab

**Frontend — created:**
- `petclinic-frontend/src/app/visits/visits-page/visits-page.component.ts`
- `petclinic-frontend/src/app/visits/visits-page/visits-page.component.html`
- `petclinic-frontend/src/app/visits/visits-page/visits-page.component.css` (empty placeholder)
- `petclinic-frontend/src/app/visits/visits-page/visits-page.component.spec.ts`

**E2E — modified:**
- `petclinic-ui-test/tests/support/api-client.ts` — add `VisitDto` interface, `fetchVisits()`, `sortedByDate()`

**E2E — created:**
- `petclinic-ui-test/tests/pages/VisitsPage.ts`
- `petclinic-ui-test/tests/visits.spec.ts`

---

## Conventions reminder (from AGENTS.md / CLAUDE.md)

- **TDD always:** failing test first, confirm fail, then implement, then confirm pass.
- **MapStruct + OpenAPI codegen:** after editing `openapi.yaml`, run `./mvnw clean install` from `petclinic-backend/` so the regenerated DTO surfaces.
- **Architecture tests:** `./mvnw test` runs ArchUnit + C4/Domain extractors. Pre-commit hook may regenerate and stage `docs/generated/*` — that's expected.
- **No `start-all.sh`:** local manual smoke test uses `start-database.sh`, `start-backend.sh`, `start-frontend.sh`, `start-tests.sh` (4 separate terminals).
- **Constructor injection** in production code; `@Autowired` only in tests.
- **Line length ≤ 120.**

---

## Task 1: Backend — failing test for enriched VisitDto

**Files:**
- Modify: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/rest/VisitTest.java`

- [ ] **Step 1: Add the failing test**

Open `VisitTest.java`. Below the existing `getAll()` method (around line 118), add:

```java
@Test
void getAll_returnsEnrichedFields() throws Exception {
    String responseJson = mockMvc.perform(get("/api/visits"))
        .andExpect(status().isOk())
        .andExpect(content().contentType("application/json"))
        .andReturn()
        .getResponse()
        .getContentAsString();
    VisitDto[] visits = mapper.readValue(responseJson, VisitDto[].class);

    VisitDto created = java.util.Arrays.stream(visits)
        .filter(v -> v.getId() == visitId)
        .findFirst()
        .orElseThrow();

    Owner owner = ownerRepository.findById(petRepository.findById(petId).orElseThrow().getOwner().getId())
        .orElseThrow();
    Pet pet = petRepository.findById(petId).orElseThrow();

    assertThat(created.getPetName()).isEqualTo(pet.getName());
    assertThat(created.getOwnerId()).isEqualTo(owner.getId());
    assertThat(created.getOwnerFirstName()).isEqualTo(owner.getFirstName());
    assertThat(created.getOwnerLastName()).isEqualTo(owner.getLastName());
}
```

- [ ] **Step 2: Run test to confirm it fails**

```sh
cd petclinic-backend
./mvnw -q test -Dtest=VisitTest#getAll_returnsEnrichedFields
```

Expected: COMPILATION FAILURE — `VisitDto` has no `getPetName()`, `getOwnerId()`, etc. (This is the right kind of fail; the whole point is those getters do not yet exist.)

- [ ] **Step 3: Commit the failing test**

```sh
git add petclinic-backend/src/test/java/org/springframework/samples/petclinic/rest/VisitTest.java
git commit -m "test(visits): add failing test for enriched VisitDto fields"
```

(Pre-commit will auto-regenerate architecture artifacts; let it stage them.)

---

## Task 2: Backend — enrich VisitDto in openapi.yaml

**Files:**
- Modify: `openapi.yaml` (around the `VisitDto` schema, currently `:1548-1578`)

- [ ] **Step 1: Add four readOnly fields to VisitDto schema**

In `openapi.yaml`, locate the `VisitDto:` block (≈ line 1548). Replace its `properties:` block with:

```yaml
    VisitDto:
      type: object
      properties:
        date:
          type: string
          format: date
          description: The date of the visit.
          example: 2013-01-01
        description:
          type: string
          description: The description for the visit.
          example: rabies shot
          maxLength: 255
          minLength: 1
        id:
          type: integer
          format: int32
          description: The ID of the visit.
          example: 1
          minimum: 0
          readOnly: true
        petId:
          type: integer
          format: int32
          description: The ID of the pet.
          example: 1
          minimum: 0
        petName:
          type: string
          description: Name of the pet (server-populated).
          readOnly: true
        ownerId:
          type: integer
          format: int32
          description: ID of the owner of the pet (server-populated).
          readOnly: true
        ownerFirstName:
          type: string
          description: First name of the owner (server-populated).
          readOnly: true
        ownerLastName:
          type: string
          description: Last name of the owner (server-populated).
          readOnly: true
      required:
      - description
      - id
      - petId
```

- [ ] **Step 2: Regenerate DTOs**

```sh
cd petclinic-backend
./mvnw -q clean install -DskipTests
```

Expected: build succeeds; new getters/setters appear in `target/generated-sources/.../rest/dto/VisitDto.java` (`getPetName`, `getOwnerId`, `getOwnerFirstName`, `getOwnerLastName`).

- [ ] **Step 3: Verify the test now compiles but fails on assertion**

```sh
./mvnw -q test -Dtest=VisitTest#getAll_returnsEnrichedFields
```

Expected: TEST FAILURE (assertion) — DTO compiles but the new fields are `null` because the mapper doesn't populate them yet.

- [ ] **Step 4: Commit**

```sh
git add openapi.yaml
git commit -m "feat(api): enrich VisitDto with petName, ownerId, ownerFirstName, ownerLastName"
```

---

## Task 3: Backend — populate enriched fields in VisitMapper

**Files:**
- Modify: `petclinic-backend/src/main/java/org/springframework/samples/petclinic/mapper/VisitMapper.java`

- [ ] **Step 1: Update VisitMapper**

Replace the entire interface body so it reads:

```java
package org.springframework.samples.petclinic.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import model.ro.victorrentea.petclinic.Visit;
import dto.rest.ro.victorrentea.petclinic.VisitDto;
import dto.rest.ro.victorrentea.petclinic.VisitFieldsDto;

import java.util.List;

@Mapper(componentModel = "spring", uses = PetMapper.class)
public interface VisitMapper {

    @Mapping(source = "petId", target = "pet.id")
    @Mapping(target = "pet.name", ignore = true)
    @Mapping(target = "pet.owner", ignore = true)
    Visit toVisit(VisitDto visitDto);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "pet", ignore = true)
    Visit toVisit(VisitFieldsDto visitFieldsDto);

    @Mapping(source = "pet.id", target = "petId")
    @Mapping(source = "pet.name", target = "petName")
    @Mapping(source = "pet.owner.id", target = "ownerId")
    @Mapping(source = "pet.owner.firstName", target = "ownerFirstName")
    @Mapping(source = "pet.owner.lastName", target = "ownerLastName")
    VisitDto toVisitDto(Visit visit);

    List<VisitDto> toVisitsDto(List<Visit> visits);
}
```

- [ ] **Step 2: Regenerate mappers and run the new test**

```sh
cd petclinic-backend
./mvnw -q clean install -DskipTests
./mvnw -q test -Dtest=VisitTest#getAll_returnsEnrichedFields
```

Expected: build succeeds, new test passes (or still fails only with `LazyInitializationException` if the `@Transactional` test boundary closes before mapping — Task 4 fixes that with JOIN FETCH).

If the test passes here because of the test's `@Transactional` annotation, that's fine — Task 4 is still required for production correctness (avoids N+1 outside transaction in real requests).

- [ ] **Step 3: Run the full VisitTest class to confirm no regression**

```sh
./mvnw -q test -Dtest=VisitTest
```

Expected: all tests pass (`getByIdOk`, `getAll`, `create_ok`, `update_ok`, `delete_ok`, etc.).

- [ ] **Step 4: Commit**

```sh
git add petclinic-backend/src/main/java/org/springframework/samples/petclinic/mapper/VisitMapper.java
git commit -m "feat(mapper): map pet+owner fields into VisitDto"
```

---

## Task 4: Backend — JOIN FETCH on listVisits to avoid N+1

**Files:**
- Modify: `petclinic-backend/src/main/java/org/springframework/samples/petclinic/repository/VisitRepository.java`
- Modify: `petclinic-backend/src/main/java/org/springframework/samples/petclinic/rest/VisitRestController.java`

- [ ] **Step 1: Add JOIN FETCH finder to repository**

Replace `VisitRepository.java` with:

```java
package org.springframework.samples.petclinic.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import model.ro.victorrentea.petclinic.Visit;

import java.util.List;
import java.util.Optional;

public interface VisitRepository extends Repository<Visit, Integer> {

    Optional<Visit> findById(int id);

    Visit save(Visit visit);

    List<Visit> findAll();

    @Query("SELECT v FROM Visit v JOIN FETCH v.pet p JOIN FETCH p.owner")
    List<Visit> findAllWithPetAndOwner();

    void delete(Visit visit);

    List<Visit> findByPetId(int petId);
}
```

- [ ] **Step 2: Wire controller to the new finder**

In `VisitRestController.java`, change `listVisits()` to:

```java
@GetMapping
public List<VisitDto> listVisits() {
    List<Visit> visits = visitRepository.findAllWithPetAndOwner();
    return visitMapper.toVisitsDto(visits);
}
```

- [ ] **Step 3: Run the full VisitTest class**

```sh
cd petclinic-backend
./mvnw -q test -Dtest=VisitTest
```

Expected: all tests green, including `getAll_returnsEnrichedFields`.

- [ ] **Step 4: Run the full backend test suite (architecture tests included)**

```sh
./mvnw -q test
```

Expected: all green. Architecture diagrams under `docs/generated/` may be regenerated; that's fine.

- [ ] **Step 5: Commit**

```sh
git add petclinic-backend/src/main/java/org/springframework/samples/petclinic/repository/VisitRepository.java \
        petclinic-backend/src/main/java/org/springframework/samples/petclinic/rest/VisitRestController.java
git commit -m "perf(visits): use JOIN FETCH on listVisits to avoid N+1"
```

---

## Task 5: Frontend — extend `Visit` interface

**Files:**
- Modify: `petclinic-frontend/src/app/visits/visit.ts`

- [ ] **Step 1: Add four optional enriched fields**

Replace the file content with:

```ts
import {Pet} from '../pets/pet';

export interface Visit {
  id: number;
  date: string;
  description: string;
  pet: Pet;
  petId?: number;
  petName?: string;
  ownerId?: number;
  ownerFirstName?: string;
  ownerLastName?: string;
}
```

- [ ] **Step 2: Verify frontend still compiles**

```sh
cd petclinic-frontend
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```sh
git add petclinic-frontend/src/app/visits/visit.ts
git commit -m "feat(visits): add enriched fields to Visit interface"
```

---

## Task 6: Frontend — failing spec for VisitsPageComponent

**Files:**
- Create: `petclinic-frontend/src/app/visits/visits-page/visits-page.component.spec.ts`

- [ ] **Step 1: Create the spec directory and file**

```sh
mkdir -p petclinic-frontend/src/app/visits/visits-page
```

Create `petclinic-frontend/src/app/visits/visits-page/visits-page.component.spec.ts` with:

```ts
import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {Observable, of} from 'rxjs';
import {RouterTestingModule} from '@angular/router/testing';
import {Router} from '@angular/router';
import {CommonModule} from '@angular/common';
import {By} from '@angular/platform-browser';

import {VisitsPageComponent} from './visits-page.component';
import {VisitService} from '../visit.service';
import {Visit} from '../visit';

class VisitServiceStub {
  getVisits(): Observable<Visit[]> {
    return of();
  }
}

describe('VisitsPageComponent', () => {
  let component: VisitsPageComponent;
  let fixture: ComponentFixture<VisitsPageComponent>;
  let visitService: VisitServiceStub;

  const visits: Visit[] = [
    {
      id: 1, date: '2024-01-15', description: 'rabies shot', pet: null as any,
      petId: 7, petName: 'Leo', ownerId: 1, ownerFirstName: 'George', ownerLastName: 'Franklin',
    },
    {
      id: 2, date: '2025-06-04', description: 'checkup', pet: null as any,
      petId: 8, petName: 'Basil', ownerId: 2, ownerFirstName: 'Betty', ownerLastName: 'Davis',
    },
    {
      id: 3, date: '2023-09-10', description: 'spayed', pet: null as any,
      petId: 7, petName: 'Leo', ownerId: 1, ownerFirstName: 'George', ownerLastName: 'Franklin',
    },
  ];

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [VisitsPageComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, RouterTestingModule],
      providers: [{provide: VisitService, useClass: VisitServiceStub}],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VisitsPageComponent);
    component = fixture.componentInstance;
    visitService = TestBed.inject(VisitService) as unknown as VisitServiceStub;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads and sorts visits descending by date', waitForAsync(() => {
    spyOn(visitService, 'getVisits').and.returnValue(of(visits));
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      const dates = component.visits.map(v => v.date);
      expect(dates).toEqual(['2025-06-04', '2024-01-15', '2023-09-10']);
    });
  }));

  it('shows "No visits found." when service returns empty list', waitForAsync(() => {
    spyOn(visitService, 'getVisits').and.returnValue(of([]));
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      fixture.detectChanges();
      const empty = fixture.debugElement.query(By.css('.no-visits'));
      expect(empty.nativeElement.textContent).toContain('No visits found.');
    });
  }));

  it('navigates to /visits/add when Add Visit clicked', () => {
    spyOn(visitService, 'getVisits').and.returnValue(of(visits));
    const router = TestBed.inject(Router);
    const navSpy = spyOn(router, 'navigate');
    fixture.detectChanges();

    component.addVisit();

    expect(navSpy).toHaveBeenCalledWith(['/visits/add']);
  });

  it('renders owner cell as a link to /owners/{ownerId}', waitForAsync(() => {
    spyOn(visitService, 'getVisits').and.returnValue(of(visits));
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      fixture.detectChanges();
      const links = fixture.debugElement.queryAll(By.css('a.owner-link'));
      expect(links.length).toBe(visits.length);
      expect(links[0].attributes['ng-reflect-router-link'] || links[0].nativeElement.getAttribute('href'))
        .toContain('/owners/');
    });
  }));
});
```

- [ ] **Step 2: Run the spec; expect compilation failure**

```sh
cd petclinic-frontend
npm test -- --watch=false --include='**/visits-page.component.spec.ts'
```

Expected: COMPILATION FAILURE — `VisitsPageComponent` does not exist yet.

- [ ] **Step 3: Commit the failing spec**

```sh
git add petclinic-frontend/src/app/visits/visits-page/visits-page.component.spec.ts
git commit -m "test(visits-page): add failing specs for new visits page"
```

---

## Task 7: Frontend — implement VisitsPageComponent

**Files:**
- Create: `petclinic-frontend/src/app/visits/visits-page/visits-page.component.ts`
- Create: `petclinic-frontend/src/app/visits/visits-page/visits-page.component.html`
- Create: `petclinic-frontend/src/app/visits/visits-page/visits-page.component.css`
- Modify: `petclinic-frontend/src/app/visits/visits.module.ts`

- [ ] **Step 1: Create the TypeScript component**

`visits-page.component.ts`:

```ts
import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {finalize} from 'rxjs/operators';
import {VisitService} from '../visit.service';
import {Visit} from '../visit';

@Component({
  selector: 'app-visits-page',
  templateUrl: './visits-page.component.html',
  styleUrls: ['./visits-page.component.css'],
})
export class VisitsPageComponent implements OnInit {
  visits: Visit[] = [];
  errorMessage: string;
  isDataReceived = false;

  constructor(private router: Router, private visitService: VisitService) {}

  ngOnInit(): void {
    this.visitService.getVisits()
      .pipe(finalize(() => { this.isDataReceived = true; }))
      .subscribe(
        visits => this.visits = [...visits].sort((a, b) => b.date.localeCompare(a.date)),
        error => this.errorMessage = error as any,
      );
  }

  addVisit(): void {
    this.router.navigate(['/visits/add']);
  }
}
```

- [ ] **Step 2: Create the template**

`visits-page.component.html`:

```html
<div class="container-fluid">
  <div class="container xd-container">
    <h2>Visits</h2>

    <div *ngIf="isDataReceived && visits.length === 0" class="no-visits">
      No visits found.
    </div>

    <div class="table-responsive" id="visitsTable" *ngIf="visits.length > 0">
      <table class="table table-striped">
        <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th>Pet</th>
          <th>Owner</th>
        </tr>
        </thead>
        <tbody>
        <tr *ngFor="let visit of visits">
          <td class="visit-date">{{ visit.date }}</td>
          <td class="visit-description">{{ visit.description }}</td>
          <td class="visit-pet">{{ visit.petName }}</td>
          <td class="visit-owner">
            <a class="owner-link" [routerLink]="['/owners', visit.ownerId]">
              {{ visit.ownerFirstName }} {{ visit.ownerLastName }}
            </a>
          </td>
        </tr>
        </tbody>
      </table>
      <div>
        <button *ngIf="isDataReceived" class="btn btn-default" (click)="addVisit()">Add Visit</button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Create the empty stylesheet**

`visits-page.component.css`:

```css
/* intentionally empty - styling inherits from Bootstrap classes */
```

- [ ] **Step 4: Register in `visits.module.ts`**

In `petclinic-frontend/src/app/visits/visits.module.ts`:

1. Add import at the top:

```ts
import {VisitsPageComponent} from './visits-page/visits-page.component';
```

2. Add `VisitsPageComponent` to both the `declarations` array and the `exports` array (next to `VisitListComponent`).

After edits, the relevant section should read:

```ts
declarations: [
  VisitListComponent,
  VisitEditComponent,
  VisitAddComponent,
  VisitsPageComponent,
],
exports: [
  VisitListComponent,
  VisitEditComponent,
  VisitAddComponent,
  VisitsPageComponent,
],
```

- [ ] **Step 5: Run the spec; expect green**

```sh
cd petclinic-frontend
npm test -- --watch=false --include='**/visits-page.component.spec.ts'
```

Expected: 5 specs PASS.

- [ ] **Step 6: Run the full frontend suite (no regressions)**

```sh
npm test -- --watch=false
```

Expected: all green.

- [ ] **Step 7: Commit**

```sh
git add petclinic-frontend/src/app/visits/visits-page \
        petclinic-frontend/src/app/visits/visits.module.ts
git commit -m "feat(visits-page): implement read-only Visits screen component"
```

---

## Task 8: Frontend — repoint `/visits` route

**Files:**
- Modify: `petclinic-frontend/src/app/visits/visits-routing.module.ts`

- [ ] **Step 1: Replace the routing module**

Full file content:

```ts
import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {VisitsPageComponent} from './visits-page/visits-page.component';
import {VisitEditComponent} from './visit-edit/visit-edit.component';
import {VisitAddComponent} from './visit-add/visit-add.component';

const visitRoutes: Routes = [
  {path: 'visits', component: VisitsPageComponent},
  {path: 'visits/add', component: VisitAddComponent},
  {path: 'visits/:id/edit', component: VisitEditComponent},
];

@NgModule({
  imports: [RouterModule.forChild(visitRoutes)],
  exports: [RouterModule],
})
export class VisitsRoutingModule {
}
```

- [ ] **Step 2: Run the full frontend suite**

```sh
cd petclinic-frontend
npm test -- --watch=false
```

Expected: all green.

- [ ] **Step 3: Commit**

```sh
git add petclinic-frontend/src/app/visits/visits-routing.module.ts
git commit -m "feat(visits): route /visits to VisitsPageComponent"
```

---

## Task 9: Frontend — navbar tab "Visits"

**Files:**
- Modify: `petclinic-frontend/src/app/app.component.html`

- [ ] **Step 1: Insert the new `<li>` in the navbar**

In `app.component.html`, between the `Veterinarians` `<li class="dropdown">` (closing at line 39) and the `Pet Types` `<li>` (line 40), insert:

```html
    <li>
      <a routerLink="/visits" routerLinkActive="active" title="visits">
        <span class="glyphicon glyphicon-calendar" aria-hidden="true"></span>
        <span> Visits</span>
      </a>
    </li>
```

- [ ] **Step 2: Verify frontend builds**

```sh
cd petclinic-frontend
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```sh
git add petclinic-frontend/src/app/app.component.html
git commit -m "feat(navbar): add Visits tab"
```

---

## Task 10: E2E — extend `ApiClient` with `fetchVisits`

**Files:**
- Modify: `petclinic-ui-test/tests/support/api-client.ts`

- [ ] **Step 1: Add `VisitDto`, `fetchVisits`, and a date-sort helper**

Append to the existing `api-client.ts` (do **not** remove existing exports):

1. After the `OwnerDto` interface (≈ line 10), add:

```ts
export interface VisitDto {
  id: number;
  date: string;
  description: string;
  petId: number;
  petName?: string;
  ownerId?: number;
  ownerFirstName?: string;
  ownerLastName?: string;
}
```

2. Inside the `ApiClient` class, after `fetchOwnersByPrefix` (≈ line 32), add:

```ts
  async fetchVisits(): Promise<VisitDto[]> {
    const response = await this.client.get<VisitDto[]>('/visits');
    return response.data;
  }
```

3. After `static sorted(...)` (≈ line 42), add:

```ts
  static sortedByDate<T extends { date: string }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }
```

- [ ] **Step 2: Verify it compiles**

```sh
cd petclinic-ui-test
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```sh
git add petclinic-ui-test/tests/support/api-client.ts
git commit -m "test(e2e): add fetchVisits and VisitDto to ApiClient"
```

---

## Task 11: E2E — `VisitsPage` page object

**Files:**
- Create: `petclinic-ui-test/tests/pages/VisitsPage.ts`

- [ ] **Step 1: Create the page object**

```ts
import {Page, Locator} from '@playwright/test';

export interface VisitRow {
  date: string;
  description: string;
  petName: string;
  ownerFullName: string;
}

export class VisitsPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly visitsTable: Locator;
  readonly rows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h2:has-text("Visits")');
    this.visitsTable = page.locator('#visitsTable');
    this.rows = page.locator('#visitsTable tbody tr');
  }

  async open(): Promise<void> {
    await this.page.goto('/visits');
    await this.pageTitle.waitFor({state: 'visible', timeout: 10000});
  }

  async waitForVisitsCount(expectedCount: number): Promise<void> {
    try {
      await this.page.waitForFunction(
        (count) => document.querySelectorAll('#visitsTable tbody tr').length === count,
        expectedCount,
        {timeout: 10000},
      );
    } catch {
      // let assertions surface the actual values
    }
  }

  async getVisitRows(): Promise<VisitRow[]> {
    const count = await this.rows.count();
    const result: VisitRow[] = [];
    for (let i = 0; i < count; i++) {
      const row = this.rows.nth(i);
      result.push({
        date: ((await row.locator('td.visit-date').textContent()) || '').trim(),
        description: ((await row.locator('td.visit-description').textContent()) || '').trim(),
        petName: ((await row.locator('td.visit-pet').textContent()) || '').trim(),
        ownerFullName: ((await row.locator('td.visit-owner a.owner-link').textContent()) || '').trim().replace(/\s+/g, ' '),
      });
    }
    return result;
  }

  async getDates(): Promise<string[]> {
    const count = await this.rows.count();
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      out.push(((await this.rows.nth(i).locator('td.visit-date').textContent()) || '').trim());
    }
    return out;
  }

  async clickFirstOwnerLink(): Promise<void> {
    await this.rows.first().locator('a.owner-link').click();
  }
}
```

- [ ] **Step 2: Verify it compiles**

```sh
cd petclinic-ui-test
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```sh
git add petclinic-ui-test/tests/pages/VisitsPage.ts
git commit -m "test(e2e): add VisitsPage page object"
```

---

## Task 12: E2E — `visits.spec.ts`

**Files:**
- Create: `petclinic-ui-test/tests/visits.spec.ts`

- [ ] **Step 1: Create the spec**

```ts
import {test, expect} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {VisitsPage} from './pages/VisitsPage';
import {ApiClient, VisitDto} from './support/api-client';

test.describe('Visits Page', () => {
  let apiClient: ApiClient;
  let screenshotDir: string;

  test.beforeAll(() => {
    apiClient = new ApiClient();
    screenshotDir = path.join(__dirname, '..', 'test-results', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, {recursive: true});
    }
  });

  test.afterEach(async ({page}, testInfo) => {
    const sanitizedTitle = testInfo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(screenshotDir, `${sanitizedTitle}_${timestamp}.png`);
    await page.screenshot({path: screenshotPath, fullPage: true});
    console.log(`Screenshot saved: ${screenshotPath}`);
  });

  test('shows all visits on initial load', async ({page}) => {
    const visits = await apiClient.fetchVisits();
    const expected = visits.map((v: VisitDto) => ({
      date: v.date,
      description: v.description,
      petName: v.petName ?? '',
      ownerFullName: `${v.ownerFirstName ?? ''} ${v.ownerLastName ?? ''}`.trim(),
    }));

    const visitsPage = new VisitsPage(page);
    await visitsPage.open();
    await visitsPage.waitForVisitsCount(expected.length);

    const actual = await visitsPage.getVisitRows();
    expect(ApiClient.sortedByDate(actual)).toEqual(ApiClient.sortedByDate(expected));
  });

  test('rows are sorted descending by date', async ({page}) => {
    const visitsPage = new VisitsPage(page);
    await visitsPage.open();
    const dates = await visitsPage.getDates();
    expect(dates.length).toBeGreaterThan(0);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  test('owner link navigates to owner detail', async ({page}) => {
    const visitsPage = new VisitsPage(page);
    await visitsPage.open();
    await visitsPage.clickFirstOwnerLink();
    await expect(page).toHaveURL(/\/owners\/\d+/);
  });
});
```

- [ ] **Step 2: Boot the stack manually (4 terminals)**

```sh
# Terminal 1
./start-database.sh

# Terminal 2
./start-backend.sh

# Terminal 3
./start-frontend.sh
```

Wait until the frontend logs `Compiled successfully` and `curl -fs http://localhost:8080/api/owners` returns JSON.

- [ ] **Step 3: Run only the visits spec**

```sh
# Terminal 4
cd petclinic-ui-test
SKIP_SERVER_START=true npx playwright test tests/visits.spec.ts
```

Expected: 3 tests pass; screenshots appear in `petclinic-ui-test/test-results/screenshots/`.

- [ ] **Step 4: Run the full E2E suite (regression)**

```sh
SKIP_SERVER_START=true npm test
```

Expected: all green (Owners spec + Visits spec).

- [ ] **Step 5: Commit**

```sh
git add petclinic-ui-test/tests/visits.spec.ts
git commit -m "test(e2e): add Playwright spec for Visits screen"
```

---

## Task 13: Final verification & wrap-up

- [ ] **Step 1: Run the entire backend suite once more**

```sh
cd petclinic-backend
./mvnw -q test
```

Expected: all green (incl. ArchUnit, C4 extractor, Domain extractor).

- [ ] **Step 2: Run the entire frontend suite once more**

```sh
cd ../petclinic-frontend
npm test -- --watch=false
```

Expected: all green.

- [ ] **Step 3: Smoke test in browser (manual)**

With backend + frontend up, open `http://localhost:4200/visits` and confirm:
- Header "Visits" visible.
- Table populated, sorted with most recent date first.
- Owner names render as links pointing to `/owners/{id}` — clicking navigates to owner detail.
- "Add Visit" button at the bottom; clicking goes to `/visits/add`.

- [ ] **Step 4: Confirm no stray uncommitted files**

```sh
cd /Users/victorrentea/workspace/petclinic-clone
git status
```

Expected: working tree clean (architecture diagrams in `docs/generated/` may have been auto-staged/committed by pre-commit during earlier tasks — that's expected).

- [ ] **Step 5: Final summary commit (only if necessary)**

If `git status` shows pending architecture artifact updates not yet committed:

```sh
git add docs/generated
git commit -m "chore(arch): regenerate architecture diagrams [skip ci]"
```

If clean, skip this step.

---

## Self-review notes

- **Spec coverage:** §3.1 → Task 2; §3.2 → Task 3; §3.3 → Task 4; §3.4 → Tasks 1+3+4 (existing tests run in Task 4 step 4); §4.1 → Task 9; §4.2 → Task 8; §4.3 → Tasks 6+7; §4.4 → Task 5; §4.5 → Tasks 6+7; §5 → Tasks 10+11+12; §6 implementation order → Tasks 1–12 in this order; §7 risks → mitigated in Tasks 4 and 2 (readOnly).
- **Naming consistency:** `findAllWithPetAndOwner` used identically in Task 4 step 1 and step 2. CSS classes `visit-date / visit-description / visit-pet / visit-owner / owner-link` used consistently across Task 7 (template) and Task 11 (page object). `#visitsTable` id used in Task 7 + Task 11. `no-visits` class used in Task 6 spec + Task 7 template.
- **No placeholders:** every step has either a runnable command or a concrete code block.
