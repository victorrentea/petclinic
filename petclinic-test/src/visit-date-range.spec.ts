import {test} from './support/trace-fixture';
import {
  a_pet_born,
  api_refuses_visit,
  daysFromToday,
  expect_booking_blocked,
  expect_booking_offered,
  expect_date_error_explains_the_range,
  fill_visit,
  forget_pet,
  FixturePet,
  open_new_visit_form,
  yearsFromToday,
} from './visit-date-range.dsl';

// Issue #40: the New Visit form took any date at all — year 0009 included — and the
// API stored whatever it was handed. The rule, from visit-date-range.feature:
// a visit is dated between the pet's birth and one year from today.
//
// The .feature is the contract and runs under cucumber; this spec is the same rule
// pinned at the edges, where off-by-one bugs live: the day before birth against the
// birth day itself, the last allowed day against the one after it.
//
// The two accepting cases stop at "the form offers to submit". They do not post the
// visit: specs in src/ must not create visits (see AGENTS.md — visits.spec.ts diffs the
// whole visit list, and this suite is fullyParallel against one database). That the API
// *stores* an in-range visit is AddVisitApiTest's job, in the backend's own suite.

const PET_AGE_DAYS = 2_000;

let pet: FixturePet;

test.beforeEach(async () => {
  pet = await a_pet_born(daysFromToday(-PET_AGE_DAYS));
});

test.afterEach(async () => {
  await forget_pet(pet);
});

test('the form refuses a visit dated before the pet was born', async ({page}) => {
  await open_new_visit_form(page, pet);
  await fill_visit(page, daysFromToday(-PET_AGE_DAYS - 1));

  await expect_booking_blocked(page, 'the visit predates the pet');
  await expect_date_error_explains_the_range(page);
  await api_refuses_visit(pet, daysFromToday(-PET_AGE_DAYS - 1));
});

test('the form refuses a visit more than a year ahead', async ({page}) => {
  await open_new_visit_form(page, pet);
  await fill_visit(page, yearsFromToday(1, 1));

  await expect_booking_blocked(page, 'the visit is more than a year away');
  await expect_date_error_explains_the_range(page);
  await api_refuses_visit(pet, yearsFromToday(1, 1));
});

test('the pet\'s own birth day is bookable', async ({page}) => {
  await open_new_visit_form(page, pet);
  await fill_visit(page, pet.birthDate);

  await expect_booking_offered(page);
});

test('a visit exactly one year ahead is bookable', async ({page}) => {
  await open_new_visit_form(page, pet);
  await fill_visit(page, yearsFromToday(1));

  await expect_booking_offered(page);
});
