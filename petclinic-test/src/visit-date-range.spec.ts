import {expect, Page} from '@playwright/test';
import axios from 'axios';
import {test} from './support/trace-fixture';

// Issue #40: a visit is dated between the pet's birth and one year from today, in the form
// and in the API. Starts on the empty database: Kevin and his dog Axel are created here.

const API = process.env.API_BASE_URL || 'http://127.0.0.1:8080/api';
const DOG = {id: 2, name: 'dog'};
const AXEL_BORN = '2024-05-10';
const DESCRIPTION = 'ate the Christmas tinsel; kept under observation';

let axelId: number;

test.beforeEach(async () => {
  const owner = await axios.post(`${API}/owners`, {
    firstName: 'Kevin', lastName: 'McCallister', address: '671 Lincoln Ave',
    city: 'Winnetka', telephone: '0712345678',
  });
  const pet = await axios.post(`${API}/owners/${idFrom(owner.headers.location)}/pets`,
    {name: 'Axel', birthDate: AXEL_BORN, type: DOG});
  axelId = idFrom(pet.headers.location);
});

test.describe('New Visit form', () => {
  test.beforeEach(async ({page}) => {
    await page.goto(`/pets/${axelId}/visits/add`);
    await page.locator('h2:has-text("New Visit")').waitFor();
    await expect(page.getByRole('cell', {name: AXEL_BORN})).toBeVisible();
  });

  test('refuses a date before the pet was born', async ({page}) => {
    await typeVisitDate(page, '0009/07/20');

    await expect(page.getByText(`A visit cannot predate the pet, born ${AXEL_BORN}`)).toBeVisible();
    await expect(submitButton(page, 'Add Visit')).toBeDisabled();
  });

  test('refuses a date more than a year ahead', async ({page}) => {
    await typeVisitDate(page, slashed(inDays(366)));

    await expect(page.getByText('one year from today')).toBeVisible();
    await expect(submitButton(page, 'Add Visit')).toBeDisabled();
  });

  test('accepts the pet\'s birthday and the day a year from today', async ({page}) => {
    await typeVisitDate(page, slashed(AXEL_BORN));
    await expect(submitButton(page, 'Add Visit')).toBeEnabled();

    await page.locator('input[name="date"]').clear();
    await typeVisitDate(page, slashed(inDays(365)));
    await expect(submitButton(page, 'Add Visit')).toBeEnabled();
  });
});

test('Edit Visit form refuses a date before the pet was born', async ({page}) => {
  const visitId = await bookVisitThroughTheApi(inDays(0));
  await page.goto(`/visits/${visitId}/edit`);
  await page.locator('h2:has-text("Edit Visit")').waitFor();
  await expect(submitButton(page, 'Update Visit')).toBeEnabled();

  await page.locator('input[name="date"]').clear();
  await page.locator('input[name="date"]').pressSequentially('0009/07/20');
  await page.locator('input#description').click();

  await expect(page.getByText(`A visit cannot predate the pet, born ${AXEL_BORN}`)).toBeVisible();
  await expect(submitButton(page, 'Update Visit')).toBeDisabled();
});

test.describe('POST /api/visits', () => {
  for (const [title, date] of [
    ['before the pet was born', '0009-07-20'],
    ['more than a year ahead', inDays(366)],
  ]) {
    test(`answers 400 for a date ${title}`, async () => {
      const response = await axios.post(`${API}/visits`, visitOn(date), {validateStatus: () => true});

      expect(response.status).toBe(400);
      const {data: visits} = await axios.get(`${API}/visits`);
      expect(visits.filter((visit: {petId: number}) => visit.petId === axelId)).toEqual([]);
    });
  }
});

async function bookVisitThroughTheApi(date: string): Promise<number> {
  const response = await axios.post(`${API}/visits`, visitOn(date));
  return idFrom(response.headers.location);
}

function visitOn(date: string) {
  return {petId: axelId, date, description: DESCRIPTION};
}

// The description is filled last: it takes the focus off the date, so its errors show.
async function typeVisitDate(page: Page, date: string): Promise<void> {
  await page.locator('input[name="date"]').pressSequentially(date);
  await page.locator('input#description').fill(DESCRIPTION);
}

function submitButton(page: Page, label: string) {
  return page.locator(`button[type="submit"]:has-text("${label}")`);
}

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('sv-SE'); // yyyy-mm-dd, local time
}

function slashed(isoDate: string): string {
  return isoDate.replace(/-/g, '/');
}

function idFrom(location: string): number {
  return Number(location.split('/').pop());
}
