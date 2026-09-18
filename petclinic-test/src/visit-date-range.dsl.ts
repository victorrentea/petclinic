import {expect, Page} from '@playwright/test';
import axios from 'axios';

// The sentences of visit-date-range.spec.ts. None of them submits the form: the scenarios
// only check what the form lets through, so no visit is ever created (see AGENTS.md).

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

export async function birth_date_of_pet(petId: number): Promise<string> {
  const {data: pet} = await axios.get(`${API_BASE}/pets/${petId}`, {timeout: 10_000});
  return pet.birthDate;
}

export function days_after(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function one_year_from_today(): string {
  const today = new Date();
  const inAYear = new Date(Date.UTC(today.getFullYear() + 1, today.getMonth(), today.getDate()));
  return inAYear.toISOString().slice(0, 10);
}

export async function enter_visit_date(page: Page, date: string): Promise<void> {
  const dateInput = page.locator('input[name="date"]');
  await dateInput.fill(date);
  await dateInput.blur();
  await page.locator('input#description').fill('Date range check');
}

export async function expect_visit_date_refused(page: Page, message: string): Promise<void> {
  await expect(page.locator('.help-block', {hasText: message})).toBeVisible();
  await expect(page.locator('button[type="submit"]:has-text("Add Visit")')).toBeDisabled();
}

export async function expect_visit_date_accepted(page: Page): Promise<void> {
  await expect(page.locator('input[name="date"]')).not.toHaveClass(/ng-invalid/);
  await expect(page.locator('button[type="submit"]:has-text("Add Visit")')).toBeEnabled();
}
