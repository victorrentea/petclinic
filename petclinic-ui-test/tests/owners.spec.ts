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

  test('shows the first page of owners', async ({ page }) => {
    const ownersPage = new OwnersPage(page);

    // The grid asks for exactly what it shows: the default first page of 10
    const firstPage = await apiClient.fetchOwnerPage({ page: 0, size: 10, sort: 'name,asc' });
    const expectedFullNames = ApiClient.getFullNames(firstPage.content);

    await ownersPage.open();
    await ownersPage.waitForOwnersCount(expectedFullNames.length);

    const actualFullNames = await ownersPage.getOwnerFullNames();

    expect(actualFullNames.length).toBe(10);
    expect(actualFullNames).toEqual(expectedFullNames);

    // ...while the paginator still reports how many owners exist in total
    expect(await ownersPage.getTotalFromPaginator()).toBe(firstPage.totalElements);
    expect(firstPage.totalElements).toBeGreaterThan(10);
  });

  test('navigates to the second page', async ({ page }) => {
    const ownersPage = new OwnersPage(page);

    const firstPage = await apiClient.fetchOwnerPage({ page: 0, size: 10, sort: 'name,asc' });
    const secondPage = await apiClient.fetchOwnerPage({ page: 1, size: 10, sort: 'name,asc' });
    const firstPageNames = ApiClient.getFullNames(firstPage.content);
    const secondPageNames = ApiClient.getFullNames(secondPage.content);

    await ownersPage.open();
    await ownersPage.waitForOwnersCount(firstPageNames.length);
    await ownersPage.goToNextPage();
    await ownersPage.waitForOwnersCount(secondPageNames.length);

    const actualNames = await ownersPage.getOwnerFullNames();

    expect(actualNames).toEqual(secondPageNames);
    // no owner from page 1 reappears on page 2
    expect(actualNames.filter((name) => firstPageNames.includes(name))).toEqual([]);
    expect(page.url()).toContain('page=1');
  });

  test('sorts by city', async ({ page }) => {
    const ownersPage = new OwnersPage(page);

    await ownersPage.open();
    await ownersPage.waitForOwnersCount(10);

    await ownersPage.sortByCity();
    await page.waitForURL(/sort=city,asc/);

    const cities = await ownersPage.getCities();

    expect(cities.length).toBeGreaterThan(0);
    expect(cities).toEqual([...cities].sort((a, b) => a.localeCompare(b, 'en')));
  });

  test('changes the page size to 20', async ({ page }) => {
    const ownersPage = new OwnersPage(page);

    await ownersPage.open();
    await ownersPage.waitForOwnersCount(10);

    await ownersPage.selectPageSize(20);
    await page.waitForURL(/size=20/);
    await ownersPage.waitForOwnersCount(20);

    expect((await ownersPage.getOwnerFullNames()).length).toBe(20);
  });

  test('filters owners by last name prefix', async ({ page }) => {
    // Fetch all owners and choose a prefix
    const allOwners = await apiClient.fetchOwners();
    const prefix = ApiClient.choosePrefixFrom(allOwners);

    // Fetch filtered owners from API
    const expectedFilteredOwners = await apiClient.fetchOwnersByPrefix(prefix);
    const expectedFilteredFullNames = ApiClient.getFullNames(expectedFilteredOwners);

    // Open the owners page
    const ownersPage = new OwnersPage(page);
    await ownersPage.open();

    // Perform search
    await ownersPage.searchByLastNamePrefix(prefix);
    await ownersPage.waitForOwnersCount(expectedFilteredFullNames.length);

    // Get filtered results
    const actualFilteredFullNames = await ownersPage.getOwnerFullNames();

    // Assertions
    expect(actualFilteredFullNames.length).toBeGreaterThan(0);

    // Verify all results match the prefix
    for (const fullName of actualFilteredFullNames) {
      const lastName = ApiClient.extractLastName(fullName);
      expect(lastName.toLowerCase()).toMatch(new RegExp(`^${prefix.toLowerCase()}`));
    }

    // Verify exact match with API results
    expect(ApiClient.sorted(actualFilteredFullNames)).toEqual(
      ApiClient.sorted(expectedFilteredFullNames)
    );
  });
});
