import {expect, Page} from '@playwright/test';
import axios from 'axios';
import {test} from './support/trace-fixture';

// #40: a visit is dated between the pet's birth and one year from today.

const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:8080/api';
const TODAY = new Date('2026-09-10T12:00:00');
const BIRTH_DATE = '2024-05-10';
const ONE_YEAR_FROM_TODAY = '2027-09-10';
const DOG = {id: 2, name: 'dog'};
const BEFORE_BIRTH_ERROR = `Visit date cannot be before the pet's birth date (${BIRTH_DATE}).`;
const TOO_FAR_AHEAD_ERROR = `Visit date cannot be more than one year ahead (after ${ONE_YEAR_FROM_TODAY}).`;

async function a_dog_born_on(birthDate: string): Promise<number> {
  const ownerResponse = await axios.post(`${API_BASE}/owners`, {
    firstName: 'Kevin', lastName: 'McCallister', address: '671 Lincoln Ave', city: 'Winnetka',
    telephone: '0712345678',
  });
  const ownerId = idFromLocation(ownerResponse.headers.location);
  const petResponse = await axios.post(`${API_BASE}/owners/${ownerId}/pets`, {name: 'Axel', birthDate, type: DOG});
  return idFromLocation(petResponse.headers.location);
}

function idFromLocation(location: string): number {
  return Number(location.split('/').pop());
}

async function type_visit_date(page: Page, date: string): Promise<void> {
  await page.locator('input[name="date"]').fill(date);
  await page.locator('input[name="date"]').blur();
}

test('The New Visit form refuses a date before the pet was born or more than a year ahead', async ({page}) => {
  await page.clock.setFixedTime(TODAY);
  const petId = await a_dog_born_on(BIRTH_DATE);
  await page.goto(`/pets/${petId}/visits/add`);
  await page.locator('input#description').fill('ate the Christmas tinsel; kept under observation');
  const addVisitButton = page.getByRole('button', {name: 'Add Visit'});
  const dateErrors = page.locator('.help-block').filter({hasText: 'Visit date'});
  const refusedDates = {
    '0009/07/20': BEFORE_BIRTH_ERROR,
    '2024/05/09': BEFORE_BIRTH_ERROR,
    '2027/09/11': TOO_FAR_AHEAD_ERROR,
  };

  for (const [refusedDate, error] of Object.entries(refusedDates)) {
    await type_visit_date(page, refusedDate);
    await expect(dateErrors, refusedDate).toHaveText([error]);
    await expect(addVisitButton, refusedDate).toBeDisabled();
  }

  for (const acceptedDate of ['2024/05/10', '2027/09/10']) {
    await type_visit_date(page, acceptedDate);
    await expect(dateErrors, acceptedDate).toHaveCount(0);
    await expect(addVisitButton, acceptedDate).toBeEnabled();
  }
});
