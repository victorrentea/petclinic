import {expect, Page} from '@playwright/test';
import axios from 'axios';
import {test} from './support/trace-fixture';
import {click_add_visit_for_first_pet, open_owner_detail_page} from './add-visit.dsl';

// Issue #40: a visit is dated between the pet's birth and one year from today.
// The steps are the issue's own: Kevin's dog Axel, born 2024-05-10, booked in the year 9.

const API = process.env.API_BASE_URL || 'http://127.0.0.1:8080/api';
const AXEL_BIRTH_DATE = '2024-05-10';

let ownerId: number;

test.beforeEach(async () => {
  ownerId = await an_owner_with_a_dog_born_on(AXEL_BIRTH_DATE);
});

// On `ng serve` there is no reset between tests: leave the dev database as it was found.
test.afterEach(async () => {
  await axios.delete(`${API}/owners/${ownerId}`);
});

test('A visit cannot predate the pet', async ({page}) => {
  await open_new_visit_form(page);

  await type_visit(page, '0009/07/20');

  await expect(page.locator('.help-block')).toContainText(`can't predate the pet's birth (${AXEL_BIRTH_DATE})`);
  await expect(add_visit_button(page)).toBeDisabled();
});

test('A visit cannot be booked more than a year ahead', async ({page}) => {
  await open_new_visit_form(page);

  await type_visit(page, `${new Date().getFullYear() + 2}/01/01`);

  await expect(page.locator('.help-block')).toContainText('at most one year ahead');
  await expect(add_visit_button(page)).toBeDisabled();
});

async function an_owner_with_a_dog_born_on(birthDate: string): Promise<number> {
  const owner = await axios.post(`${API}/owners`, {
    firstName: 'Kevin', lastName: 'McCallister', address: '671 Lincoln Ave', city: 'Winnetka',
    telephone: '0712345678',
  });
  const id = Number(owner.headers.location.split('/').pop());
  const {data: types} = await axios.get(`${API}/pettypes`);
  const dog = types.find((t: any) => t.name === 'dog');
  await axios.post(`${API}/owners/${id}/pets`, {name: 'Axel', birthDate, type: dog});
  return id;
}

async function open_new_visit_form(page: Page): Promise<void> {
  await open_owner_detail_page(page, ownerId);
  // the newest pet is Axel: an owner created above has no other
  await click_add_visit_for_first_pet(page, 'Add Visit');
}

async function type_visit(page: Page, date: string): Promise<void> {
  await page.locator('input[name="date"]').fill(date);
  await page.locator('input#description').fill('ate the Christmas tinsel; kept under observation');
}

function add_visit_button(page: Page) {
  return page.locator('button[type="submit"]:has-text("Add Visit")');
}
