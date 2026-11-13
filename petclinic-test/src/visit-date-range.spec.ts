import {expect, Page} from '@playwright/test';
import axios from 'axios';
import {test} from './support/trace-fixture';

// Issue #40: a visit is dated between the pet's birth and one year from today.
// Starts on the empty database: Kevin and his dog Axel are created here, through the API.

const API = process.env.API_BASE_URL || 'http://127.0.0.1:8080/api';
const DOG = {id: 2, name: 'dog'};
const AXEL_BORN = '2024-05-10';

let axelId: number;

test.beforeEach(async () => {
  const owner = await axios.post(`${API}/owners`, {
    firstName: 'Kevin', lastName: 'McCallister', address: '671 Lincoln Ave',
    city: 'Winnetka', telephone: '0712345678',
  });
  const ownerId = idFrom(owner.headers.location);
  const pet = await axios.post(`${API}/owners/${ownerId}/pets`, {name: 'Axel', birthDate: AXEL_BORN, type: DOG});
  axelId = idFrom(pet.headers.location);
});

test('A visit cannot predate the pet', async ({page}) => {
  await openNewVisitForm(page);

  await typeVisitDate(page, '0009/07/20');

  await expect(page.getByText(`A visit cannot predate the pet, born ${AXEL_BORN}`)).toBeVisible();
  await expect(addVisitButton(page)).toBeDisabled();
});

test('A visit cannot be booked more than a year ahead', async ({page}) => {
  await openNewVisitForm(page);

  await typeVisitDate(page, inDays(366).replace(/-/g, '/'));

  await expect(page.getByText('one year from today')).toBeVisible();
  await expect(addVisitButton(page)).toBeDisabled();
});

test('A visit between birth and one year ahead is booked', async ({page}) => {
  await openNewVisitForm(page);

  await typeVisitDate(page, AXEL_BORN.replace(/-/g, '/'));

  await expect(addVisitButton(page)).toBeEnabled();
});

async function openNewVisitForm(page: Page): Promise<void> {
  await page.goto(`/pets/${axelId}/visits/add`);
  await page.locator('h2:has-text("New Visit")').waitFor();
  await expect(page.getByRole('cell', {name: AXEL_BORN})).toBeVisible();
}

async function typeVisitDate(page: Page, date: string): Promise<void> {
  await page.locator('input[name="date"]').pressSequentially(date);
  await page.locator('input#description').fill('ate the Christmas tinsel; kept under observation');
}

function addVisitButton(page: Page) {
  return page.locator('button[type="submit"]:has-text("Add Visit")');
}

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('sv-SE'); // yyyy-mm-dd, local time
}

function idFrom(location: string): number {
  return Number(location.split('/').pop());
}
