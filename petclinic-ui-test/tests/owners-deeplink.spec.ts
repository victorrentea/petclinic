import { test, expect } from '@playwright/test';
import { OwnersPage } from './pages/OwnersPage';
import { ApiClient } from './support/api-client';

// 6.4 — deep-link spec
// Opening /owners?page=2&size=5&sort=city,desc restores that exact view;
// browser Back restores the prior state; returning from an owner detail
// restores the list state.
test.describe('Owners — deep-linking and navigation', () => {
  let apiClient: ApiClient;

  test.beforeAll(() => {
    apiClient = new ApiClient();
  });

  test('deep link restores page, size, and sort', async ({ page }) => {
    const targetPage = 2;
    const size = 5;
    const expected = await apiClient.fetchOwnersPage({ page: targetPage, size, sort: 'city,desc' });
    test.skip(expected.content.length === 0, 'not enough owners to reach page index 2 at size 5');

    const ownersPage = new OwnersPage(page);
    await ownersPage.openWithQuery('page=2&size=5&sort=city,desc');

    expect(await ownersPage.getSortDirection('city')).toBe('descending');
    expect(await ownersPage.getPageSize()).toBe(size);
    expect(await ownersPage.getOwnerFullNames()).toEqual(ApiClient.rowFullNames(expected.content));
  });

  test('browser Back restores the prior sort/page state', async ({ page }) => {
    const size = 10;
    const namePage = await apiClient.fetchOwnersPage({ page: 0, size, sort: 'name,asc' });
    const cityPage = await apiClient.fetchOwnersPage({ page: 0, size, sort: 'city,asc' });

    const ownersPage = new OwnersPage(page);
    await ownersPage.open();
    expect(await ownersPage.getOwnerFullNames()).toEqual(ApiClient.rowFullNames(namePage.content));

    await ownersPage.clickSortHeader('city');
    expect(await ownersPage.getOwnerFullNames()).toEqual(ApiClient.rowFullNames(cityPage.content));

    await page.goBack();
    expect(await ownersPage.getSortDirection('name')).toBe('ascending');
    expect(await ownersPage.getOwnerFullNames()).toEqual(ApiClient.rowFullNames(namePage.content));
  });

  test('returning from an owner detail restores the list state', async ({ page }) => {
    const targetPage = 2;
    const size = 5;
    const expected = await apiClient.fetchOwnersPage({ page: targetPage, size, sort: 'city,desc' });
    test.skip(expected.content.length === 0, 'not enough owners to reach page index 2 at size 5');
    const expectedNames = ApiClient.rowFullNames(expected.content);

    const ownersPage = new OwnersPage(page);
    await ownersPage.openWithQuery('page=2&size=5&sort=city,desc');
    expect(await ownersPage.getOwnerFullNames()).toEqual(expectedNames);

    await ownersPage.openFirstOwnerDetail();
    await page.goBack();

    expect(await ownersPage.getSortDirection('city')).toBe('descending');
    expect(await ownersPage.getPageSize()).toBe(size);
    expect(await ownersPage.getOwnerFullNames()).toEqual(expectedNames);
  });
});
