import {test} from './support/trace-fixture';
import {narrate} from './genseq/steps';
import * as sentences from './add-visit.dsl';

const {
  an_owner_with_at_least_one_pet_exists,
  click_add_visit_for_first_pet,
  expect_visit_date_accepted,
  expect_visit_date_refused,
  fill_visit_date,
  fill_visit_date_and_unique_description,
  open_owner_detail_page,
} = narrate(sentences);

// Bug #40: a visit is dated between the pet's birth and one year from today.
test.use({dbFixture: 'default'});

function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function shiftDays(isoDay: string, days: number): string {
  const [year, month, day] = isoDay.split('-').map(Number);
  return isoDate(new Date(year, month - 1, day + days));
}

function oneYearFromToday(): string {
  const today = new Date();
  return isoDate(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()));
}

test.describe('New Visit date range', () => {
  let petBirthDate: string;

  test.beforeEach(async ({page}) => {
    const ownerWithPet = await an_owner_with_at_least_one_pet_exists();
    petBirthDate = ownerWithPet.petBirthDate;
    await open_owner_detail_page(page, ownerWithPet.ownerId);
    await click_add_visit_for_first_pet(page, 'Add Visit');
    await fill_visit_date_and_unique_description(page, petBirthDate);
  });

  test('refuses an absurd date, like year 0009', async ({page}) => {
    await fill_visit_date(page, '0009-07-20');
    await expect_visit_date_refused(page, "The visit cannot predate the pet's birth");
  });

  test('refuses the day before the pet was born', async ({page}) => {
    await fill_visit_date(page, shiftDays(petBirthDate, -1));
    await expect_visit_date_refused(page, "The visit cannot predate the pet's birth");
  });

  test('accepts the very day the pet was born', async ({page}) => {
    await fill_visit_date(page, petBirthDate);
    await expect_visit_date_accepted(page);
  });

  test('refuses a date more than one year ahead', async ({page}) => {
    await fill_visit_date(page, shiftDays(oneYearFromToday(), 1));
    await expect_visit_date_refused(page, 'The visit cannot be more than one year ahead');
  });

  test('accepts a date exactly one year ahead', async ({page}) => {
    await fill_visit_date(page, oneYearFromToday());
    await expect_visit_date_accepted(page);
  });
});
