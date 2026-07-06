# GH-40 Visit Date Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject visit dates before the pet birth date or more than one year in the future, first in the backend and then in the frontend with clear user feedback.

**Architecture:** Keep the invariant in the backend `VisitRestController` path with a focused validation helper that has pet context for create and update. Mirror the same range in the Angular visit add/edit forms so invalid dates are blocked before submit and surfaced as normal form validation errors.

**Tech Stack:** Spring Boot MockMvc tests, JPA repositories, Angular template-driven forms, Playwright, Jasmine/Karma

---

### Task 1: Lock the backend invariant with failing controller tests

**Files:**
- Modify: `petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitTest.java`
- Modify: `petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java`
- Create or Modify: `petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitDateRangeValidator.java`

- [ ] **Step 1: Write the failing tests**

```java
@Test
void create_rejectsDateBeforePetBirthDate() throws Exception {
    VisitDto newVisit = new VisitDto();
    newVisit.setPetId(petId);
    newVisit.setDate(LocalDate.of(2000, 1, 1));
    newVisit.setDescription("too early");

    mockMvc.perform(post("/api/visits")
            .content(mapper.writeValueAsString(newVisit))
            .contentType(MediaType.APPLICATION_JSON_VALUE))
        .andExpect(status().isBadRequest());
}

@Test
void create_rejectsDateMoreThanOneYearInFuture() throws Exception {
    VisitDto newVisit = new VisitDto();
    newVisit.setPetId(petId);
    newVisit.setDate(LocalDate.now().plusYears(1).plusDays(1));
    newVisit.setDescription("too late");

    mockMvc.perform(post("/api/visits")
            .content(mapper.writeValueAsString(newVisit))
            .contentType(MediaType.APPLICATION_JSON_VALUE))
        .andExpect(status().isBadRequest());
}

@Test
void update_rejectsDateBeforePetBirthDate() throws Exception {
    VisitDto existing = callGet(visitId);
    existing.setDate(LocalDate.of(2000, 1, 1));

    mockMvc.perform(put("/api/visits/" + visitId)
            .content(mapper.writeValueAsString(existing))
            .contentType(MediaType.APPLICATION_JSON_VALUE))
        .andExpect(status().isBadRequest());
}
```

- [ ] **Step 2: Run the backend test to verify it fails**

Run: `cd /Users/victorrentea/workspace/petclinic/petclinic-backend && ./mvnw -Dtest=VisitTest test`
Expected: FAIL because `/api/visits` currently accepts out-of-range dates.

- [ ] **Step 3: Write minimal backend implementation**

```java
@Component
final class VisitDateRangeValidator {
    private static final long MAX_YEARS_IN_FUTURE = 1;

    void validateForCreate(VisitDto visitDto, PetRepository petRepository) {
        Pet pet = petRepository.findById(visitDto.getPetId()).orElseThrow();
        validate(visitDto.getDate(), pet.getBirthDate());
    }

    void validateForUpdate(VisitFieldsDto visitDto, Visit currentVisit) {
        validate(visitDto.getDate(), currentVisit.getPet().getBirthDate());
    }

    private void validate(LocalDate visitDate, LocalDate petBirthDate) {
        if (visitDate.isBefore(petBirthDate)) {
            throw new ResponseStatusException(BAD_REQUEST, "Visit date must not be before pet birth date");
        }
        if (visitDate.isAfter(LocalDate.now().plusYears(MAX_YEARS_IN_FUTURE))) {
            throw new ResponseStatusException(BAD_REQUEST, "Visit date must not be more than 1 year in the future");
        }
    }
}
```

and call it from `VisitRestController` before save/update:

```java
visitDateRangeValidator.validateForCreate(visitDto);
visitDateRangeValidator.validateForUpdate(visitDto, currentVisit);
```

- [ ] **Step 4: Run the backend test to verify it passes**

Run: `cd /Users/victorrentea/workspace/petclinic/petclinic-backend && ./mvnw -Dtest=VisitTest test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitTest.java \
        petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java \
        petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitDateRangeValidator.java
git commit -m "fix: enforce visit date range in backend"
```

### Task 2: Prove the browser still needs UX validation

**Files:**
- Modify: `petclinic-ui-test/tests/visits.spec.ts`

- [ ] **Step 1: Write the failing Playwright test**

```ts
test('new visit blocks dates before the pet birth date in the UI', async ({page}) => {
  await page.goto('/owners');
  await page.getByRole('link', {name: 'Harry Potter'}).click();
  await page.getByRole('button', {name: 'Add Visit'}).click();

  await page.locator('input[name="date"]').fill('0009/07/20');
  await page.locator('#description').fill('gh40 invalid date');

  await expect(page.getByRole('button', {name: 'Add Visit'})).toBeDisabled();
  await expect(page.locator('.help-block')).toContainText(/birth date|future/i);
});
```

- [ ] **Step 2: Run the Playwright test to verify it fails**

Run: `cd /Users/victorrentea/workspace/petclinic/petclinic-ui-test && npm test -- tests/visits.spec.ts -g "new visit blocks dates before the pet birth date in the UI"`
Expected: FAIL because the form currently enables submit and shows no range error.

- [ ] **Step 3: Keep the backend implementation unchanged**

No production change in this task. The purpose is to prove that backend protection alone does not satisfy the UX requirement.

- [ ] **Step 4: Re-run the Playwright test to keep the failure visible**

Run: `cd /Users/victorrentea/workspace/petclinic/petclinic-ui-test && npm test -- tests/visits.spec.ts -g "new visit blocks dates before the pet birth date in the UI"`
Expected: FAIL

- [ ] **Step 5: Commit**

Do not commit at this stage; the test is intentionally red and should be completed with the frontend fix in Task 3.

### Task 3: Add frontend range validation for both visit forms

**Files:**
- Modify: `petclinic-frontend/src/app/visits/visit-add/visit-add.component.ts`
- Modify: `petclinic-frontend/src/app/visits/visit-add/visit-add.component.html`
- Modify: `petclinic-frontend/src/app/visits/visit-edit/visit-edit.component.ts`
- Modify: `petclinic-frontend/src/app/visits/visit-edit/visit-edit.component.html`
- Modify: `petclinic-frontend/src/app/visits/visit-add/visit-add.component.spec.ts`
- Modify: `petclinic-frontend/src/app/visits/visit-edit/visit-edit.component.spec.ts`
- Modify: `petclinic-ui-test/tests/visits.spec.ts`

- [ ] **Step 1: Add frontend unit tests first**

```ts
it('sets visit date bounds from the current pet and today plus one year', () => {
  component.currentPet = testPet;
  component.setVisitDateBounds();

  expect(component.minVisitDate).toBe('2010-09-07');
  expect(component.maxVisitDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
```

Add the same expectation shape to `VisitEditComponent`.

- [ ] **Step 2: Run the visit component specs to verify they fail**

Run: `cd /Users/victorrentea/workspace/petclinic/petclinic-frontend && npm test -- --watch=false --include src/app/visits/visit-add/visit-add.component.spec.ts --include src/app/visits/visit-edit/visit-edit.component.spec.ts`
Expected: FAIL because the components do not define date bounds yet.

- [ ] **Step 3: Write minimal frontend implementation**

```ts
minVisitDate: string;
maxVisitDate: string;

private setVisitDateBounds() {
  this.minVisitDate = this.currentPet.birthDate;
  this.maxVisitDate = moment().add(1, 'year').format('YYYY-MM-DD');
}
```

Call `setVisitDateBounds()` when the pet loads, and bind the input:

```html
<input matInput
       [matDatepicker]="visitDateDatepicker"
       [min]="minVisitDate"
       [max]="maxVisitDate"
       required
       [ngModel]="visit.date | date:'yyyy-MM-dd'"
       name="date"
       #date="ngModel">
<span class="help-block" *ngIf="date.dirty && date.hasError('matDatepickerMin')">
  Visit date must not be before the pet birth date
</span>
<span class="help-block" *ngIf="date.dirty && date.hasError('matDatepickerMax')">
  Visit date must be within one year from today
</span>
```

- [ ] **Step 4: Run unit specs and Playwright test to verify they pass**

Run: `cd /Users/victorrentea/workspace/petclinic/petclinic-frontend && npm test -- --watch=false --include src/app/visits/visit-add/visit-add.component.spec.ts --include src/app/visits/visit-edit/visit-edit.component.spec.ts`
Expected: PASS

Run: `cd /Users/victorrentea/workspace/petclinic/petclinic-ui-test && npm test -- tests/visits.spec.ts -g "new visit blocks dates before the pet birth date in the UI"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add petclinic-frontend/src/app/visits/visit-add/visit-add.component.ts \
        petclinic-frontend/src/app/visits/visit-add/visit-add.component.html \
        petclinic-frontend/src/app/visits/visit-add/visit-add.component.spec.ts \
        petclinic-frontend/src/app/visits/visit-edit/visit-edit.component.ts \
        petclinic-frontend/src/app/visits/visit-edit/visit-edit.component.html \
        petclinic-frontend/src/app/visits/visit-edit/visit-edit.component.spec.ts \
        petclinic-ui-test/tests/visits.spec.ts
git commit -m "fix: block invalid visit dates in visit forms"
```

### Task 4: Run focused regression coverage

**Files:**
- Test: `petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitTest.java`
- Test: `petclinic-frontend/src/app/visits/visit-add/visit-add.component.spec.ts`
- Test: `petclinic-frontend/src/app/visits/visit-edit/visit-edit.component.spec.ts`
- Test: `petclinic-ui-test/tests/visits.spec.ts`

- [ ] **Step 1: Run backend visit tests**

Run: `cd /Users/victorrentea/workspace/petclinic/petclinic-backend && ./mvnw -Dtest=VisitTest test`
Expected: PASS

- [ ] **Step 2: Run frontend visit component specs**

Run: `cd /Users/victorrentea/workspace/petclinic/petclinic-frontend && npm test -- --watch=false --include src/app/visits/visit-add/visit-add.component.spec.ts --include src/app/visits/visit-edit/visit-edit.component.spec.ts`
Expected: PASS

- [ ] **Step 3: Run Playwright visit coverage**

Run: `cd /Users/victorrentea/workspace/petclinic/petclinic-ui-test && npm test -- tests/visits.spec.ts`
Expected: PASS

- [ ] **Step 4: Review git diff for only intended files**

Run: `cd /Users/victorrentea/workspace/petclinic && git --no-pager diff --stat`
Expected: Only visit backend/frontend/test files plus the spec/plan/AGENTS updates for this work.

- [ ] **Step 5: Commit any remaining intentional test adjustments**

```bash
git add petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitTest.java \
        petclinic-frontend/src/app/visits/visit-add/visit-add.component.spec.ts \
        petclinic-frontend/src/app/visits/visit-edit/visit-edit.component.spec.ts \
        petclinic-ui-test/tests/visits.spec.ts
git commit -m "test: cover visit date range validation"
```
