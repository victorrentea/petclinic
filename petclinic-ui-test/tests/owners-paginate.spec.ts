import { test, expect } from '@playwright/test';
import { OwnersPage } from './pages/OwnersPage';
import { ApiClient } from './support/api-client';

// 6.3 — paginate spec
// next/last move through pages and update the range label; the page-size
// selector changes the row count and snaps back to page 1; the paginator is
// hidden when a narrow filter yields <=5 owners.
test.describe('Owners — pagination', () => {
  let apiClient: ApiClient;

  test.beforeAll(() => {
    apiClient = new ApiClient();
  });

  test('next then last move through pages and update the range label', async ({ page }) => {
    const size = 5;
    const firstPage = await apiClient.fetchOwnersPage({ page: 0, size });
    test.skip(firstPage.totalElements <= size, 'need more than one page of owners');

    const ownersPage = new OwnersPage(page);
    await ownersPage.open();
    await ownersPage.selectPageSize(size);

    const total = firstPage.totalElements;
    expect(await ownersPage.getRangeLabel()).toContain(`of ${total}`);

    const secondPage = await apiClient.fetchOwnersPage({ page: 1, size });
    await ownersPage.goToNextPage();
    expect(await ownersPage.getOwnerFullNames()).toEqual(ApiClient.rowFullNames(secondPage.content));

    const lastIndex = secondPage.totalPages - 1;
    const lastPage = await apiClient.fetchOwnersPage({ page: lastIndex, size });
    await ownersPage.goToLastPage();
    expect(await ownersPage.getOwnerFullNames()).toEqual(ApiClient.rowFullNames(lastPage.content));

    const tailStart = lastIndex * size + 1;
    expect(await ownersPage.getRangeLabel()).toContain(`${tailStart}`);
    expect(await ownersPage.getRangeLabel()).toContain(`of ${total}`);
  });

  test('page size 20 changes the row count and resets to page 1', async ({ page }) => {
    const firstPage = await apiClient.fetchOwnersPage({ page: 0, size: 5 });
    test.skip(firstPage.totalElements <= 5, 'need more than one page of owners');

    const ownersPage = new OwnersPage(page);
    await ownersPage.open();
    await ownersPage.selectPageSize(5);
    await ownersPage.goToNextPage();

    await ownersPage.selectPageSize(20);

    const page20 = await apiClient.fetchOwnersPage({ page: 0, size: 20 });
    const expectedCount = Math.min(20, page20.totalElements);
    expect(await ownersPage.getRowCount()).toBe(expectedCount);
    expect(await ownersPage.getRangeLabel()).toContain('1');
    expect(await ownersPage.getOwnerFullNames()).toEqual(ApiClient.rowFullNames(page20.content));
  });

  test('paginator hidden when a narrow filter yields at most 5 owners', async ({ page }) => {
    const allOwners = await apiClient.fetchOwnersPage({ page: 0, size: 100 });
    const prefix = ApiClient.narrowPrefix(allOwners.content, 5);
    test.skip(prefix === null, 'no last-name prefix narrows the list to <=5 owners');

    const filtered = await apiClient.fetchOwnersPage({ page: 0, size: 100, lastName: prefix! });
    expect(filtered.totalElements).toBeLessThanOrEqual(5);

    const ownersPage = new OwnersPage(page);
    await ownersPage.open();
    await ownersPage.searchByLastNamePrefix(prefix!);
    await ownersPage.waitForOwnersCount(filtered.totalElements);

    expect(await ownersPage.isPaginatorVisible()).toBe(false);
    expect(await ownersPage.getSortDirection('name')).toBe('ascending');
  });
});
