import {test, expect} from '@playwright/test';
import {
  ABSURD_PAST_DATE,
  TOO_FAR_FUTURE_DATE,
  VALID_DATE,
  aPetWithAKnownBirthDateExists,
  anExistingVisitOf,
  deleteVisit,
  enterDescription,
  enterVisitDate,
  expectVisitDateAccepted,
  expectVisitDateRejected,
  openNewVisitForm,
  postVisitToApi,
  putVisitDateToApi,
  PetUnderTest,
} from './visit-date-range.dsl';

// GitHub issue #40 — "Visit date has no range validation".
// A visit may not predate its pet, nor be booked more than a year ahead, and the rule has to
// hold on both ends: the form is a convenience, the API is the actual door.
//
// This spec deliberately never books a visit — src/CLAUDE.md forbids it, because visits.spec.ts
// compares the whole visit list against the API while the suite runs fullyParallel against one
// shared database. It asserts the form's verdict without submitting, and the API's without a
// row surviving; the only cleanup below exists for the red state, where the unfixed API answers
// 201 and does leave one behind.

test.describe('Issue #40 — the visit date must fall inside the pet\'s allowed window', () => {
  let pet: PetUnderTest;

  test.beforeAll(async () => {
    pet = await aPetWithAKnownBirthDateExists();
  });

  test('the form rejects a date before the pet was born', async ({page}) => {
    await openNewVisitForm(page, pet.petId);
    await enterVisitDate(page, ABSURD_PAST_DATE);
    await enterDescription(page, 'Visit booked before the pet existed');

    await expectVisitDateRejected(page, /birth date/i);
  });

  test('the form rejects a date more than a year ahead', async ({page}) => {
    await openNewVisitForm(page, pet.petId);
    await enterVisitDate(page, TOO_FAR_FUTURE_DATE);
    await enterDescription(page, 'Visit booked two years out');

    await expectVisitDateRejected(page, /year/i);
  });

  test('the form still accepts a date inside the window', async ({page}) => {
    await openNewVisitForm(page, pet.petId);
    await enterVisitDate(page, VALID_DATE);
    await enterDescription(page, 'Routine check-up next month');

    await expectVisitDateAccepted(page);
  });

  test('the API rejects a date before the pet was born', async () => {
    const attempt = await postVisitToApi(pet.petId, ABSURD_PAST_DATE, 'Bypassing the form, into the past');
    if (attempt.createdId) {
      await deleteVisit(attempt.createdId);
    }
    expect(attempt.status).toBe(400);
  });

  test('editing a visit cannot move it before the pet was born', async () => {
    const visit = await anExistingVisitOf(pet.petId);

    const status = await putVisitDateToApi(visit.id, ABSURD_PAST_DATE, visit.description);

    expect(status).toBe(400);
  });

  test('the API rejects a date more than a year ahead', async () => {
    const attempt = await postVisitToApi(pet.petId, TOO_FAR_FUTURE_DATE, 'Bypassing the form, into the far future');
    if (attempt.createdId) {
      await deleteVisit(attempt.createdId);
    }
    expect(attempt.status).toBe(400);
  });
});
