import {test} from './support/trace-fixture';
import {GENERATE_SEQUENCE_TAG} from './genseq/sequence-tag';
import {narrate} from './genseq/steps';
import * as addVisit from './add-visit.dsl';
import * as dateRange from './visit-date-range.dsl';

// #40: a visit is dated between the pet's birth and one year from today.
// The issue's own reproduction, from an empty database: Kevin's dog Axel, born 2024-05-10.

const {
  click_add_visit_for_first_pet,
  expect_back_on_owner_detail_page,
  expect_pet_visit_list_contains,
  open_owner_detail_page,
  submit_visit_form,
} = narrate(addVisit);
const {
  expect_visit_date_accepted,
  expect_visit_date_refused_with,
  kevin_owns_a_dog_born_on,
  plus_one_year_and_one_day_from_today,
  today,
  type_visit_date_and_description,
} = narrate(dateRange);

const AXEL_BIRTH_DATE = '2024-05-10';

test('A visit date outside [pet birth, today + 1 year] is refused; one inside is booked',
  {tag: [GENERATE_SEQUENCE_TAG]},
  async ({page}) => {
    const {ownerId} = await kevin_owns_a_dog_born_on(AXEL_BIRTH_DATE);
    await open_owner_detail_page(page, ownerId);
    await click_add_visit_for_first_pet(page, 'Add Visit');

    await type_visit_date_and_description(page, '0009/07/20', 'ate the Christmas tinsel; kept under observation');
    await expect_visit_date_refused_with(page, 'cannot be before the pet\'s birth date (2024/05/10)');

    await type_visit_date_and_description(page, plus_one_year_and_one_day_from_today(), 'annual check-up');
    await expect_visit_date_refused_with(page, 'cannot be more than one year from today');

    const visitDate = today();
    await type_visit_date_and_description(page, visitDate, 'ate the Christmas tinsel; kept under observation');
    await expect_visit_date_accepted(page);
    await submit_visit_form(page);

    await expect_back_on_owner_detail_page(page, ownerId);
    await expect_pet_visit_list_contains(page, visitDate.replace(/\//g, '-'),
      'ate the Christmas tinsel; kept under observation');
  });
