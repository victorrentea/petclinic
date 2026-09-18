import {test} from './support/trace-fixture';
import {narrate} from './genseq/steps';
import * as addVisit from './add-visit.dsl';
import * as sentences from './visit-date-range.dsl';
import {days_after, one_year_from_today} from './visit-date-range.dsl';

// Issue #40, in the UI: the New Visit form accepts a date from the pet's birth up to one
// year from today. The API enforces the same range (VisitDateRangeTest in the backend).

const {an_owner_with_at_least_one_pet_exists, open_owner_detail_page, click_add_visit_for_first_pet} =
  narrate(addVisit);
const {birth_date_of_pet, enter_visit_date, expect_visit_date_refused, expect_visit_date_accepted} =
  narrate(sentences);

test.describe('Visit date range', () => {
  let birthDate: string;

  test.beforeEach(async ({page}) => {
    const {ownerId, petId} = await an_owner_with_at_least_one_pet_exists();
    birthDate = await birth_date_of_pet(petId);
    await open_owner_detail_page(page, ownerId);
    await click_add_visit_for_first_pet(page, 'Add Visit');
  });

  test('A visit cannot predate the pet', async ({page}) => {
    await enter_visit_date(page, days_after(birthDate, -1));
    await expect_visit_date_refused(page, 'Date cannot be before the pet was born');
  });

  test('An absurd year like 0009 is refused', async ({page}) => {
    await enter_visit_date(page, '0009-07-20');
    await expect_visit_date_refused(page, 'Date cannot be before the pet was born');
  });

  test('A visit cannot be booked more than a year ahead', async ({page}) => {
    await enter_visit_date(page, days_after(one_year_from_today(), 1));
    await expect_visit_date_refused(page, 'Date cannot be more than one year ahead');
  });

  test('The pet\'s birth date is accepted', async ({page}) => {
    await enter_visit_date(page, birthDate);
    await expect_visit_date_accepted(page);
  });

  test('Exactly one year ahead is accepted', async ({page}) => {
    await enter_visit_date(page, one_year_from_today());
    await expect_visit_date_accepted(page);
  });
});
