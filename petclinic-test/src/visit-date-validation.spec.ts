import {test, expect} from './support/trace-fixture';
import axios from 'axios';
import {API_BASE, anOwnerWhosePetsMatch} from './support/api-client';

// Issue #40: the visit date must be restricted to [pet birth date .. 1 year from now],
// on the frontend form *and* on the API.
//
// Nothing here creates or changes a visit: visits.spec.ts compares the entire visit
// list against the API, so a row appearing mid-run would break it. The happy paths
// (in-range dates being accepted) are covered by VisitTest on the backend, where each
// case runs in its own rolled-back transaction.

const ABSURD_DATE = '0009-07-20';

interface PetUnderTest {
  ownerId: number;
  petId: number;
  petName: string;
  birthDate: string;
}

async function anyPetWithAKnownBirthDate(): Promise<PetUnderTest> {
  const {owner, pet} = await anOwnerWhosePetsMatch((p) => !!p.birthDate);
  return {ownerId: owner.id, petId: pet.id, petName: pet.name, birthDate: pet.birthDate!};
}

function todayPlusDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The datepicker input is written as yyyy/mm/dd; the API speaks ISO yyyy-mm-dd. */
function toPickerFormat(isoDate: string): string {
  return isoDate.replace(/-/g, '/');
}

async function openAddVisitForm(page: any, pet: PetUnderTest): Promise<void> {
  await page.goto(`/owners/${pet.ownerId}`);
  await page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
  await page.locator('app-pet-list')
      .filter({hasText: pet.petName})
      .first()
      .locator('button:has-text("Add Visit")')
      .click();
  await page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});
}

async function fillVisitForm(page: any, pickerDate: string, description: string): Promise<void> {
  await page.locator('input[name="date"]').fill(pickerDate);
  await page.locator('input[name="date"]').blur();
  await page.locator('input#description').fill(description);
}

test.describe('Visit date range validation (issue #40)', () => {

  test('form rejects a visit date before the pet birth date', async ({page}) => {
    const pet = await anyPetWithAKnownBirthDate();
    await openAddVisitForm(page, pet);

    await fillVisitForm(page, toPickerFormat(ABSURD_DATE), 'visit while the pet did not exist yet');

    await expect(page.locator('#date-out-of-range')).toBeVisible();
    await expect(page.locator('button[type="submit"]:has-text("Add Visit")')).toBeDisabled();
  });

  test('form rejects a visit date more than one year in the future', async ({page}) => {
    const pet = await anyPetWithAKnownBirthDate();
    await openAddVisitForm(page, pet);

    await fillVisitForm(page, toPickerFormat(todayPlusDays(400)), 'visit too far into the future');

    await expect(page.locator('#date-out-of-range')).toBeVisible();
    await expect(page.locator('button[type="submit"]:has-text("Add Visit")')).toBeDisabled();
  });

  test('form accepts a visit date inside the allowed range', async ({page}) => {
    const pet = await anyPetWithAKnownBirthDate();
    await openAddVisitForm(page, pet);

    await fillVisitForm(page, toPickerFormat(todayPlusDays(7)), 'next week checkup');

    await expect(page.locator('#date-out-of-range')).toBeHidden();
    await expect(page.locator('button[type="submit"]:has-text("Add Visit")')).toBeEnabled();
  });

  test('API rejects creating a visit dated before the pet birth date', async () => {
    const pet = await anyPetWithAKnownBirthDate();

    const response = await axios.post(`${API_BASE}/visits`, {
      date: ABSURD_DATE,
      description: 'visit while the pet did not exist yet',
      petId: pet.petId,
    }, {timeout: 10_000, validateStatus: () => true});

    expect(response.status).toBe(400);
  });

  test('API rejects creating a visit dated more than one year in the future', async () => {
    const pet = await anyPetWithAKnownBirthDate();

    const response = await axios.post(`${API_BASE}/visits`, {
      date: todayPlusDays(400),
      description: 'visit too far into the future',
      petId: pet.petId,
    }, {timeout: 10_000, validateStatus: () => true});

    expect(response.status).toBe(400);
  });

  test('API rejects moving an existing visit outside the allowed range', async () => {
    const {data: visits} = await axios.get(`${API_BASE}/visits`, {timeout: 10_000});
    const victim = visits[0];

    const response = await axios.put(`${API_BASE}/visits/${victim.id}`, {
      date: ABSURD_DATE,
      description: 'moved before the pet was born',
    }, {timeout: 10_000, validateStatus: () => true});

    expect(response.status).toBe(400);

    const {data: unchanged} = await axios.get(`${API_BASE}/visits/${victim.id}`, {timeout: 10_000});
    expect(unchanged.date).toBe(victim.date);
    expect(unchanged.description).toBe(victim.description);
  });
});
