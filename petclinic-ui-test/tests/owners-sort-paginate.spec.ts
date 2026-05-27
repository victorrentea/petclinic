import { test, expect, Page } from '@playwright/test';
import { ApiClient } from './support/api-client';

const tableTitle = (page: Page) => page.locator('h2:has-text("Owners")');
const rowNames = (page: Page) => page.locator('#ownersTable td.ownerFullName');
const paginator = (page: Page) => page.locator('mat-paginator');

async function openOwners(page: Page, query: string = '') {
  await page.goto(`/owners${query}`);
  await tableTitle(page).waitFor({ state: 'visible', timeout: 10000 });
  await rowNames(page).first().waitFor({ state: 'visible', timeout: 10000 });
}

async function getQueryParam(page: Page, key: string): Promise<string | null> {
  const url = new URL(page.url());
  return url.searchParams.get(key);
}

test.describe('Owners sort and pagination', () => {
  let apiClient: ApiClient;

  test.beforeAll(() => {
    apiClient = new ApiClient();
  });

  test('defaults to page 1, size 10, sorted by name asc', async ({ page }) => {
    await openOwners(page);

    // The page may be opened without an explicit ?size=, but the paginator must reflect size=10.
    await expect(paginator(page)).toBeVisible();
    await expect(paginator(page).locator('.mat-mdc-paginator-range-label')).toContainText('1 – 10');

    const rows = await rowNames(page).allTextContents();
    expect(rows.length).toBeLessThanOrEqual(10);

    // Default sort is by lastName asc — verify rows are non-decreasing on the leading lastName token.
    const lastNames = rows.map((t) => ApiClient.extractLastName(t.trim()).toLowerCase());
    const sortedLastNames = [...lastNames].sort();
    expect(lastNames).toEqual(sortedLastNames);
  });

  test('clicking City header sorts by city and resets to page 1', async ({ page }) => {
    await openOwners(page, '?page=2&size=5');

    const cityHeader = page.locator('th[mat-sort-header="city"]');
    await cityHeader.click();

    await expect.poll(() => getQueryParam(page, 'sort')).toBe('city,asc');
    await expect.poll(() => getQueryParam(page, 'page')).toBe('0');
  });

  test('changing page size to 20 resets to page 1', async ({ page }) => {
    await openOwners(page, '?page=2&size=5');

    // Use the paginator size selector
    await paginator(page).locator('.mat-mdc-paginator-page-size-select').click();
    await page.locator('mat-option', { hasText: /^20$/ }).click();

    await expect.poll(() => getQueryParam(page, 'size')).toBe('20');
    await expect.poll(() => getQueryParam(page, 'page')).toBe('0');
  });

  test('paginating advances the page index in the URL', async ({ page }) => {
    await openOwners(page, '?size=5');

    const nextButton = paginator(page).locator('button.mat-mdc-paginator-navigation-next');
    await nextButton.click();
    await expect.poll(() => getQueryParam(page, 'page')).toBe('1');

    await nextButton.click();
    await expect.poll(() => getQueryParam(page, 'page')).toBe('2');
  });

  test('deep-link restores rendered state', async ({ page }) => {
    await openOwners(page, '?page=0&size=5&sort=city,desc');

    expect(await getQueryParam(page, 'page')).toBe('0');
    expect(await getQueryParam(page, 'size')).toBe('5');
    expect(await getQueryParam(page, 'sort')).toBe('city,desc');

    await expect(paginator(page).locator('.mat-mdc-paginator-range-label')).toContainText('1 – 5');

    // City column should display the sort arrow indicating descending.
    const cityHeader = page.locator('th[mat-sort-header="city"]');
    await expect(cityHeader).toHaveAttribute('aria-sort', 'descending');
  });

  test('back button restores prior sort', async ({ page }) => {
    await openOwners(page, '?size=5&sort=name,asc');

    await page.locator('th[mat-sort-header="city"]').click();
    await expect.poll(() => getQueryParam(page, 'sort')).toBe('city,asc');

    await page.goBack();
    await expect.poll(() => getQueryParam(page, 'sort')).toBe('name,asc');
  });

  test('Pets cell has no <tr> nested inside the <td>', async ({ page }) => {
    await openOwners(page);

    const offendingRows = await page.locator('#ownersTable tbody td tr').count();
    expect(offendingRows).toBe(0);
  });

  test('Pets cell renders pet names as a comma-separated list', async ({ page }) => {
    await openOwners(page);

    // First row's Pets cell should contain either an empty string or names separated by ", ".
    const firstPetsCell = page.locator('#ownersTable tbody tr').first().locator('td').nth(3);
    const text = (await firstPetsCell.textContent() ?? '').trim();
    // No trailing comma; not contain a newline-only block.
    expect(text.endsWith(',')).toBe(false);
    expect(text).not.toContain('\n,');
  });
});
