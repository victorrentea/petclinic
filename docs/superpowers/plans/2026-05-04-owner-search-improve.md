# Owner Search — Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual `lastName`-prefix search with a live debounced multi-field substring search that is case-insensitive and race-safe.

**Architecture:** `GET /api/owners?q={text}` runs a JPQL `LOWER(...) LIKE LOWER('%q%')` over `firstName`, `lastName`, `city`, `address`, `telephone`. The Angular `OwnerListComponent` switches from `[(ngModel)]` + button to a reactive `FormControl` whose `valueChanges` is debounced with `debounceTime(300)` and dispatched through `switchMap` so only the latest request's emission is rendered.

**Tech Stack:** Spring Boot 3.5 / Spring Data JPA / JUnit 5 / MockMvc / Cucumber+RestAssured (backend); Angular 16 / RxJS / Karma+Jasmine / Playwright (frontend & UI tests).

**Spec:** `docs/superpowers/specs/2026-05-04-owner-search-improve-design.md`

---

## File Structure

**Backend:**
- Modify: `petclinic-backend/src/main/java/org/springframework/samples/petclinic/repository/OwnerRepository.java` — replace `findByLastNameStartingWith` with `search(q)`.
- Modify: `petclinic-backend/src/main/java/org/springframework/samples/petclinic/rest/OwnerRestController.java` — rename query param `lastName` → `q`, call `search`.
- Modify: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/rest/OwnerTest.java` — convert the two `?lastName=...` tests, add multi-field assertion.
- Modify: `petclinic-backend/src/test/resources/features/functional/owners.feature` — update the search scenario to use `?q=` and substring semantics.
- Modify: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/OwnerSteps.java` — `theOwnerIsSearchableByLastName` calls `?q=`.

**Frontend:**
- Modify: `petclinic-frontend/src/app/owners/owner.service.ts` — `searchOwners(q)` posts `?q=` (rename param).
- Modify: `petclinic-frontend/src/app/owners/owner.service.spec.ts` — assert new URL.
- Modify: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts` — `FormControl`, `valueChanges`, `debounceTime`, `distinctUntilChanged`, `switchMap`; drop `searchByLastName`.
- Modify: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.html` — remove submit button, switch input to `[formControl]`, relabel.
- Modify: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts` — drop `searchByLastName` tests, add debounce + switchMap tests.

**UI tests (Playwright):**
- Modify: `petclinic-ui-test/tests/pages/OwnersPage.ts` — rename method, drop `findOwnerButton`, type into the input only.
- Modify: `petclinic-ui-test/tests/owners.spec.ts` — adapt to substring semantics (drop the `^prefix` regex check).
- Modify: `petclinic-ui-test/tests/support/api-client.ts` — `fetchOwnersByPrefix` uses `q` param.

---

## Task 1: Backend — repository + controller use `q` with multi-field substring search

**Files:**
- Modify: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/rest/OwnerTest.java`
- Modify: `petclinic-backend/src/main/java/org/springframework/samples/petclinic/repository/OwnerRepository.java`
- Modify: `petclinic-backend/src/main/java/org/springframework/samples/petclinic/rest/OwnerRestController.java`

- [ ] **Step 1: Rewrite the search-related tests in `OwnerTest.java` (red phase)**

Replace the existing `getAllWithAddressFilter`, `getAllWithNameFilter_notFound` methods with the three tests below, and add the new `getAllWithMultiFieldFilter`. Final state of these methods:

```java
    @Test
    void getAllWithLastNameSubstring() throws Exception {
        Owner owner2 = TestData.anOwner();
        owner2.setLastName("JavaBeans");
        int owner2Id = ownerRepository.save(owner2).getId();

        List<OwnerDto> owners = search("/api/owners?q=java");

        assertThat(owners)
            .extracting(OwnerDto::getId, OwnerDto::getLastName)
            .contains(Assertions.tuple(owner2Id, "JavaBeans"));
    }

    @Test
    void getAllWithMultiFieldFilter() throws Exception {
        // The default fixture owner (George Franklin) has city = "London" via TestData.anOwner().
        // A query that does not match any name but matches the city should still return him.
        List<OwnerDto> owners = search("/api/owners?q=lond");

        assertThat(owners)
            .extracting(OwnerDto::getFirstName, OwnerDto::getLastName)
            .contains(Assertions.tuple("George", "Franklin"));
    }

    @Test
    void getAllWithFilter_notFound() throws Exception {
        List<OwnerDto> results = search("/api/owners?q=NonExistent");

        assertThat(results).isEmpty();
    }
```

- [ ] **Step 2: Run the failing tests**

```sh
cd petclinic-backend
./mvnw test -Dtest=OwnerTest#getAllWithLastNameSubstring+getAllWithMultiFieldFilter+getAllWithFilter_notFound
```

Expected: FAIL — controller still ignores `q` and `?q=lond` returns the full list (so `getAllWithFilter_notFound` fails because `results` is non-empty); MultiField + Substring may pass coincidentally because the controller falls through to `findAll()`.

- [ ] **Step 3: Replace the repository method**

In `OwnerRepository.java`, swap `findByLastNameStartingWith` for a JPQL `search`:

```java
package org.springframework.samples.petclinic.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import org.springframework.samples.petclinic.model.Owner;

public interface OwnerRepository extends Repository<Owner, Integer> {

    @Query("""
        SELECT o FROM Owner o
        WHERE LOWER(o.firstName) LIKE LOWER(CONCAT('%', :q, '%'))
           OR LOWER(o.lastName)  LIKE LOWER(CONCAT('%', :q, '%'))
           OR LOWER(o.city)      LIKE LOWER(CONCAT('%', :q, '%'))
           OR LOWER(o.address)   LIKE LOWER(CONCAT('%', :q, '%'))
           OR LOWER(o.telephone) LIKE LOWER(CONCAT('%', :q, '%'))
        """)
    List<Owner> search(@Param("q") String q);

    Optional<Owner> findById(int id);

    Owner save(Owner owner);

    List<Owner> findAll();

    void delete(Owner owner);

}
```

- [ ] **Step 4: Update the controller param + dispatch**

In `OwnerRestController.java`, replace the `listOwners` body:

```java
    @Operation(operationId = "listOwners", summary = "List owners")
    @GetMapping(produces = "application/json")
    public List<OwnerDto> listOwners(@RequestParam(name = "q", required = false) String q) {
        List<Owner> owners = (q != null) ? ownerRepository.search(q) : ownerRepository.findAll();
        return ownerMapper.toOwnerDtoCollection(owners);
    }
```

- [ ] **Step 5: Re-run the targeted tests + the full controller test class**

```sh
cd petclinic-backend
./mvnw test -Dtest=OwnerTest
```

Expected: PASS for all 22+ tests in `OwnerTest`.

- [ ] **Step 6: Commit**

```sh
git add petclinic-backend/src/main/java/org/springframework/samples/petclinic/repository/OwnerRepository.java \
        petclinic-backend/src/main/java/org/springframework/samples/petclinic/rest/OwnerRestController.java \
        petclinic-backend/src/test/java/org/springframework/samples/petclinic/rest/OwnerTest.java
git commit -m "feat(owners): replace lastName prefix search with multi-field substring q param"
```

---

## Task 2: Backend — update Cucumber functional tests for new param

**Files:**
- Modify: `petclinic-backend/src/test/resources/features/functional/owners.feature`
- Modify: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/OwnerSteps.java`

- [ ] **Step 1: Update the feature file**

In `owners.feature`, change the existing "Search owners by last name" scenario to use `?q=`. Replace the scenario with:

```gherkin
  Scenario: Search owners by substring across fields
    Given the following owners exist:
      | firstName | lastName  |
      | George    | Franklin  |
      | Betty     | Davis     |
      | Harold    | Davis     |
    When I GET "/api/owners?q=Dav"
    Then the response status is 200
    And the response JSON array has size 2
    And every item in the response has "lastName" equal to "Davis"
```

(The substring `Dav` still uniquely matches the two Davis surnames in this fixture.)

- [ ] **Step 2: Update the step that registers/searches by last name**

In `OwnerSteps.java`, change `theOwnerIsSearchableByLastName` to use `?q=` so the "Register a new owner → searchable" scenario keeps passing:

```java
    @Then("the owner is searchable by last name {string}")
    public void theOwnerIsSearchableByLastName(String lastName) {
        var response = RestAssured.given()
            .baseUri(http.baseUri())
            .get("/api/owners?q=" + lastName);
        assertThat(response.statusCode()).isEqualTo(200);
        List<String> lastNames = response.jsonPath().getList("lastName", String.class);
        assertThat(lastNames).contains(lastName);
    }
```

- [ ] **Step 3: Run the functional tests**

```sh
cd petclinic-backend
./mvnw test -Dtest=*Cucumber*,*Functional*
```

If the project's Cucumber runner has a different name, run the full suite:

```sh
./mvnw test
```

Expected: PASS — no compilation errors, all owners scenarios green.

- [ ] **Step 4: Commit**

```sh
git add petclinic-backend/src/test/resources/features/functional/owners.feature \
        petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/OwnerSteps.java
git commit -m "test(owners): switch functional search step to ?q= multi-field param"
```

---

## Task 3: Frontend — `OwnerService.searchOwners(q)` uses `?q=`

**Files:**
- Modify: `petclinic-frontend/src/app/owners/owner.service.spec.ts`
- Modify: `petclinic-frontend/src/app/owners/owner.service.ts`

- [ ] **Step 1: Update the service test (red)**

In `owner.service.spec.ts`, replace the last `it(...)` block with:

```ts
  it('search owners by query (multi-field substring)', () => {
    ownerService.searchOwners('Fr').subscribe((owners) => {
      expect(owners).toEqual(expectedOwners);
    });

    const req = httpTestingController.expectOne(
      ownerService.entityUrl + '?q=Fr'
    );
    expect(req.request.method).toEqual('GET');
    req.flush(expectedOwners);
  });
```

- [ ] **Step 2: Run, watch it fail**

```sh
cd petclinic-frontend
npm run test-headless -- --include='**/owner.service.spec.ts'
```

Expected: FAIL — `httpTestingController.expectOne` cannot match the URL because the service still emits `?lastName=Fr`.

- [ ] **Step 3: Update the service**

In `owner.service.ts`, replace the `searchOwners` method:

```ts
  searchOwners(q: string): Observable<Owner[]> {
    let url = this.entityUrl;
    if (q !== undefined && q !== '') {
      url += '?q=' + encodeURIComponent(q);
    }
    return this.http
      .get<Owner[]>(url)
      .pipe(catchError(this.handlerError('searchOwners', [])));
  }
```

- [ ] **Step 4: Run again, watch it pass**

```sh
cd petclinic-frontend
npm run test-headless -- --include='**/owner.service.spec.ts'
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add petclinic-frontend/src/app/owners/owner.service.ts \
        petclinic-frontend/src/app/owners/owner.service.spec.ts
git commit -m "feat(owners): rename searchOwners parameter to q"
```

---

## Task 4: Frontend — live debounced search in `OwnerListComponent`

**Files:**
- Modify: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts`
- Modify: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts`
- Modify: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.html`

- [ ] **Step 1: Rewrite the component spec (red)**

Replace the file `owner-list.component.spec.ts` with:

```ts
/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, fakeAsync, tick, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DebugElement, NO_ERRORS_SCHEMA } from '@angular/core';

import { OwnerListComponent } from './owner-list.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { Observable, Subject, of } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';
import { CommonModule } from '@angular/common';
import { PartsModule } from '../../parts/parts.module';
import { ActivatedRouteStub } from '../../testing/router-stubs';
import { OwnerDetailComponent } from '../owner-detail/owner-detail.component';
import { OwnersModule } from '../owners.module';
import { DummyComponent } from '../../testing/dummy.component';
import { OwnerAddComponent } from '../owner-add/owner-add.component';
import { OwnerEditComponent } from '../owner-edit/owner-edit.component';
import Spy = jasmine.Spy;


class OwnerServiceStub {
  getOwners(): Observable<Owner[]> {
    return of();
  }

  searchOwners(q: string): Observable<Owner[]> {
    return of();
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService = new OwnerServiceStub();
  let getOwnersSpy: Spy;
  let searchOwnersSpy: Spy;
  let de: DebugElement;
  let el: HTMLElement;

  const testOwner: Owner = {
    id: 1,
    firstName: 'George',
    lastName: 'Franklin',
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    pets: []
  };
  let testOwners: Owner[];

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, ReactiveFormsModule, PartsModule, OwnersModule,
        RouterTestingModule.withRoutes(
          [{ path: 'owners', component: OwnerListComponent },
            { path: 'owners/add', component: OwnerAddComponent },
            { path: 'owners/:id', component: OwnerDetailComponent },
            { path: 'owners/:id/edit', component: OwnerEditComponent }
          ])],
      providers: [
        { provide: OwnerService, useValue: ownerService },
        { provide: ActivatedRoute, useClass: ActivatedRouteStub }
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    testOwners = [testOwner];

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    getOwnersSpy = spyOn(ownerService, 'getOwners')
      .and.returnValue(of(testOwners));
    searchOwnersSpy = spyOn(ownerService, 'searchOwners')
      .and.returnValue(of(testOwners));
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('shows full name after initial getOwners', fakeAsync(() => {
    fixture.detectChanges();
    tick(0); // flush startWith emission through the pipeline
    fixture.detectChanges();
    de = fixture.debugElement.query(By.css('.ownerFullName'));
    el = de.nativeElement;
    expect(el.innerText).toBe(testOwner.firstName + ' ' + testOwner.lastName);
  }));

  it('debounces typing then calls searchOwners with the latest term', fakeAsync(() => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();
    searchOwnersSpy.calls.reset();

    component.searchControl.setValue('F');
    tick(100);
    component.searchControl.setValue('Fr');
    tick(100);
    component.searchControl.setValue('Fra');
    tick(300); // exceed debounce window

    expect(searchOwnersSpy).toHaveBeenCalledTimes(1);
    expect(searchOwnersSpy).toHaveBeenCalledWith('Fra');
  }));

  it('reverts to getOwners when the input is cleared', fakeAsync(() => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();
    searchOwnersSpy.calls.reset();

    component.searchControl.setValue('Fra');
    tick(300);
    component.searchControl.setValue('');
    tick(300);

    expect(getOwnersSpy).toHaveBeenCalled();
  }));

  it('renders only the latest response (race-safe via switchMap)', fakeAsync(() => {
    fixture.detectChanges();

    const slow = new Subject<Owner[]>();
    const fast = new Subject<Owner[]>();
    searchOwnersSpy.and.returnValues(slow.asObservable(), fast.asObservable());

    component.searchControl.setValue('Fr');
    tick(300);
    component.searchControl.setValue('Fra');
    tick(300);

    // Fast (latest) emits first, slow (stale) emits later — stale must NOT overwrite results.
    fast.next([testOwner]);
    fast.complete();
    slow.next([{ ...testOwner, id: 999, firstName: 'STALE', lastName: 'STALE' }]);
    slow.complete();

    expect(component.owners).toEqual([testOwner]);
  }));

});
```

- [ ] **Step 2: Run the spec, watch it fail**

```sh
cd petclinic-frontend
npm run test-headless -- --include='**/owner-list.component.spec.ts'
```

Expected: FAIL — `component.searchControl` is undefined.

- [ ] **Step 3: Rewrite the component**

Replace `owner-list.component.ts` with:

```ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, startWith, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  errorMessage: string;
  owners: Owner[];
  isOwnersDataReceived: boolean = false;

  readonly searchControl = new FormControl('');
  private subscription: Subscription;

  constructor(private router: Router, private ownerService: OwnerService) {
  }

  ngOnInit() {
    this.subscription = this.searchControl.valueChanges.pipe(
      debounceTime(300),
      startWith(this.searchControl.value ?? ''),
      distinctUntilChanged(),
      switchMap(q => {
        const trimmed = (q ?? '').trim();
        return trimmed
          ? this.ownerService.searchOwners(trimmed)
          : this.ownerService.getOwners();
      })
    ).subscribe(
      owners => {
        this.owners = owners;
        this.isOwnersDataReceived = true;
      },
      error => this.errorMessage = error as any
    );
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }
}
```

- [ ] **Step 4: Replace the template**

Rewrite `owner-list.component.html`:

```html
<div class="container-fluid">
  <div class="container xd-container">
    <h2>Owners</h2>

    <form id="search-owner-form">
      <div class="form-group">
        <div class="control-group" id="searchGroup">
          <label class="control-label" for="ownerSearch">Search </label>
          <div>
            <input class="form-control" size="30" maxlength="80"
                   id="ownerSearch" name="q"
                   [formControl]="searchControl"
                   placeholder="Type to search by name, city, address, phone…"/>
          </div>
        </div>
      </div>
    </form>

    <div *ngIf="!owners || owners.length === 0">
      No owners match "{{ searchControl.value }}"
    </div>
    <div class="table-responsive" id="ownersTable" *ngIf="owners && owners.length > 0">
      <table class="table table-striped">
        <thead>
        <tr>
          <th>Name</th>
          <th>Address</th>
          <th>City</th>
          <th>Telephone</th>
          <th>Pets</th>
        </tr>
        </thead>

        <tbody>
        <tr *ngFor="let owner of owners">
          <td class="ownerFullName"><a routerLink="/owners/{{owner.id}}" routerLinkActive="active"
                                       (click)="onSelect(owner)">{{ owner.firstName }} {{ owner.lastName }}</a></td>
          <td>{{ owner.address }}</td>
          <td>{{ owner.city }}</td>
          <td>{{ owner.telephone }}</td>
          <td>
            <tr *ngFor="let pet of owner.pets">
              {{ pet.name }}
            </tr>
          </td>
        </tr>
        </tbody>
      </table>
    </div>
    <div>
      <button *ngIf="isOwnersDataReceived" class="btn btn-default" (click)="addOwner()">Add Owner</button>
    </div>
  </div>
</div>
```

(Notes: removed the **Find Owner** submit button; moved **Add Owner** outside the table so it shows on empty results too; kept `id="ownersTable"` and `class="ownerFullName"` selectors so existing Playwright tests still find rows.)

- [ ] **Step 5: Make sure `ReactiveFormsModule` is imported by `OwnersModule`**

Open `petclinic-frontend/src/app/owners/owners.module.ts` and confirm `ReactiveFormsModule` is in `imports`. If missing, add:

```ts
import { ReactiveFormsModule } from '@angular/forms';
// …
imports: [..., ReactiveFormsModule],
```

- [ ] **Step 6: Run the spec, watch it pass**

```sh
cd petclinic-frontend
npm run test-headless -- --include='**/owner-list.component.spec.ts'
```

Expected: PASS for all five tests.

- [ ] **Step 7: Smoke-test the page in the browser**

In one terminal: `cd petclinic-backend && ./mvnw spring-boot:run`
In another: `cd petclinic-frontend && npm start`
Open http://localhost:4200/owners and verify:
1. All owners load on first paint.
2. Typing `l` (no Enter) shows George Franklin, Jean Coleman, Harold Davis (and any other 'l' substring matches).
3. Typing `LON` (uppercase) still matches city = "London".
4. Clearing the input restores the full list.

- [ ] **Step 8: Commit**

```sh
git add petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts \
        petclinic-frontend/src/app/owners/owner-list/owner-list.component.html \
        petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts \
        petclinic-frontend/src/app/owners/owners.module.ts
git commit -m "feat(owners): live debounced multi-field search with switchMap race protection"
```

---

## Task 5: Playwright UI tests — adapt to live search and substring semantics

**Files:**
- Modify: `petclinic-ui-test/tests/pages/OwnersPage.ts`
- Modify: `petclinic-ui-test/tests/owners.spec.ts`
- Modify: `petclinic-ui-test/tests/support/api-client.ts`

- [ ] **Step 1: Update the page object**

Rewrite `OwnersPage.ts` to drop the button and use the renamed input id:

```ts
import { Page, Locator } from '@playwright/test';

export class OwnersPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly searchInput: Locator;
  readonly ownerNameCells: Locator;
  readonly ownersTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h2:has-text("Owners")');
    this.searchInput = page.locator('#ownerSearch');
    this.ownerNameCells = page.locator('#ownersTable td.ownerFullName');
    this.ownersTable = page.locator('#ownersTable');
  }

  async open() {
    await this.page.goto('/owners');
    await this.pageTitle.waitFor({ state: 'visible', timeout: 10000 });
  }

  async getOwnerFullNames(): Promise<string[]> {
    await this.page.waitForSelector('#ownersTable td.ownerFullName, #ownerSearch', { timeout: 10000 });
    const elements = await this.ownerNameCells.all();
    const names: string[] = [];
    for (const element of elements) {
      const text = await element.textContent();
      if (text && text.trim()) {
        names.push(text.trim());
      }
    }
    return names;
  }

  async search(query: string) {
    await this.searchInput.waitFor({ state: 'visible' });
    await this.searchInput.clear();
    await this.searchInput.fill(query);
    // Wait past the 300 ms debounce so the request fires and the table updates.
    await this.page.waitForTimeout(400);
  }

  async waitForOwnersCount(expectedCount: number) {
    try {
      await this.page.waitForFunction(
        (count) => {
          const cells = document.querySelectorAll('#ownersTable td.ownerFullName');
          return cells.length === count;
        },
        expectedCount,
        { timeout: 10000 }
      );
    } catch (error) {
      // Let assertions fail with actual values when wait condition is not met
    }
  }
}
```

- [ ] **Step 2: Update the api-client**

In `api-client.ts`, change `fetchOwnersByPrefix` to use the new param name (rename to `fetchOwnersByQuery` for clarity):

```ts
  async fetchOwnersByQuery(query: string): Promise<OwnerDto[]> {
    const response = await this.http.get<OwnerDto[]>('/api/owners', {
      params: { q: query }
    });
    return response.data;
  }
```

Keep the `extractLastName`, `getFullNames`, `sorted`, `choosePrefixFrom` helpers as-is.

- [ ] **Step 3: Update the spec**

Rewrite the second test in `owners.spec.ts` (the first test "shows all owners on initial load" stays unchanged):

```ts
  test('filters owners by substring across multiple fields', async ({ page }) => {
    const allOwners = await apiClient.fetchOwners();
    const query = ApiClient.choosePrefixFrom(allOwners); // a 2-letter substring drawn from real data

    const expectedFilteredOwners = await apiClient.fetchOwnersByQuery(query);
    const expectedFilteredFullNames = ApiClient.getFullNames(expectedFilteredOwners);

    const ownersPage = new OwnersPage(page);
    await ownersPage.open();

    await ownersPage.search(query);
    await ownersPage.waitForOwnersCount(expectedFilteredFullNames.length);

    const actualFilteredFullNames = await ownersPage.getOwnerFullNames();

    expect(actualFilteredFullNames.length).toBeGreaterThan(0);
    // Substring match anywhere in the full name OR any other displayed field; we only
    // assert exact equivalence with the API's filtered set, since the regex `^prefix`
    // check no longer holds (matches can come from address/city/phone, not just lastName).
    expect(ApiClient.sorted(actualFilteredFullNames)).toEqual(
      ApiClient.sorted(expectedFilteredFullNames)
    );
  });
```

- [ ] **Step 4: Run the Playwright suite**

```sh
cd petclinic-ui-test
npm test -- tests/owners.spec.ts
```

(Backend on :8080 and frontend on :4200 must be running — see `petclinic-ui-test/CLAUDE.md`.)

Expected: PASS for both tests in `owners.spec.ts`.

- [ ] **Step 5: Commit**

```sh
git add petclinic-ui-test/tests/pages/OwnersPage.ts \
        petclinic-ui-test/tests/owners.spec.ts \
        petclinic-ui-test/tests/support/api-client.ts
git commit -m "test(owners): adapt Playwright suite to live multi-field q search"
```

---

## Verification (after all tasks)

```sh
cd petclinic-backend && ./mvnw test
cd ../petclinic-frontend && npm run test-headless
cd ../petclinic-ui-test && npm test
```

All three suites green → done.
