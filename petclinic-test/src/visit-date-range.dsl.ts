import {expect, Page} from '@playwright/test';
import axios from 'axios';
import {OwnerWithPet} from './add-visit.dsl';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';
const DOG = {id: 2, name: 'dog'};

const idFromLocation = (location: string) => Number(location.split('/').pop());

/** Written through the API, so the scenario runs on an empty database as well as on a full one. */
export async function kevin_owns_a_dog_born_on(birthDate: string): Promise<OwnerWithPet> {
  const owner = await axios.post(`${API_BASE}/owners`, {
    firstName: 'Kevin', lastName: 'McCallister',
    address: '671 Lincoln Ave', city: 'Winnetka', telephone: '0712345678',
  });
  const ownerId = idFromLocation(owner.headers.location);
  const pet = await axios.post(`${API_BASE}/owners/${ownerId}/pets`, {name: 'Axel', birthDate, type: DOG});
  return {ownerId, petId: idFromLocation(pet.headers.location)};
}

export async function a_visit_is_booked_for(dog: OwnerWithPet, date: string): Promise<number> {
  const visit = await axios.post(`${API_BASE}/owners/${dog.ownerId}/pets/${dog.petId}/visits`,
    {date, description: 'ate the Christmas tinsel'});
  return idFromLocation(visit.headers.location);
}

export async function open_edit_visit_page(page: Page, visitId: number): Promise<void> {
  await page.goto(`/visits/${visitId}/edit`);
  await page.locator('h2:has-text("Edit Visit")').waitFor({state: 'visible', timeout: 10_000});
}

export async function type_visit_date(page: Page, date: string): Promise<void> {
  await page.locator('input[name="date"]').fill(date);
  await page.locator('input#description').fill('ate the Christmas tinsel; kept under observation');
}

export async function expect_date_refused_saying(page: Page, reason: string): Promise<void> {
  await expect(page.locator('#visit .has-error .help-block')).toContainText(reason);
  await expect(page.locator('#visit button[type="submit"]')).toBeDisabled();
}

export async function expect_no_visit_saved(dog: OwnerWithPet): Promise<void> {
  const {data: pet} = await axios.get(`${API_BASE}/owners/${dog.ownerId}/pets/${dog.petId}`);
  expect(pet.visits).toEqual([]);
}

/** Local, not toISOString(): that is UTC, a day behind the app's "today" right after midnight here. */
export function aYearFromToday(plusDays = 0): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  date.setDate(date.getDate() + plusDays);
  const twoDigits = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
}
