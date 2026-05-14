# Owners Pagination and Sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side pagination and header-click sorting to the owners grid, with viewport-driven page sizing, isolated frontend/backend tests, and one Playwright headless regression.

**Architecture:** The backend will expose a paged `GET /api/owners` contract that accepts filtering, sorting, and page sizing parameters and returns explicit page metadata. The frontend owners screen will keep paged-grid state locally, compute the page size from viewport measurements, debounce resize updates by 1 second, and drive the API through a typed service. Testing follows the pyramid: Spring Boot integration tests for the REST endpoint, Angular isolated tests for service/state/layout logic, and one Playwright flow over the real UI.

**Tech Stack:** Spring Boot 3.5, Spring Data JPA, Angular 16, RxJS, Jasmine/Karma, Playwright

---

## File map

### Backend

- Create: `petclinic-backend/src/main/java/victor/training/petclinic/rest/dto/OwnerPageDto.java` — explicit paged response DTO for `/api/owners`
- Modify: `petclinic-backend/src/main/java/victor/training/petclinic/repository/OwnerRepository.java` — pageable owner search with stable sorting
- Modify: `petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java` — paged/sorted `listOwners`
- Modify: `openapi.yaml` — paged owners contract for frontend codegen
- Create: `petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerTest.java` — backend integration tests for owners listing

### Frontend

- Modify: `petclinic-frontend/src/app/owners/owner-page.ts` — align the page model with generated API schema
- Modify: `petclinic-frontend/src/app/owners/owner.service.ts` — paged owner search API
- Modify: `petclinic-frontend/src/app/owners/owner.service.spec.ts` — request/response tests for paged owners
- Create: `petclinic-frontend/src/app/owners/owner-list/owner-list-layout.ts` — pure viewport-to-page-size calculation helper
- Create: `petclinic-frontend/src/app/owners/owner-list/owner-list-layout.spec.ts` — isolated helper tests
- Modify: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts` — paged state, sorting, resize debounce
- Modify: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.html` — sortable headers and pagination controls
- Modify: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.css` — active sort indicator and stable layout
- Modify: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts` — component state/resize tests
- Modify: `petclinic-frontend/src/app/generated/api-types.ts` — regenerated from `openapi.yaml`

### End-to-end

- Modify: `petclinic-ui-test/tests/support/api-client.ts` — paged owner API helpers
- Modify: `petclinic-ui-test/tests/pages/OwnersPage.ts` — sortable headers and pagination page object
- Modify: `petclinic-ui-test/tests/owners.spec.ts` — one integrated pagination + sorting scenario

### Commands used during implementation

- Backend focused test: `cd petclinic-backend && ./mvnw -Dtest=OwnerTest test`
- Frontend focused test: `cd petclinic-frontend && npx ng test --no-watch --no-progress --browsers=ChromeHeadlessCI --include src/app/owners/owner.service.spec.ts --include src/app/owners/owner-list/owner-list-layout.spec.ts --include src/app/owners/owner-list/owner-list.component.spec.ts`
- Frontend codegen: `cd petclinic-frontend && npm run generate:api`
- Playwright focused test: `cd petclinic-ui-test && npx playwright test tests/owners.spec.ts`

### Task 1: Backend paged owners API

**Files:**
- Create: `petclinic-backend/src/main/java/victor/training/petclinic/rest/dto/OwnerPageDto.java`
- Modify: `petclinic-backend/src/main/java/victor/training/petclinic/repository/OwnerRepository.java`
- Modify: `petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java`
- Modify: `openapi.yaml`
- Test: `petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerTest.java`

- [ ] **Step 1: Write the failing backend integration test**

```java
@Test
void listOwners_returnsPagedAndSortedResults() throws Exception {
    ownerRepository.save(new Owner().setFirstName("Amy").setLastName("Zeal").setAddress("A").setCity("Zurich").setTelephone("111"));
    ownerRepository.save(new Owner().setFirstName("Bob").setLastName("Able").setAddress("B").setCity("Athens").setTelephone("222"));
    ownerRepository.save(new Owner().setFirstName("Cara").setLastName("Mills").setAddress("C").setCity("Berlin").setTelephone("333"));

    String json = mockMvc.perform(get("/api/owners")
            .param("page", "0")
            .param("size", "2")
            .param("sortField", "name")
            .param("sortDirection", "asc"))
        .andExpect(status().isOk())
        .andExpect(content().contentType("application/json"))
        .andReturn()
        .getResponse()
        .getContentAsString();

    OwnerPageDto page = mapper.readValue(json, OwnerPageDto.class);
    assertThat(page.getTotalElements()).isGreaterThanOrEqualTo(3);
    assertThat(page.getSize()).isEqualTo(2);
    assertThat(page.getContent()).extracting(OwnerDto::getLastName).startsWith("Able", "Mills");
}
```

- [ ] **Step 2: Run the backend test to verify it fails**

Run: `cd petclinic-backend && ./mvnw -Dtest=OwnerTest test`

Expected: FAIL because `OwnerPageDto` does not exist and `/api/owners` still returns `OwnerDto[]`.

- [ ] **Step 3: Add the page DTO and pageable repository contract**

```java
@Data
public class OwnerPageDto {
    private List<OwnerDto> content = new ArrayList<>();
    private long totalElements;
    private int totalPages;
    private int number;
    private int size;
}
```

```java
@EntityGraph(attributePaths = {"pets", "pets.type"})
@Query(
    value = """
        select distinct o
        from Owner o
        left join o.pets p
        where :query = ''
           or lower(concat(concat(o.firstName, ' '), o.lastName)) like lower(concat('%', :query, '%'))
           or lower(o.address) like lower(concat('%', :query, '%'))
           or lower(o.city) like lower(concat('%', :query, '%'))
           or lower(o.telephone) like lower(concat('%', :query, '%'))
           or lower(p.name) like lower(concat('%', :query, '%'))
        """,
    countQuery = """
        select count(distinct o.id)
        from Owner o
        left join o.pets p
        where :query = ''
           or lower(concat(concat(o.firstName, ' '), o.lastName)) like lower(concat('%', :query, '%'))
           or lower(o.address) like lower(concat('%', :query, '%'))
           or lower(o.city) like lower(concat('%', :query, '%'))
           or lower(o.telephone) like lower(concat('%', :query, '%'))
           or lower(p.name) like lower(concat('%', :query, '%'))
        """
)
Page<Owner> searchByVisibleContent(@Param("query") String query, Pageable pageable);
```

- [ ] **Step 4: Implement controller paging/sorting and document it in OpenAPI**

```java
@GetMapping(produces = "application/json")
public OwnerPageDto listOwners(
    @RequestParam(name = "query", defaultValue = "") String query,
    @RequestParam(name = "page", defaultValue = "0") int page,
    @RequestParam(name = "size", defaultValue = "5") int size,
    @RequestParam(name = "sortField", defaultValue = "name") String sortField,
    @RequestParam(name = "sortDirection", defaultValue = "asc") String sortDirection
) {
    PageRequest pageRequest = PageRequest.of(page, size, ownerSort(sortField, sortDirection));
    Page<Owner> ownersPage = ownerRepository.searchByVisibleContent(query, pageRequest);

    OwnerPageDto response = new OwnerPageDto();
    response.setContent(ownerMapper.toOwnerDtoCollection(ownersPage.getContent()));
    response.setTotalElements(ownersPage.getTotalElements());
    response.setTotalPages(ownersPage.getTotalPages());
    response.setNumber(ownersPage.getNumber());
    response.setSize(ownersPage.getSize());
    return response;
}
```

```java
private Sort ownerSort(String sortField, String sortDirection) {
    Sort.Direction direction = "desc".equalsIgnoreCase(sortDirection) ? Sort.Direction.DESC : Sort.Direction.ASC;
    return switch (sortField) {
        case "city" -> Sort.by(direction, "city").and(Sort.by(direction, "lastName", "firstName", "id"));
        case "name" -> Sort.by(direction, "lastName", "firstName", "id");
        default -> throw new IllegalArgumentException("Unsupported sortField: " + sortField);
    };
}
```

```yaml
      - name: page
        in: query
        schema: { type: integer, default: 0, minimum: 0 }
      - name: size
        in: query
        schema: { type: integer, default: 5, minimum: 1 }
      - name: sortField
        in: query
        schema: { type: string, default: name, enum: [name, city] }
      - name: sortDirection
        in: query
        schema: { type: string, default: asc, enum: [asc, desc] }
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/OwnerPageDto"

components:
  schemas:
    OwnerPageDto:
      type: object
      properties:
        content:
          type: array
          items:
            $ref: "#/components/schemas/OwnerDto"
        totalElements:
          type: integer
          format: int64
        totalPages:
          type: integer
          format: int32
        number:
          type: integer
          format: int32
        size:
          type: integer
          format: int32
```

- [ ] **Step 5: Extend backend tests for filtering and descending sort**

```java
@Test
void listOwners_filtersAndSortsByCityDescending() throws Exception {
    ownerRepository.save(new Owner().setFirstName("Dora").setLastName("Lane").setAddress("D").setCity("Cluj").setTelephone("444"));
    ownerRepository.save(new Owner().setFirstName("Eli").setLastName("Lane").setAddress("E").setCity("Arad").setTelephone("555"));

    String json = mockMvc.perform(get("/api/owners")
            .param("query", "Lane")
            .param("page", "0")
            .param("size", "10")
            .param("sortField", "city")
            .param("sortDirection", "desc"))
        .andExpect(status().isOk())
        .andReturn()
        .getResponse()
        .getContentAsString();

    OwnerPageDto page = mapper.readValue(json, OwnerPageDto.class);
    assertThat(page.getContent()).extracting(OwnerDto::getCity).startsWith("Cluj", "Arad");
}
```

- [ ] **Step 6: Run the backend test suite for owners and confirm it passes**

Run: `cd petclinic-backend && ./mvnw -Dtest=OwnerTest test`

Expected: PASS with the new paging metadata and ordering assertions green.

- [ ] **Step 7: Commit the backend slice**

```bash
git add openapi.yaml \
  petclinic-backend/src/main/java/victor/training/petclinic/rest/dto/OwnerPageDto.java \
  petclinic-backend/src/main/java/victor/training/petclinic/repository/OwnerRepository.java \
  petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java \
  petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerTest.java
git commit -m "feat: page and sort owners API"
```

### Task 2: Frontend service contract and pure layout calculation

**Files:**
- Modify: `petclinic-frontend/src/app/owners/owner-page.ts`
- Modify: `petclinic-frontend/src/app/owners/owner.service.ts`
- Modify: `petclinic-frontend/src/app/owners/owner.service.spec.ts`
- Create: `petclinic-frontend/src/app/owners/owner-list/owner-list-layout.ts`
- Create: `petclinic-frontend/src/app/owners/owner-list/owner-list-layout.spec.ts`
- Modify: `petclinic-frontend/src/app/generated/api-types.ts`

- [ ] **Step 1: Write the failing frontend service and layout tests**

```ts
it('searchOwners should send paging and sorting query params', () => {
  ownerService.searchOwners({
    query: 'Lane',
    page: 1,
    size: 7,
    sortField: 'city',
    sortDirection: 'desc'
  }).subscribe(page => expect(page.totalElements).toBe(2));

  const req = httpTestingController.expectOne(
    `${ownerService.entityUrl}?query=Lane&page=1&size=7&sortField=city&sortDirection=desc`
  );
  expect(req.request.method).toEqual('GET');
});
```

```ts
it('calculates page size from available viewport height', () => {
  expect(calculateOwnerPageSize({
    viewportHeight: 900,
    contentTop: 120,
    reservedHeight: 180,
    rowHeight: 48
  })).toBe(12);
});
```

- [ ] **Step 2: Run the focused frontend tests and verify they fail**

Run: `cd petclinic-frontend && npx ng test --no-watch --no-progress --browsers=ChromeHeadlessCI --include src/app/owners/owner.service.spec.ts --include src/app/owners/owner-list/owner-list-layout.spec.ts`

Expected: FAIL because `searchOwners` still returns `Owner[]` and `calculateOwnerPageSize` does not exist.

- [ ] **Step 3: Regenerate types and update the owner service contract**

```bash
cd petclinic-frontend
npm run generate:api
```

```ts
export interface OwnerSearchRequest {
  query: string;
  page: number;
  size: number;
  sortField: 'name' | 'city';
  sortDirection: 'asc' | 'desc';
}

searchOwners(request: OwnerSearchRequest): Observable<OwnerPage> {
  const params = new HttpParams()
    .set('query', request.query)
    .set('page', request.page.toString())
    .set('size', request.size.toString())
    .set('sortField', request.sortField)
    .set('sortDirection', request.sortDirection);

  return this.http
    .get<OwnerPage>(this.entityUrl, { params })
    .pipe(catchError(this.handlerError('searchOwners', {
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: request.size
    })));
}
```

- [ ] **Step 4: Add the pure page-size calculator**

```ts
export interface OwnerPageSizeInput {
  viewportHeight: number;
  contentTop: number;
  reservedHeight: number;
  rowHeight: number;
}

export function calculateOwnerPageSize(input: OwnerPageSizeInput): number {
  const availableHeight = input.viewportHeight - input.contentTop - input.reservedHeight;
  return Math.max(1, Math.floor(availableHeight / input.rowHeight));
}
```

- [ ] **Step 5: Finish the service/layout tests and run them again**

```ts
const expectedPage: OwnerPage = {
  content: expectedOwners,
  totalElements: 2,
  totalPages: 1,
  number: 0,
  size: 7
};
req.flush(expectedPage);
```

Run: `cd petclinic-frontend && npx ng test --no-watch --no-progress --browsers=ChromeHeadlessCI --include src/app/owners/owner.service.spec.ts --include src/app/owners/owner-list/owner-list-layout.spec.ts`

Expected: PASS with the paged HTTP contract and page-size math covered.

- [ ] **Step 6: Commit the service/layout slice**

```bash
git add petclinic-frontend/src/app/generated/api-types.ts \
  petclinic-frontend/src/app/owners/owner-page.ts \
  petclinic-frontend/src/app/owners/owner.service.ts \
  petclinic-frontend/src/app/owners/owner.service.spec.ts \
  petclinic-frontend/src/app/owners/owner-list/owner-list-layout.ts \
  petclinic-frontend/src/app/owners/owner-list/owner-list-layout.spec.ts
git commit -m "feat: add paged owner service contract"
```

### Task 3: Owners grid state, sortable headers, and resize behavior

**Files:**
- Modify: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts`
- Modify: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.html`
- Modify: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.css`
- Modify: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts`

- [ ] **Step 1: Write the failing component tests for sort, reset, and resize debounce**

```ts
it('resets to the first page when the search term changes', () => {
  component.page = 3;
  component.onSearchTermChange('Lane');
  expect(component.page).toBe(0);
});
```

```ts
it('toggles the active sort direction when the same header is clicked twice', () => {
  component.changeSort('name');
  component.changeSort('name');
  expect(component.sortDirection).toBe('desc');
});
```

```ts
it('recalculates page size after a debounced resize', fakeAsync(() => {
  spyOn(component as any, 'measurePageSize').and.returnValue(8);
  window.dispatchEvent(new Event('resize'));
  tick(1000);
  expect(component.pageSize).toBe(8);
}));
```

- [ ] **Step 2: Run the focused component test to verify it fails**

Run: `cd petclinic-frontend && npx ng test --no-watch --no-progress --browsers=ChromeHeadlessCI --include src/app/owners/owner-list/owner-list.component.spec.ts`

Expected: FAIL because the component still stores only `Owner[]` and has no paging/sorting/resize API.

- [ ] **Step 3: Implement paged state and debounced resize handling in the component**

```ts
page = 0;
pageSize = 1;
sortField: 'name' | 'city' = 'name';
sortDirection: 'asc' | 'desc' = 'asc';
ownersPage: OwnerPage = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 1 };

private readonly resize$ = new Subject<void>();

ngOnInit() {
  this.pageSize = this.measurePageSize();

  merge(
    this.searchTerms$.pipe(tap(() => { this.page = 0; })),
    this.resize$.pipe(
      debounceTime(1000),
      map(() => this.measurePageSize()),
      distinctUntilChanged(),
      tap(size => {
        this.pageSize = size;
        this.page = Math.min(this.page, Math.max(0, this.ownersPage.totalPages - 1));
      })
    )
  ).pipe(
    switchMap(() => this.ownerService.searchOwners({
      query: this.searchTerm,
      page: this.page,
      size: this.pageSize,
      sortField: this.sortField,
      sortDirection: this.sortDirection
    })),
    takeUntil(this.destroy$)
  ).subscribe(page => {
    this.ownersPage = page;
    this.owners = page.content;
    this.isOwnersDataReceived = true;
  });
}
```

- [ ] **Step 4: Implement header sorting and pagination controls in the template**

```html
<th>
  <button type="button" class="owners-sort-button" (click)="changeSort('name')">
    Name
    <span *ngIf="sortField === 'name'">{{ sortDirection === 'asc' ? '▲' : '▼' }}</span>
  </button>
</th>
<th>
  <button type="button" class="owners-sort-button" (click)="changeSort('city')">
    City
    <span *ngIf="sortField === 'city'">{{ sortDirection === 'asc' ? '▲' : '▼' }}</span>
  </button>
</th>
```

```html
<div class="owners-pagination" *ngIf="isOwnersDataReceived">
  <button class="btn btn-default" (click)="goToPreviousPage()" [disabled]="page === 0">Previous</button>
  <span>Page {{ ownersPage.number + 1 }} / {{ ownersPage.totalPages || 1 }}</span>
  <button class="btn btn-default" (click)="goToNextPage()" [disabled]="page + 1 >= ownersPage.totalPages">Next</button>
</div>
```

- [ ] **Step 5: Make the component tests pass and verify the rendered DOM**

```ts
de = fixture.debugElement.query(By.css('.owners-sort-button'));
el = de.nativeElement;
expect(el.textContent).toContain('Name');
```

Run: `cd petclinic-frontend && npx ng test --no-watch --no-progress --browsers=ChromeHeadlessCI --include src/app/owners/owner-list/owner-list.component.spec.ts`

Expected: PASS with sort toggling, page resets, and resize debounce assertions green.

- [ ] **Step 6: Run the full focused frontend owners suite**

Run: `cd petclinic-frontend && npx ng test --no-watch --no-progress --browsers=ChromeHeadlessCI --include src/app/owners/owner.service.spec.ts --include src/app/owners/owner-list/owner-list-layout.spec.ts --include src/app/owners/owner-list/owner-list.component.spec.ts`

Expected: PASS for all isolated frontend owners tests.

- [ ] **Step 7: Commit the owners grid slice**

```bash
git add petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts \
  petclinic-frontend/src/app/owners/owner-list/owner-list.component.html \
  petclinic-frontend/src/app/owners/owner-list/owner-list.component.css \
  petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts
git commit -m "feat: add owners grid pagination UI"
```

### Task 4: Playwright owners regression

**Files:**
- Modify: `petclinic-ui-test/tests/support/api-client.ts`
- Modify: `petclinic-ui-test/tests/pages/OwnersPage.ts`
- Modify: `petclinic-ui-test/tests/owners.spec.ts`

- [ ] **Step 1: Write the failing Playwright scenario**

```ts
test('sorts owners by city and keeps pagination coherent after search reset', async ({ page }) => {
  const ownersPage = new OwnersPage(page);
  await ownersPage.open();
  await ownersPage.clickSortHeader('City');
  const firstPageCities = await ownersPage.getVisibleCities();
  expect(firstPageCities).toEqual([...firstPageCities].sort());

  await ownersPage.goToNextPage();
  await expect(ownersPage.pageIndicator).toContainText('Page 2');

  await ownersPage.search('Lane');
  await expect(ownersPage.pageIndicator).toContainText('Page 1');
});
```

- [ ] **Step 2: Run the focused Playwright spec and verify it fails**

Run: `cd petclinic-ui-test && npx playwright test tests/owners.spec.ts`

Expected: FAIL because the page object still targets the old owners UI and has no pagination/sorting helpers.

- [ ] **Step 3: Update the API client and owners page object for paged owners**

```ts
export interface OwnerPageDto {
  content: OwnerDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

async fetchOwnersPage(params: {
  query?: string;
  page?: number;
  size?: number;
  sortField?: 'name' | 'city';
  sortDirection?: 'asc' | 'desc';
}): Promise<OwnerPageDto> {
  const response = await this.client.get<OwnerPageDto>('/owners', { params });
  return response.data;
}
```

```ts
readonly pageIndicator = this.page.locator('.owners-pagination span');
readonly nextButton = this.page.getByRole('button', { name: 'Next' });
readonly searchInput = this.page.locator('#searchTerm');
readonly cityCells = this.page.locator('#ownersTable tbody tr td:nth-child(3)');

async clickSortHeader(column: 'Name' | 'City') {
  await this.page.getByRole('button', { name: new RegExp(column) }).click();
}

async goToNextPage() {
  await this.nextButton.click();
}

async search(value: string) {
  await this.searchInput.clear();
  await this.searchInput.fill(value);
}

async visibleRowCount(): Promise<number> {
  return this.page.locator('#ownersTable tbody tr').count();
}

async getOwnerCities(): Promise<string[]> {
  return (await this.cityCells.allTextContents()).map(value => value.trim());
}
```

- [ ] **Step 4: Implement one realistic integrated assertion path**

```ts
const apiPage = await apiClient.fetchOwnersPage({
  page: 0,
  size: await ownersPage.visibleRowCount(),
  sortField: 'city',
  sortDirection: 'asc'
});
expect(await ownersPage.getOwnerCities()).toEqual(apiPage.content.map(owner => owner.city ?? ''));
```

- [ ] **Step 5: Run the Playwright spec again and confirm it passes**

Run: `cd petclinic-ui-test && npx playwright test tests/owners.spec.ts`

Expected: PASS for the new paginated/sorted owners flow.

- [ ] **Step 6: Commit the end-to-end slice**

```bash
git add petclinic-ui-test/tests/support/api-client.ts \
  petclinic-ui-test/tests/pages/OwnersPage.ts \
  petclinic-ui-test/tests/owners.spec.ts
git commit -m "test: cover owners pagination and sorting"
```

### Task 5: Final verification and delivery notes

**Files:**
- No new committed files required in this task

- [ ] **Step 1: Run backend owners verification**

Run: `cd petclinic-backend && ./mvnw -Dtest=OwnerTest test`

Expected: PASS

- [ ] **Step 2: Run frontend owners verification**

Run: `cd petclinic-frontend && npx ng test --no-watch --no-progress --browsers=ChromeHeadlessCI --include src/app/owners/owner.service.spec.ts --include src/app/owners/owner-list/owner-list-layout.spec.ts --include src/app/owners/owner-list/owner-list.component.spec.ts`

Expected: PASS

- [ ] **Step 3: Run Playwright owners verification**

Run: `cd petclinic-ui-test && npx playwright test tests/owners.spec.ts`

Expected: PASS

- [ ] **Step 4: Prepare the three extra E2E scenario ideas for the final handoff**

```gherkin
Scenario: Resize the browser and recalculate the owners page size
  Given I am on the owners page
  When I resize the browser to a shorter height
  Then the owners grid reloads with fewer visible rows and no vertical page scroll
```

```gherkin
Scenario: Toggle owners sorting by name
  Given I am on the owners page
  When I click the Name header twice
  Then the owners list is sorted by name descending
```

```gherkin
Scenario: Search from a later page and reset pagination
  Given I am on page 2 of the owners grid
  When I search for "Lane"
  Then I return to page 1 and only matching owners remain
```

- [ ] **Step 5: Commit any final polish if needed**

```bash
git status --short
```

If only the three implementation commits are present and no extra code changed, skip a fourth commit.
