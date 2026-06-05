import { test, expect } from '@playwright/test';
import { OwnersPage } from './pages/OwnersPage';
import { ApiClient } from './support/api-client';

// 6.2 — sort spec
// Default arrow is Name asc at open; clicking City sorts asc, clicking again
// flips to desc. The visible row order must match what the API returns for the
// same sort, so the assertion is data-driven (no hard-coded fixtures).
test.describe('Owners — sorting', () => {
  let apiClient: ApiClient;

  test.beforeAll(() => {
    apiClient = new ApiClient();
  });

  test('default sort on open is Name ascending', async ({ page }) => {
    const ownersPage = new OwnersPage(page);
    await ownersPage.open();

    expect(await ownersPage.getSortDirection('name')).toBe('ascending');
    expect(await ownersPage.getSortDirection('address')).toBe('none');
    expect(await ownersPage.getSortDirection('city')).toBe('none');
  });

  test('clicking City sorts ascending, matching the API order', async ({ page }) => {
    const size = 10;
    const expected = await apiClient.fetchOwnersPage({ page: 0, size, sort: 'city,asc' });
    const expectedNames = ApiClient.rowFullNames(expected.content);

    const ownersPage = new OwnersPage(page);
    await ownersPage.open();
    await ownersPage.clickSortHeader('city');

    expect(await ownersPage.getSortDirection('city')).toBe('ascending');
    expect(await ownersPage.getSortDirection('name')).toBe('none');
    expect(await ownersPage.getOwnerFullNames()).toEqual(expectedNames);
  });

  test('clicking City twice flips to descending, matching the API order', async ({ page }) => {
    const size = 10;
    const expected = await apiClient.fetchOwnersPage({ page: 0, size, sort: 'city,desc' });
    const expectedNames = ApiClient.rowFullNames(expected.content);

    const ownersPage = new OwnersPage(page);
    await ownersPage.open();
    await ownersPage.clickSortHeader('city');
    await ownersPage.clickSortHeader('city');

    expect(await ownersPage.getSortDirection('city')).toBe('descending');
    expect(await ownersPage.getOwnerFullNames()).toEqual(expectedNames);
  });
});
