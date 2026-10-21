import {test, expect, Page} from './support/trace-fixture';
import axios from 'axios';

// Issue #40: a visit is dated between the pet's birth and one year from today.
// The browser half proves the form refuses such a date; the API half proves the backend
// does too, since a form is one client among several (the MCP, scripts, curl).
//
// The pet is created here, not taken from a dataset: its birth date IS the rule under test.
// The upper bound is relative to the real today — the backend's clock cannot be pinned from here.

const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:8080/api';
const BIRTH_DATE = '2020-03-01';
const DAY_BEFORE_BIRTH = '2020-02-29';
const CAT_TYPE = {id: 1, name: 'cat'};

interface OwnerAndPet {
  ownerId: number;
  petId: number;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function oneYearAndADayFromToday(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  date.setDate(date.getDate() + 1);
  return isoDate(date);
}

function idFromLocation(location: string): number {
  return Number(location.split('/').pop());
}

async function a_pet_born_on(birthDate: string): Promise<OwnerAndPet> {
  const owner = await axios.post(`${API_BASE}/owners`, {
    firstName: 'Ada', lastName: 'Lovelace', address: '110 Analytical Engine Way',
    city: 'London', telephone: '6085551023',
  });
  const ownerId = idFromLocation(owner.headers.location);
  const pet = await axios.post(`${API_BASE}/owners/${ownerId}/pets`, {
    name: 'Bull', birthDate, type: CAT_TYPE,
  });
  return {ownerId, petId: idFromLocation(pet.headers.location)};
}

async function visitDatesOf(petId: number): Promise<string[]> {
  const {data: visits} = await axios.get(`${API_BASE}/visits`);
  return visits.filter((v: any) => v.petId === petId).map((v: any) => v.date);
}

async function try_to_book_through_the_form(page: Page, petId: number, date: string): Promise<void> {
  await page.goto(`/pets/${petId}/visits/add`);
  await page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});
  await page.locator('input[name="date"]').fill(date);
  await page.locator('input#description').fill('Annual check-up');
  await page.locator('input#description').press('Tab');
}

async function bookViaApi(pet: OwnerAndPet, date: string): Promise<number> {
  const res = await axios.post(`${API_BASE}/owners/${pet.ownerId}/pets/${pet.petId}/visits`,
    {date, description: 'Annual check-up'}, {validateStatus: () => true});
  return res.status;
}

test.describe('the visit form', () => {
  test('refuses a date before the pet was born', async ({page}) => {
    const pet = await a_pet_born_on(BIRTH_DATE);

    await try_to_book_through_the_form(page, pet.petId, DAY_BEFORE_BIRTH);

    await expect(page.getByText(`Visit date cannot be before the pet's birth date (${BIRTH_DATE})`)).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test('refuses a date more than a year ahead', async ({page}) => {
    const pet = await a_pet_born_on(BIRTH_DATE);

    await try_to_book_through_the_form(page, pet.petId, oneYearAndADayFromToday());

    await expect(page.getByText('Visit date cannot be more than one year from today')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test('still books a date within the range', async ({page}) => {
    const pet = await a_pet_born_on(BIRTH_DATE);

    await try_to_book_through_the_form(page, pet.petId, BIRTH_DATE);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(new RegExp(`/owners/${pet.ownerId}$`), {timeout: 10_000});
    expect(await visitDatesOf(pet.petId)).toEqual([BIRTH_DATE]);
  });
});

test.describe('the API', () => {
  test('refuses to book a visit before the pet was born', async () => {
    const pet = await a_pet_born_on(BIRTH_DATE);

    expect(await bookViaApi(pet, DAY_BEFORE_BIRTH)).toBe(400);
    expect(await visitDatesOf(pet.petId)).toEqual([]);
  });

  test('refuses to book a visit more than a year ahead', async () => {
    const pet = await a_pet_born_on(BIRTH_DATE);

    expect(await bookViaApi(pet, oneYearAndADayFromToday())).toBe(400);
    expect(await visitDatesOf(pet.petId)).toEqual([]);
  });

  test('refuses to move an existing visit out of the range', async () => {
    const pet = await a_pet_born_on(BIRTH_DATE);
    expect(await bookViaApi(pet, BIRTH_DATE)).toBe(201);
    const {data: visits} = await axios.get(`${API_BASE}/visits`);
    const visitId = visits.find((v: any) => v.petId === pet.petId).id;

    const res = await axios.put(`${API_BASE}/visits/${visitId}`,
      {date: DAY_BEFORE_BIRTH, description: 'Annual check-up'}, {validateStatus: () => true});

    expect(res.status).toBe(400);
    expect(await visitDatesOf(pet.petId)).toEqual([BIRTH_DATE]);
  });
});
