import {expect, Page} from '@playwright/test';

// The sentences of visit-date-range.spec.ts (issue #40) that add-visit.dsl.ts does not
// already have. A refused date never leaves the browser, so these specs create no visit.

/** Kevin McCallister, owner of Axel the hamster, born 2018-12-24 (db/seed/R__seed.sql). */
export const KEVIN = {ownerId: 1, petBirthDate: '2018-12-24'};

/** Typed as a person would, in the datepicker's own YYYY/MM/DD format. */
export async function type_visit_date(page: Page, date: string): Promise<void> {
  await page.locator('input[name="date"]').fill(date);
  await page.locator('input[name="date"]').blur();
}

export async function type_a_description(page: Page): Promise<void> {
  await page.locator('input#description').fill('Annual check-up');
}

export async function expect_visit_refused_because(page: Page, reason: RegExp): Promise<void> {
  await expect(page.locator('.help-block', {hasText: reason})).toBeVisible();
  await expect(page.locator('button[type="submit"]:has-text("Add Visit")')).toBeDisabled();
}

/** One day past the latest bookable date, in the datepicker's format. */
export function one_year_and_a_day_from_today(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  date.setDate(date.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}
