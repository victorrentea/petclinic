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
    const sanitizedTitle = testInfo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(screenshotDir, `${sanitizedTitle}_${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);
  });

  test('renders the first server-sorted page of owners', async ({ page }) => {
    // Default list state: page=0, size=10, sort=name (last_name, first_name), direction=asc.
    const firstPage = await apiClient.fetchOwnersPage({ page: 0, size: 10, sort: 'name', direction: 'asc' });
    const expectedFullNames = ApiClient.getFullNames(firstPage.content);

    const ownersPage = new OwnersPage(page);
    await ownersPage.open();
    await ownersPage.waitForOwnersCount(expectedFullNames.length);

    // Ordered equality (not sorted) — proves rows are rendered in the server's order, not re-sorted client-side.
    expect(await ownersPage.getOwnerFullNames()).toEqual(expectedFullNames);
  });

  test('filters owners by last name prefix', async ({ page }) => {
    const allOwners = await apiClient.fetchOwners();
    const prefix = ApiClient.choosePrefixFrom(allOwners);

    const expectedFiltered = await apiClient.fetchOwnersByPrefix(prefix);
    const expectedFilteredFullNames = ApiClient.getFullNames(expectedFiltered);

    const ownersPage = new OwnersPage(page);
    await ownersPage.open();

    await ownersPage.searchByLastNamePrefix(prefix);
    await ownersPage.waitForOwnersCount(expectedFilteredFullNames.length);

    const actual = await ownersPage.getOwnerFullNames();
    expect(actual.length).toBeGreaterThan(0);
    for (const fullName of actual) {
      const lastName = ApiClient.extractLastName(fullName);
      expect(lastName.toLowerCase()).toMatch(new RegExp(`^${prefix.toLowerCase()}`));
    }
    expect(ApiClient.sorted(actual)).toEqual(ApiClient.sorted(expectedFilteredFullNames));

    // A new search resets to the first page.
    expect(ownersPage.queryParams().get('page')).toBe('0');
  });

  test('sorts and paginates server-side, driven by URL query params', async ({ page }) => {
    const ownersPage = new OwnersPage(page);
    await ownersPage.open();

    // --- Server-side sort: click the City header → URL carries sort=city; rows match the API's city order.
    await ownersPage.sortByColumn('City');
    await expect.poll(() => ownersPage.queryParams().get('sort')).toBe('city');
    const cityDir = ownersPage.queryParams().get('direction') ?? 'asc';
    const cityPage = await apiClient.fetchOwnersPage({ page: 0, size: 10, sort: 'city', direction: cityDir });
    await ownersPage.waitForOwnersCount(cityPage.content.length);
    expect(await ownersPage.getOwnerFullNames()).toEqual(ApiClient.getFullNames(cityPage.content));

    // --- Server-side page size: choose 5 → URL carries size=5; at most 5 rows rendered.
    await ownersPage.selectPageSize(5);
    await expect.poll(() => ownersPage.queryParams().get('size')).toBe('5');
    expect((await ownersPage.getOwnerFullNames()).length).toBeLessThanOrEqual(5);

    // --- Server-side pagination: next page → URL page=1; rows match the API's page 1.
    const total = (await apiClient.fetchOwnersPage({ size: 5 })).page.totalElements;
    test.skip(total <= 5, 'seed has a single page at size=5; nothing to paginate');
    await ownersPage.goToNextPage();
    await expect.poll(() => ownersPage.queryParams().get('page')).toBe('1');
    const sortNow = ownersPage.queryParams().get('sort') ?? 'name';
    const dirNow = ownersPage.queryParams().get('direction') ?? 'asc';
    const apiPage1 = await apiClient.fetchOwnersPage({ page: 1, size: 5, sort: sortNow, direction: dirNow });
    await ownersPage.waitForOwnersCount(apiPage1.content.length);
    expect(await ownersPage.getOwnerFullNames()).toEqual(ApiClient.getFullNames(apiPage1.content));
  });
});
