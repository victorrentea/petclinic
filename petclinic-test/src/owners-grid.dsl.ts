import {expect, Page} from '@playwright/test';
import axios from 'axios';

// The sentences of owners-grid.spec.ts (#25). The grid must show what the API answers for the
// same page, size and sort; the order itself is the backend's business, tested in OwnerTest.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

export interface GridState {
  page: number;
  size: number;
  sort: string;
  lastName?: string;
}

const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;
const rangeLabel = (page: Page) => page.locator('.mat-mdc-paginator-range-label');
const header = (page: Page, column: string) => page.locator('#ownersTable th').filter({hasText: column});

/** The names on that page and the paginator's label for it, e.g. `6 – 10 of 26`. */
async function whatTheApiLists(state: GridState): Promise<{names: string[]; range: string}> {
  const {data} = await axios.get(`${API_BASE}/owners`, {params: state, timeout: 10_000});
  const first = data.number * data.size + 1;
  const last = first + data.content.length - 1;
  return {names: data.content.map(fullName), range: `${first} – ${last} of ${data.totalElements}`};
}

export async function open_the_owners_grid(page: Page): Promise<void> {
  await page.goto('/owners');
  await page.locator('#ownersTable td.ownerFullName').first().waitFor({timeout: 10_000});
}

export async function choose_rows_per_page(page: Page, size: number): Promise<void> {
  await page.locator('.mat-mdc-paginator-page-size-select').click();
  await page.locator('mat-option').filter({hasText: new RegExp(`^\\s*${size}\\s*$`)}).click();
}

export async function go_to_the_next_page(page: Page): Promise<void> {
  await page.getByRole('button', {name: 'Next page'}).click();
}

export async function sort_by(page: Page, column: string): Promise<void> {
  await header(page, column).locator('.mat-sort-header-container').click();
}

export async function search_last_name(page: Page, lastName: string): Promise<void> {
  await page.locator('#lastName').fill(lastName);
  await page.locator('#search-owner-form button[type="submit"]').click();
}

export async function open_the_first_listed_owner(page: Page): Promise<void> {
  await page.locator('#ownersTable td.ownerFullName a').first().click();
  await page.locator('h2:has-text("Owner Information")').waitFor({timeout: 10_000});
}

export async function go_back(page: Page): Promise<void> {
  await page.goBack();
}

// The totals come from the API, not from the seed: on `ng serve` nothing resets the database.
export async function expect_the_grid_to_show(page: Page, state: GridState, range: RegExp): Promise<void> {
  const expected = await whatTheApiLists(state);
  expect(expected.range).toMatch(range);
  await expect(rangeLabel(page)).toHaveText(expected.range);
  await expect.poll(async () => (await page.locator('#ownersTable td.ownerFullName').allTextContents())
    .map((t) => t.trim()), {timeout: 10_000}).toEqual(expected.names);
}

export async function expect_sorted(page: Page, column: string, direction: 'ascending' | 'descending') {
  await expect(header(page, column)).toHaveAttribute('aria-sort', direction);
}

export async function expect_not_sortable(page: Page, column: string): Promise<void> {
  await expect(header(page, column).locator('.mat-sort-header-container')).toHaveCount(0);
}
