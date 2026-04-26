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
