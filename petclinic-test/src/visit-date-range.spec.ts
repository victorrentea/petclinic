import {test} from './support/trace-fixture';
import {narrate} from './genseq/steps';
import * as sentences from './visit-date-range.dsl';
import {dayBefore, daysFromToday} from './visit-date-range.dsl';

// GitHub issue #40: the visit date was accepted unbounded — year 0009 got saved.
// A visit cannot predate the pet, and booking further out than a year is a typo,
// so the date is pinned to [pet.birthDate, today + 1 year] on both sides of the wire.

const {
  a_pet_with_a_known_birth_date_exists,
  api_accepts_visit_on,
  api_rejects_visit_on,
  expect_out_of_range_message_is_shown,
  expect_visit_is_accepted,
  expect_visit_is_rejected,
  fill_visit_date_and_description,
  open_add_visit_form,
} = narrate(sentences);

test.describe('Visit date range', () => {

  test('the form rejects a date from before the pet was born', async ({page}) => {
    const {petId, birthDate} = await a_pet_with_a_known_birth_date_exists();

    await open_add_visit_form(page, petId);
    await fill_visit_date_and_description(page, dayBefore(birthDate));

    await expect_visit_is_rejected(page);
    await expect_out_of_range_message_is_shown(page);
  });

  test('the form rejects the absurd year from the bug report', async ({page}) => {
    const {petId} = await a_pet_with_a_known_birth_date_exists();

    await open_add_visit_form(page, petId);
    await fill_visit_date_and_description(page, '0009-07-20');

    await expect_visit_is_rejected(page);
  });

  test('the form rejects a date more than a year ahead', async ({page}) => {
    const {petId} = await a_pet_with_a_known_birth_date_exists();

    await open_add_visit_form(page, petId);
    await fill_visit_date_and_description(page, daysFromToday(400));

    await expect_visit_is_rejected(page);
    await expect_out_of_range_message_is_shown(page);
  });

  test('the form accepts a date inside the range', async ({page}) => {
    const {petId} = await a_pet_with_a_known_birth_date_exists();

    await open_add_visit_form(page, petId);
    await fill_visit_date_and_description(page, daysFromToday(7));

    await expect_visit_is_accepted(page);
  });

  test('the API enforces the same range as the form', async () => {
    const {petId, birthDate} = await a_pet_with_a_known_birth_date_exists();

    await api_rejects_visit_on(petId, '0009-07-20');
    await api_rejects_visit_on(petId, dayBefore(birthDate));
    await api_rejects_visit_on(petId, daysFromToday(400));
    await api_accepts_visit_on(petId, daysFromToday(7));
  });
});
