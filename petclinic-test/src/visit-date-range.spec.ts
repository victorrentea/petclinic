import {test, expect} from './support/trace-fixture';
import axios from 'axios';

// Bug #40: the New Visit form accepted any date — year 0009 included — and the API
// stored it. A visit can neither predate the pet nor be booked more than a year out.

const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:8080/api';

const ABSURDLY_OLD_DATE = '0009-07-20'; // the date from the bug report

interface PetUnderTest {
  ownerId: number;
  petId: number;
  birthDate: string;
}

async function aPetWithAKnownBirthDate(): Promise<PetUnderTest> {
  const {data: owners} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  const owner = owners.find((o: any) => o.pets?.some((p: any) => p.birthDate));
  if (!owner) {
    throw new Error('No owner with a pet having a birth date; cannot run visit date range scenario');
  }
  const pet = owner.pets.find((p: any) => p.birthDate);
  return {ownerId: owner.id, petId: pet.id, birthDate: pet.birthDate};
}

function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayBefore(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

// Only ever posts dates the API must REJECT: a 201 here would leave a row behind, and
// visits.spec.ts compares the whole visit list against the API in the same parallel run.
async function postVisitExpectedToBeRejected(petId: number, date: string): Promise<number> {
  const response = await axios.post(`${API_BASE}/visits`,
    {petId, date, description: 'Visit date range check'},
    {timeout: 10_000, validateStatus: () => true});
  return response.status;
}

test.describe('Visit date range (bug #40)', () => {

  test('the form refuses a visit date long before the pet was born', async ({page}) => {
    const {petId} = await aPetWithAKnownBirthDate();

    await page.goto(`/pets/${petId}/visits/add`);
    await page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});

    await page.locator('input[name="date"]').fill(ABSURDLY_OLD_DATE);
    await page.locator('input[name="date"]').blur();
    await page.locator('input#description').fill('Time travel check-up');

    await expect(page.locator('text=Date must be between')).toBeVisible();
    await expect(page.locator('button[type="submit"]:has-text("Add Visit")')).toBeDisabled();
  });

  test('the form accepts a date inside the allowed range', async ({page}) => {
    const {petId} = await aPetWithAKnownBirthDate();

    await page.goto(`/pets/${petId}/visits/add`);
    await page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});

    await page.locator('input[name="date"]').fill(daysFromToday(7));
    await page.locator('input[name="date"]').blur();
    await page.locator('input#description').fill('Annual check-up');

    await expect(page.locator('button[type="submit"]:has-text("Add Visit")')).toBeEnabled();
  });

  test('the API rejects a visit date outside the allowed range', async () => {
    const {petId, birthDate} = await aPetWithAKnownBirthDate();

    expect(await postVisitExpectedToBeRejected(petId, ABSURDLY_OLD_DATE)).toBe(400);
    expect(await postVisitExpectedToBeRejected(petId, dayBefore(birthDate))).toBe(400);
    expect(await postVisitExpectedToBeRejected(petId, daysFromToday(366 + 30))).toBe(400);
  });
});
