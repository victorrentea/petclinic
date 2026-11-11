import {expect, Page} from '@playwright/test';
import axios from 'axios';

// The sentences of visit-date-range.spec.ts (#40). Dates are written the way the
// datepicker parses them (YYYY/MM/DD, visits.module.ts), not the API's ISO form.

const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:8080/api';
const DOG_TYPE_ID = 2; // db/reference/R__reference.sql

export interface PetOfOwner {
  ownerId: number;
  petId: number;
}

function idFromLocation(location: string): number {
  return Number(location.split('/').pop());
}

export async function kevin_owns_a_dog_born_on(isoBirthDate: string): Promise<PetOfOwner> {
  const owner = await axios.post(`${API_BASE}/owners`, {
    firstName: 'Kevin', lastName: 'McCallister',
    address: '671 Lincoln Ave', city: 'Winnetka', telephone: '0712345678',
  });
  const ownerId = idFromLocation(owner.headers.location);
  const pet = await axios.post(`${API_BASE}/owners/${ownerId}/pets`, {
    name: 'Axel', birthDate: isoBirthDate, type: {id: DOG_TYPE_ID, name: 'dog'},
  });
  return {ownerId, petId: idFromLocation(pet.headers.location)};
}

export function plus_one_year_and_one_day_from_today(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  date.setDate(date.getDate() + 1);
  return pickerFormat(date);
}

export function today(): string {
  return pickerFormat(new Date());
}

function pickerFormat(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

export async function type_visit_date_and_description(page: Page, date: string, description: string) {
  await page.locator('input[name="date"]').fill(date);
  await page.locator('input#description').fill(description);
}

export async function expect_visit_date_refused_with(page: Page, message: string) {
  await expect(page.locator('.help-block').filter({hasText: message})).toBeVisible();
  await expect(page.locator('button[type="submit"]:has-text("Add Visit")')).toBeDisabled();
}

export async function expect_visit_date_accepted(page: Page) {
  await expect(page.locator('input[name="date"]')).toHaveClass(/ng-valid/);
  await expect(page.locator('button[type="submit"]:has-text("Add Visit")')).toBeEnabled();
}
