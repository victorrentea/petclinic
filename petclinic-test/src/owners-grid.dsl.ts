import {expect, Page} from '@playwright/test';

// The sentences of owners-grid.spec.ts. The dev database also holds owners other specs left
// behind, so nothing here counts exact rows or totals: it checks order, paging and the URL.
// The URL changes before the new page has arrived, so every expectation polls the table.

const ro = new Intl.Collator('ro');

export interface Row {
  name: string;
  city: string;
}

export async function open_the_owners_grid(page: Page, query = ''): Promise<void> {
  await page.goto(`/owners${query}`);
  await page.locator('#ownersTable td.ownerFullName').first().waitFor({state: 'visible', timeout: 10_000});
}

export async function rows_shown(page: Page): Promise<Row[]> {
  const rows = page.locator('#ownersTable tbody tr');
  await rows.first().waitFor();
  return rows.evaluateAll(trs => trs.map(tr => ({
    name: tr.querySelector('td.ownerFullName')!.textContent!.trim(),
    city: tr.querySelectorAll('td')[2].textContent!.trim(),
  })));
}

export async function click_the_header(page: Page, column: 'Name' | 'City'): Promise<void> {
  await page.locator('#ownersTable th[mat-sort-header]', {hasText: column}).click();
}

/**
 * Runs `action` and returns the names in the owner page it made the grid ask for — what the grid
 * must then show. Other specs insert owners in parallel, so no earlier read of a page is a valid
 * expectation for a later one.
 */
async function names_answered(page: Page, action: () => Promise<unknown>): Promise<string[]> {
  const [answer] = await Promise.all([page.waitForResponse(r => /\/api\/owners\?/.test(r.url())), action()]);
  const owners: {firstName: string; lastName: string}[] = (await answer.json()).content;
  return owners.map(o => `${o.lastName}, ${o.firstName}`);
}

export function go_to_the_next_page(page: Page): Promise<string[]> {
  return names_answered(page, () => page.getByRole('button', {name: 'Next page'}).click());
}

export function reload_the_page(page: Page): Promise<string[]> {
  return names_answered(page, () => page.reload());
}

export async function choose_rows_per_page(page: Page, size: 5 | 10 | 20): Promise<void> {
  await page.locator('.mat-mdc-paginator-page-size-select').click();
  await page.getByRole('option', {name: String(size), exact: true}).click();
}

export async function open_the_first_owner_and_press_back(page: Page): Promise<string[]> {
  await page.locator('#ownersTable td.ownerFullName a').first().click();
  await page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
  return names_answered(page, () => page.locator('button:has-text("Back")').first().click());
}

/** Where each header starts, left to right, in pixels. */
export async function header_positions(page: Page): Promise<number[]> {
  return page.locator('#ownersTable thead th')
    .evaluateAll(ths => ths.map(th => Math.round(th.getBoundingClientRect().left)));
}

export async function expect_the_headers_at(page: Page, positions: number[]): Promise<void> {
  await expect.poll(() => header_positions(page)).toEqual(positions);
}

export async function expect_the_address(page: Page, query: string): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/owners${query.replace(/[?.]/g, '\\$&')}$`));
}

const byName = (direction: 'asc' | 'desc') => (a: Row, b: Row) =>
  (direction === 'asc' ? 1 : -1) * ro.compare(a.name, b.name);
/** Cities in the clicked direction; owners sharing a city always A→Z by name. */
const byCity = (direction: 'asc' | 'desc') => (a: Row, b: Row) =>
  (direction === 'asc' ? 1 : -1) * ro.compare(a.city, b.city) || ro.compare(a.name, b.name);
const isOrdered = (rows: Row[], order: (a: Row, b: Row) => number) =>
  rows.every((row, i) => i === 0 || order(rows[i - 1], row) <= 0);

export async function expect_rows_shown(page: Page, count: number): Promise<void> {
  await expect(page.locator('#ownersTable tbody tr')).toHaveCount(count);
}

export async function expect_names_in_order(page: Page, direction: 'asc' | 'desc'): Promise<void> {
  await expect.poll(async () => isOrdered(await rows_shown(page), byName(direction))).toBe(true);
}

export async function expect_cities_in_order(page: Page, direction: 'asc' | 'desc'): Promise<void> {
  await expect.poll(async () => isOrdered(await rows_shown(page), byCity(direction))).toBe(true);
}

export async function expect_the_grid_to_show(page: Page, names: string[]): Promise<void> {
  await expect.poll(async () => (await rows_shown(page)).map(r => r.name)).toEqual(names);
}

