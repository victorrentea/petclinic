# GH-40 visit date range validation

## Context

Issue `gh#40` reports that the **New Visit / Edit Visit** flow accepts absurd dates such as `0009/07/20`.

The bug is reproducible in the browser today:

1. Open `Owners`
2. Open owner `Harry Potter`
3. For pet `Hedwig`, click `Add Visit`
4. Enter `0009/07/20`
5. Enter any description
6. Submit the form

The visit is accepted and persisted.

## Goal

Reject visit dates outside the allowed range on both application layers:

- **Minimum:** the pet's birth date
- **Maximum:** exactly one year from today

The backend must reject invalid payloads even when the UI is bypassed. The frontend must block invalid input early and explain the problem to the user.

## Non-goals

- Changing any other visit fields or workflows
- Refactoring unrelated forms
- Reworking global validation infrastructure

## Constraints and assumptions

- The upper bound is **inclusive**: a visit exactly one year from today is allowed.
- The same rule applies to both **add** and **edit** visit flows.
- Existing invalid rows already present in local data are out of scope unless they block editing.

## Options considered

### 1. Backend-only validation

Reject invalid dates from the API and leave the forms unchanged.

**Why not:** safe for data integrity, but poor UX and does not satisfy the issue requirement for frontend enforcement.

### 2. Frontend-only validation

Add `min`/`max` UI constraints and rely on the browser/form state.

**Why not:** direct API calls would still persist invalid data.

### 3. Backend-first, then frontend feedback (**chosen**)

First lock the rule in the backend with a failing server-side test, then add a separate frontend-facing failing e2e that proves the UI blocks invalid input before submit.

**Why this fits best:** it secures the invariant first, then adds the user-facing behavior without letting a backend-only fix accidentally satisfy the UX regression test.

## Design

### Backend

Add pet-aware validation for visit create and update requests:

- On **create**, reject a visit date before the target pet's `birthDate`.
- On **update**, reject a visit date before the existing visit's pet `birthDate`.
- Reject any visit date after `LocalDate.now().plusYears(1)`.
- Return the existing validation-style `400` response.

Implementation should follow the current layered structure:

- keep controllers responsible for request orchestration
- keep DTOs as request carriers
- avoid introducing a service layer

The validation can live either in a dedicated validator/helper used by `VisitRestController` or as a custom bean-validation constraint if the pet context can be supplied cleanly. The preferred implementation is the smallest option that can validate against the owning pet for both add and update flows without duplicating logic.

### Frontend

Add the same range to both visit forms:

- Compute `minVisitDate` from `currentPet.birthDate`
- Compute `maxVisitDate` from today's date plus one year
- Apply those bounds to the date input
- Surface a focused validation message when the chosen date is outside the allowed range
- Keep the submit button disabled while the form is invalid

The frontend validation must be explicit enough that an e2e test can distinguish:

- invalid date blocked in the UI
- valid date still submittable

This prevents a backend-only rejection from making the frontend regression test pass.

## Test strategy

### Step 1: backend red-green

Write the smallest backend test first:

- invalid ancient date on **add visit** returns `400`
- invalid too-far-future date on **add visit** returns `400`

If update coverage needs a separate path, add it immediately after the first rule is green.

Then implement the smallest backend change to make those tests pass.

### Step 2: frontend red-green

Write a Playwright e2e that reproduces the real browser flow and asserts UI behavior, not just persistence:

- navigate to the existing owner/pet path used during manual reproduction
- enter an out-of-range date
- confirm the form shows the validation problem and blocks submission

Then implement the smallest frontend change to make that test pass.

### Step 3: focused verification

- rerun the new backend test(s)
- rerun the new Playwright test
- rerun any tight existing visit form/unit tests touched by the change

## Risks

- Template-driven Angular date validation may expose range errors differently than reactive forms; the test should assert the visible outcome the user sees.
- Existing invalid visit rows in local data may make edit-form behavior awkward; if that happens, handle it explicitly without relaxing the new rules for fresh submissions.

## Expected outcome

- Invalid visit dates can no longer be persisted through the API.
- Add/Edit Visit forms reject out-of-range dates before submission.
- The new tests protect both the invariant and the UX layer.
