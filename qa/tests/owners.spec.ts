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
    await ownersPage.open();
    const actualFullNames = await ownersPage.getOwnerFullNames();

    // Fetch ALL owners from API to validate what the UI shows
    const allOwners = await apiClient.fetchOwners();
    const allFullNames = ApiClient.getFullNames(allOwners);

    // UI should show a non-empty first page (default size = 10)
    expect(actualFullNames.length).toBeGreaterThan(0);
    expect(actualFullNames.length).toBeLessThanOrEqual(10);

    // Every displayed owner must exist in the database
    for (const name of actualFullNames) {
      expect(allFullNames).toContain(name);
    }
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

    // Search is general-purpose (all fields) — verify UI matches API, not just lastName prefix
    expect(actualFilteredFullNames.length).toBeGreaterThan(0);
    expect(ApiClient.sorted(actualFilteredFullNames)).toEqual(
      ApiClient.sorted(expectedFilteredFullNames)
    );
  });
});
