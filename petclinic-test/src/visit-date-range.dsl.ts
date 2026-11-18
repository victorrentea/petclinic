import {expect, Page} from '@playwright/test';
import axios from 'axios';

// The sentences of visit-date-range.spec.ts (issue #40): a visit is dated between the
// pet's birth and one year from today — refused by the form AND by the API.

const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:8080/api';

export interface OwnerWithPet {
  ownerId: number;
  petId: number;
}

function idFromLocation(location: string): number {
  return Number(location.split('/').pop());
}

export async function a_dog_born_on(birthDate: string): Promise<OwnerWithPet> {
  const {headers: ownerHeaders} = await axios.post(`${API_BASE}/owners`, {
    firstName: 'Kevin', lastName: 'McCallister', address: '671 Lincoln Ave',
    city: 'Winnetka', telephone: '0712345678',
  });
  const ownerId = idFromLocation(ownerHeaders.location);
  const {data: petTypes} = await axios.get(`${API_BASE}/pettypes`);
  const dog = petTypes.find((t: any) => t.name === 'dog');
  const {headers: petHeaders} = await axios.post(`${API_BASE}/owners/${ownerId}/pets`,
    {name: 'Axel', birthDate, type: dog});
  return {ownerId, petId: idFromLocation(petHeaders.location)};
}

export async function open_new_visit_form(page: Page, petId: number): Promise<void> {
  await page.goto(`/pets/${petId}/visits/add`);
  await expect(page.locator('h2:has-text("New Visit")')).toBeVisible();
  await expect(page.getByRole('cell', {name: 'Axel'})).toBeVisible();
}

export async function type_visit(page: Page, date: string, description: string): Promise<void> {
  await page.locator('input[name="date"]').fill(date);
  await page.locator('input#description').fill(description);
  await page.locator('input#description').press('Tab');
}

export async function expect_form_refuses_date_with(page: Page, message: string): Promise<void> {
  await expect(page.locator('.help-block', {hasText: message})).toBeVisible();
  await expect(page.locator('button[type="submit"]:has-text("Add Visit")')).toBeDisabled();
}

export async function expect_form_accepts_date(page: Page): Promise<void> {
  await expect(page.locator('button[type="submit"]:has-text("Add Visit")')).toBeEnabled();
}

/** Bypasses the form: the API must refuse on its own, whoever calls it. */
export async function post_visit_through_api(pet: OwnerWithPet, date: string): Promise<number> {
  const res = await axios.post(`${API_BASE}/owners/${pet.ownerId}/pets/${pet.petId}/visits`,
    {date, description: 'ate the Christmas tinsel; kept under observation'},
    {validateStatus: () => true});
  return res.status;
}

export async function expect_pet_has_no_visits(pet: OwnerWithPet): Promise<void> {
  const {data} = await axios.get(`${API_BASE}/pets/${pet.petId}`);
  expect(data.visits ?? []).toEqual([]);
}
