import { test, expect } from './support/trace-fixture';
import { OwnersPage } from './pages/OwnersPage';
import { ApiClient } from './support/api-client';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Owners Page', () => {
  let apiClient: ApiClient;
  let screenshotDir: string;

  test.beforeAll(() => {
    apiClient = new ApiClient();
    screenshotDir = path.join(__dirname, '..', 'test-results', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Capture screenshot after each test
    const sanitizedTitle = testInfo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(screenshotDir, `${sanitizedTitle}_${timestamp}.png`);

    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);
  });

  test('shows the first page of owners sorted by name', async ({ page }) => {
    const ownersPage = new OwnersPage(page);

    // The grid loads page 0, size 10, sorted by name asc — mirror that from the API.
    const expectedPage = await apiClient.fetchFirstPage();
    const expectedNames = ApiClient.getFullNames(expectedPage.content);

    await ownersPage.open();
    await ownersPage.waitForOwnersCount(expectedNames.length);

    const actualNames = await ownersPage.getOwnerFullNames();

    // Default sort is name asc, so order must match exactly (not just as a set).
    expect(actualNames).toEqual(expectedNames);
  });

  test('filters owners by last name prefix', async ({ page }) => {
    const firstPage = await apiClient.fetchFirstPage();
    const prefix = ApiClient.choosePrefixFrom(firstPage.content);

    const expectedFiltered = await apiClient.fetchFirstPage(prefix);
    const expectedNames = ApiClient.getFullNames(expectedFiltered.content);

    const ownersPage = new OwnersPage(page);
    await ownersPage.open();

    await ownersPage.searchByLastNamePrefix(prefix);
    await ownersPage.waitForOwnersCount(expectedNames.length);

    const actualNames = await ownersPage.getOwnerFullNames();
    expect(actualNames.length).toBeGreaterThan(0);

    // Every displayed last name must start with the prefix.
    for (const fullName of actualNames) {
      const lastName = ApiClient.extractLastName(fullName);
      expect(lastName.toLowerCase()).toMatch(new RegExp(`^${prefix.toLowerCase()}`));
    }

    expect(actualNames).toEqual(expectedNames);
  });

  test('sorts by the City column', async ({ page }) => {
    const ownersPage = new OwnersPage(page);
    await ownersPage.open();

    await ownersPage.sortBy('city');

    const cities = await ownersPage.getCities();
    expect(cities.length).toBeGreaterThan(0);

    // Cities on the page must be in ascending order (backend collation is C = byte order).
    const ascending = [...cities].sort();
    expect(cities).toEqual(ascending);
  });

  test('pages through owners with the paginator', async ({ page }) => {
    const firstPage = await apiClient.fetchFirstPage();
    test.skip(firstPage.totalElements <= firstPage.size, 'Not enough owners to paginate');

    const ownersPage = new OwnersPage(page);
    await ownersPage.open();
    const firstPageNames = await ownersPage.getOwnerFullNames();

    await ownersPage.goToNextPage();
    const secondPageNames = await ownersPage.getOwnerFullNames();

    expect(secondPageNames.length).toBeGreaterThan(0);
    // Pages must be disjoint — no owner appears on both.
    for (const name of secondPageNames) {
      expect(firstPageNames).not.toContain(name);
    }
  });
});
