import {test} from './support/trace-fixture';
import {narrate} from './genseq/steps';
import * as addVisit from './add-visit.dsl';
import * as dateRange from './visit-date-range.dsl';

// Issue #40: a visit is dated between the pet's birth and one year from today.
// visit-date-range.feature states the same rule against a pinned "today".

const {open_owner_detail_page, click_add_visit_for_first_pet} = narrate(addVisit);
const {type_visit_date, type_a_description, expect_visit_refused_because} = narrate(dateRange);
const {KEVIN, one_year_and_a_day_from_today} = dateRange;

test('A visit cannot predate the pet', async ({page}) => {
  await open_owner_detail_page(page, KEVIN.ownerId);
  await click_add_visit_for_first_pet(page, 'Add Visit');

  await type_visit_date(page, '0009/07/20');
  await type_a_description(page);

  await expect_visit_refused_because(page, new RegExp(`cannot predate .* born ${KEVIN.petBirthDate}`));
});

test('A visit cannot be booked more than a year ahead', async ({page}) => {
  await open_owner_detail_page(page, KEVIN.ownerId);
  await click_add_visit_for_first_pet(page, 'Add Visit');

  await type_visit_date(page, one_year_and_a_day_from_today());
  await type_a_description(page);

  await expect_visit_refused_because(page, /at most one year ahead/);
});
