import {test, Page} from './support/trace-fixture';
import {
  click_add_visit_for_first_pet,
  expect_back_on_owner_detail_page,
  expect_pet_visit_list_contains,
  open_owner_detail_page,
  submit_visit_form,
} from './add-visit.dsl';
import {
  a_visit_is_booked_for,
  aYearFromToday,
  expect_date_refused_saying,
  expect_no_visit_saved,
  kevin_owns_a_dog_born_on,
  open_edit_visit_page,
  type_visit_date,
} from './visit-date-range.dsl';

// Issue #40: a visit is dated between the pet's birth and one year from today.

const BORN = '2024-05-10';
const DAY_BEFORE_BIRTH = '2024-05-09';
const PREDATES_THE_PET = `A visit cannot predate the pet, born ${BORN}`;
const TOO_FAR_AHEAD = `A visit cannot be booked after ${aYearFromToday()}, one year from today`;

async function open_new_visit_form_for_a_dog_born_on(page: Page, birthDate: string) {
  const dog = await kevin_owns_a_dog_born_on(birthDate);
  await open_owner_detail_page(page, dog.ownerId);
  await click_add_visit_for_first_pet(page, 'Add Visit');
  return dog;
}

test('New Visit refuses the year 0009, 2015 years before the dog was born', async ({page}) => {
  const dog = await open_new_visit_form_for_a_dog_born_on(page, BORN);

  await type_visit_date(page, '0009/07/20');

  await expect_date_refused_saying(page, PREDATES_THE_PET);
  await expect_no_visit_saved(dog);
});

test('New Visit refuses the day before the pet was born', async ({page}) => {
  await open_new_visit_form_for_a_dog_born_on(page, BORN);

  await type_visit_date(page, DAY_BEFORE_BIRTH);

  await expect_date_refused_saying(page, PREDATES_THE_PET);
});

test('New Visit refuses the day after one year from today', async ({page}) => {
  await open_new_visit_form_for_a_dog_born_on(page, BORN);

  await type_visit_date(page, aYearFromToday(1));

  await expect_date_refused_saying(page, TOO_FAR_AHEAD);
});

for (const [limit, date] of [['the birth day', BORN], ['one year from today', aYearFromToday()]]) {
  test(`New Visit books ${limit}, the last date in range on that side`, async ({page}) => {
    const dog = await open_new_visit_form_for_a_dog_born_on(page, BORN);

    await type_visit_date(page, date);
    await submit_visit_form(page);

    await expect_back_on_owner_detail_page(page, dog.ownerId);
    await expect_pet_visit_list_contains(page, date, 'ate the Christmas tinsel');
  });
}

test('Edit Visit refuses a date out of range just the same', async ({page}) => {
  const dog = await kevin_owns_a_dog_born_on(BORN);
  const visitId = await a_visit_is_booked_for(dog, '2025-01-15');
  await open_edit_visit_page(page, visitId);

  await type_visit_date(page, DAY_BEFORE_BIRTH);

  await expect_date_refused_saying(page, PREDATES_THE_PET);
});
