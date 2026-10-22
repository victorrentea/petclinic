# Visit Date Range Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject visit dates before the pet's birth date or more than one calendar year ahead, in the UI and REST API.

**Architecture:** Keep the existing Angular Add/Edit forms and Spring REST controller. Add datepicker bounds from each pet's birth date through `LocalDate.now().plusYears(1)`, and validate the same range in the controller for both create and update. Prove the bug with Playwright before changing production code.

**Tech Stack:** Angular 16, Angular Material Moment date adapter, Spring Boot, JUnit 5, Playwright Test, macOS `say`.

---

## Files and responsibilities

- `petclinic-test/src/visit-date-range.spec.ts` — browser regression coverage for Add/Edit and direct REST requests; video captions and 9:16 recording setup.
- `petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitTest.java` — REST boundary tests, including inclusive limits.
- `petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java` — validate dates for creation and update using the pet's birth date.
- `petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java` — preserve the standard 400 ProblemDetail for the range exception.
- `petclinic-frontend/src/app/visits/visit-add/visit-add.component.ts` and `.html` — derive and apply Add form bounds and messages.
- `petclinic-frontend/src/app/visits/visit-edit/visit-edit.component.ts` and `.html` — apply the same bounds and messages to Edit.

## Task 1: Reproduce the bug in Playwright before changing production code

**Files:** Create `petclinic-test/src/visit-date-range.spec.ts`.

- [ ] **Step 1: Add a failing Add Visit test**

Use the existing trace fixture, `test.use({dbFixture: 'default'})`, and `an_owner_with_at_least_one_pet_exists()` from `add-visit.dsl.ts`. Open that owner's detail page, choose **Add Visit**, fill the date with one day before the displayed pet birth date, fill a description, force-click **Add Visit**, and assert the **New Visit** heading remains visible and the min-date error is shown. On the unfixed application the form submits and navigates away, so the heading assertion must fail.

Set the browser viewport to `390x844`. Add a fixed bottom caption using `page.evaluate`, with white bold text on a dark translucent background and the text `BUG: visit predates pet's birth`. This caption is part of the recorded page, not a separate subtitle track.

```ts
await page.setViewportSize({width: 390, height: 844});
await page.evaluate(() => {
  const caption = document.createElement('div');
  caption.textContent = "BUG: visit predates pet's birth";
  Object.assign(caption.style, {
    position: 'fixed', bottom: '0', left: '0', right: '0', zIndex: '2147483647',
    padding: '18px 14px', background: 'rgba(0,0,0,.82)', color: 'white',
    font: 'bold 22px/1.25 system-ui', textAlign: 'center', pointerEvents: 'none',
  });
  document.body.appendChild(caption);
});
```

- [ ] **Step 2: Run the single test against the unfixed application**

Run from `petclinic-test/`:

```sh
PW_VIDEO=on npm test -- --grep "Add Visit rejects a date before the pet's birth"
```

Expected before the fix: the test fails because submission navigates away from **New Visit**. Keep the failed-run video as the “before” recording; do not change the assertion to make the old code pass.

- [ ] **Step 3: Add the remaining browser/API cases**

Add cases that fill a date two years ahead in Add and Edit and assert the form does not submit and shows the max-date error. For Edit, open `/visits`, click an existing row's **Edit Visit** button, and use the current pet's birth date displayed on the form. Add direct `page.request` POST and PUT cases using the same invalid dates; expect HTTP 400. Use the date string `YYYY-MM-DD` and derive the lower bound from the rendered birth date rather than hard-coding a pet.

Run the targeted spec before production changes:

```sh
npm test -- src/visit-date-range.spec.ts
```

Expected before the fix: each out-of-range case is rejected by its assertion because the form submits or the API returns success.

## Task 2: Add backend range validation test-first

**Files:** Modify `petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitTest.java`, then `VisitRestController.java` and `ExceptionControllerAdvice.java`.

- [ ] **Step 1: Add create/update boundary tests**

In `VisitTest`, use the saved pet's birth date and exercise both endpoints:

```java
LocalDate birthDate = petRepository.findById(petId).orElseThrow().getBirthDate();
LocalDate beforeBirth = birthDate.minusDays(1);
LocalDate afterMaximum = LocalDate.now().plusYears(1).plusDays(1);
```

For POST, send `VisitDto` with `petId`, `date`, and a non-empty description. For PUT, send `VisitFieldsDto` to the existing `visitId`. Assert 400 for `beforeBirth` and `afterMaximum`; assert that `birthDate` and `LocalDate.now().plusYears(1)` remain accepted. Run:

```sh
cd petclinic-backend && mvn test -Dtest=VisitTest
```

Expected before the fix: the invalid POST/PUT tests fail because the current controller accepts both dates.

- [ ] **Step 2: Validate the request's pet date in the controller**

Inject `PetRepository` into `VisitRestController`. Before mapping/saving a POST, load the request's pet and validate its `birthDate`; before saving a PUT, use the current visit's pet. Reject non-null dates outside the inclusive interval with a focused `ResponseStatusException(HttpStatus.BAD_REQUEST, ...)`, preserving the existing behavior for a null date.

```java
private void validateVisitDate(LocalDate date, LocalDate birthDate) {
    LocalDate maximumDate = LocalDate.now().plusYears(1);
    if (date != null && (date.isBefore(birthDate) || date.isAfter(maximumDate))) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Visit date must be between the pet's birth date and one year from today");
    }
}
```

- [ ] **Step 3: Map the range exception to the normal 400 response**

Add a specific `ResponseStatusException` handler before the generic `Exception` handler in `ExceptionControllerAdvice`. Return a `ProblemDetail` with the exception status and reason; do not let the generic handler turn this expected input error into HTTP 500.

- [ ] **Step 4: Re-run backend tests**

Run `cd petclinic-backend && mvn test -Dtest=VisitTest`.

Expected: PASS, including inclusive lower/upper boundaries and 400 for both invalid dates on both endpoints.

## Task 3: Apply the same limits to Angular Add/Edit

**Files:** Modify both visit-add and visit-edit component TypeScript and templates.

- [ ] **Step 1: Derive the bounds when the pet loads**

In each component, expose Moment-valued `minDate` and `maxDate`. After `currentPet` is assigned, set them from `moment(pet.birthDate)` and `moment().add(1, 'year')`.

```ts
minDate: moment.Moment;
maxDate: moment.Moment;
```

- [ ] **Step 2: Bind datepicker limits and readable errors**

On each date input, bind `[min]="minDate"` and `[max]="maxDate"`. Add help text for Angular Material's `matDatepickerMin` and `matDatepickerMax` errors. Keep the existing submit buttons bound to form validity so invalid dates cannot submit.

```html
<span class="help-block" *ngIf="date.dirty && date.hasError('matDatepickerMin')">
  Visit date cannot be before the pet's birth date
</span>
<span class="help-block" *ngIf="date.dirty && date.hasError('matDatepickerMax')">
  Visit date cannot be more than one year ahead
</span>
```

- [ ] **Step 3: Run focused frontend tests and build**

Run from `petclinic-frontend/`:

```sh
npm test -- --watch=false --browsers=ChromeHeadlessCI
npm run build
```

Expected: PASS; Add/Edit templates compile with Moment date bounds and existing valid submissions remain unchanged.

## Task 4: Verify end-to-end and make the two clips

- [ ] **Step 1: Run Playwright after the fix**

Run from `petclinic-test/` against this working tree's apps:

```sh
PW_VIDEO=on npm test -- src/visit-date-range.spec.ts
```

Expected: PASS for invalid Add/Edit and direct API requests; valid dates at both inclusive limits are accepted by the backend.

- [ ] **Step 2: Save the after recording**

Retain the passing Add Visit recording with the same 9:16 viewport and on-page TikTok-style caption. Save the before and after clips under `petclinic-test/test-results/bug-40/`; these are generated deliverables, not committed test fixtures.

- [ ] **Step 3: Add local narration**

The machine has the local Romanian `Ioana` voice (`say -v Ioana`), but no local Moroccan-accented Romanian voice was found. Use the local voice rather than calling Fish Audio. Narrate the same short Romanian line in each clip, then mux the local audio into the WebM with the installed `ffmpeg`; keep the captions burned into the page.

- [ ] **Step 4: Report verification and clip paths**

State the exact backend, frontend, and Playwright commands run, whether each passed, and the absolute paths to both clips. Do not claim a Moroccan accent or Trump voice; neither is produced by the available local voice.
