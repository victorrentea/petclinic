import {test, expect} from './support/trace-fixture';
import {narrate} from './genseq/steps';
import * as sentences from './visit-date-range.dsl';

// Issue #40: a visit is dated between the pet's birth and one year from today.
const {
  a_dog_born_on,
  open_new_visit_form,
  type_visit,
  expect_form_refuses_date_with,
  expect_form_accepts_date,
  post_visit_through_api,
  expect_pet_has_no_visits,
} = narrate(sentences);

const BIRTH_DATE = '2024-05-10';
const TINSEL = 'ate the Christmas tinsel; kept under observation';

/** A local calendar date as yyyy-mm-dd: toISOString() would shift it to UTC. */
function isoInDays(days: number, years = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

test.describe('Visit date range (#40)', () => {

  test('the form refuses a visit dated before the pet was born', async ({page}) => {
    const axel = await a_dog_born_on(BIRTH_DATE);
    await open_new_visit_form(page, axel.petId);

    await type_visit(page, '0009/07/20', TINSEL);

    await expect_form_refuses_date_with(page, "Visit can't predate the pet's birth (2024/05/10)");
  });

  test('the form refuses a visit more than one year ahead', async ({page}) => {
    const axel = await a_dog_born_on(BIRTH_DATE);
    await open_new_visit_form(page, axel.petId);

    await type_visit(page, isoInDays(1, 1).replace(/-/g, '/'), TINSEL);

    await expect_form_refuses_date_with(page, 'Visit must be within one year from today');
  });

  test('the form accepts both edges: the birth date and one year from today', async ({page}) => {
    const axel = await a_dog_born_on(BIRTH_DATE);
    await open_new_visit_form(page, axel.petId);

    await type_visit(page, '2024/05/10', TINSEL);
    await expect_form_accepts_date(page);

    await type_visit(page, isoInDays(0, 1).replace(/-/g, '/'), TINSEL);
    await expect_form_accepts_date(page);
  });

  test('the API refuses an out-of-range visit date, whoever calls it', async () => {
    const axel = await a_dog_born_on(BIRTH_DATE);

    expect(await post_visit_through_api(axel, '0009-07-20')).toBe(400);
    expect(await post_visit_through_api(axel, isoInDays(1, 1))).toBe(400);

    await expect_pet_has_no_visits(axel);
  });
});
