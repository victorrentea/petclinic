import {expect, test} from './support/trace-fixture';
import {
  aPetWithAKnownBirthDateExists,
  daysAfter,
  daysBefore,
  expectDateAccepted,
  expectDateRejectedAsTooEarly,
  expectDateRejectedAsTooFarAhead,
  fillVisitForm,
  openAddVisitFormForFirstPet,
  postVisitDirectly,
  today,
} from './visit-date-validation.dsl';

// Issue #40: the New Visit form took any date at all — year 0009 included. A visit
// belongs between the pet's birth date and a year from now, and both ends are guarded
// on the form AND on the API. These tests never submit, so they add no visit row that
// visits.spec.ts (which compares the whole list) could trip over.

test.describe('Visit date range (issue #40)', () => {

  test('a date before the pet was born is refused by the form', async ({page}) => {
    const pet = await aPetWithAKnownBirthDateExists();

    await openAddVisitFormForFirstPet(page, pet.ownerId);
    await fillVisitForm(page, daysBefore(pet.birthDate, 1));

    await expectDateRejectedAsTooEarly(page);
  });

  test('a date more than a year ahead is refused by the form', async ({page}) => {
    const pet = await aPetWithAKnownBirthDateExists();

    await openAddVisitFormForFirstPet(page, pet.ownerId);
    await fillVisitForm(page, daysAfter(today(), 380));

    await expectDateRejectedAsTooFarAhead(page);
  });

  test('a date inside the range is still accepted by the form', async ({page}) => {
    const pet = await aPetWithAKnownBirthDateExists();

    await openAddVisitFormForFirstPet(page, pet.ownerId);
    await fillVisitForm(page, today());

    await expectDateAccepted(page);
  });

  test('the API refuses a date before the pet was born', async () => {
    const pet = await aPetWithAKnownBirthDateExists();

    expect(await postVisitDirectly(pet.petId, daysBefore(pet.birthDate, 1))).toBe(400);
  });

  test('the API refuses a date more than a year ahead', async () => {
    const pet = await aPetWithAKnownBirthDateExists();

    expect(await postVisitDirectly(pet.petId, daysAfter(today(), 380))).toBe(400);
  });
});
