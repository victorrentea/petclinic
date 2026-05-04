import { test, expect } from '@playwright/test';
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

  test('shows all owners on initial load', async ({ page }) => {
    const ownersPage = new OwnersPage(page);

    // Fetch expected owners from API
    const expectedOwners = await apiClient.fetchOwners();
    const expectedFullNames = ApiClient.getFullNames(expectedOwners);

    // Open the owners page
    await ownersPage.open();

    // Wait for the expected number of owners
    await ownersPage.waitForOwnersCount(expectedFullNames.length);

    // Get actual owner names from the page
    const actualFullNames = await ownersPage.getOwnerFullNames();

    // Assert that all expected owners are displayed
    expect(ApiClient.sorted(actualFullNames)).toEqual(ApiClient.sorted(expectedFullNames));
  });

  test('filters owners by substring across multiple fields', async ({ page }) => {
    const allOwners = await apiClient.fetchOwners();
    const query = ApiClient.choosePrefixFrom(allOwners); // a 2-letter substring drawn from real data

    const expectedFilteredOwners = await apiClient.fetchOwnersByQuery(query);
    const expectedFilteredFullNames = ApiClient.getFullNames(expectedFilteredOwners);

    const ownersPage = new OwnersPage(page);
    await ownersPage.open();

    await ownersPage.search(query);
    await ownersPage.waitForOwnersCount(expectedFilteredFullNames.length);

    const actualFilteredFullNames = await ownersPage.getOwnerFullNames();

    expect(actualFilteredFullNames.length).toBeGreaterThan(0);
    // Substring match anywhere in the full name OR any other displayed field; we only
    // assert exact equivalence with the API's filtered set, since the regex `^prefix`
    // check no longer holds (matches can come from address/city/phone, not just lastName).
    expect(ApiClient.sorted(actualFilteredFullNames)).toEqual(
      ApiClient.sorted(expectedFilteredFullNames)
    );
  });
});
