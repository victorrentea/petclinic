const { test, expect } = require('@playwright/test');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080/api';

function ownersApiUrl(params = {}) {
  const normalizedBase = API_BASE_URL.replace(/\/+$/, '');
  const url = new URL(`${normalizedBase}/owners`);
  const defaults = {
    page: 0,
    size: 20,
    sort: 'id,asc',
    q: ''
  };

  const query = { ...defaults, ...params };
  url.searchParams.set('page', String(query.page));
  url.searchParams.set('size', String(query.size));
  url.searchParams.set('sort', query.sort);
  url.searchParams.set('q', query.q);

  return url.toString();
}

async function fetchOwnersPage(request, params = {}) {
  const response = await request.get(ownersApiUrl(params));
  expect(response.ok()).toBeTruthy();
  return response.json();
}

function ownerNamesFromApi(payload) {
  return payload.content.map((owner) => `${owner.firstName} ${owner.lastName}`.trim());
}

async function ownerNamesFromUi(page) {
  const links = page.locator('#ownersTable tbody tr td.ownerFullName a');
  return links.allTextContents().then((values) => values.map((value) => value.trim()));
}

async function assertUiMatchesApi(page, request, params = {}) {
  const apiPayload = await fetchOwnersPage(request, params);
  const expectedNames = ownerNamesFromApi(apiPayload);

  await expect(page.locator('#ownersTable tbody tr')).toHaveCount(expectedNames.length);
  await expect(page.locator('.owners-pages-total')).toContainText(`Page ${apiPayload.number + 1} of ${apiPayload.totalPages}`);

  const uiNames = await ownerNamesFromUi(page);
  expect(uiNames).toEqual(expectedNames);

  return apiPayload;
}

function pageFromUrl(page) {
  const raw = new URL(page.url()).searchParams.get('page');
  return raw === null ? 0 : Number(raw);
}

function valueFromUrl(page, key) {
  return new URL(page.url()).searchParams.get(key);
}

async function gotoOwners(page, queryString = '') {
  await page.goto(`/owners${queryString}`);
  await expect(page.locator('#owners-search')).toBeVisible();
  await expect(page.locator('#ownersTable tbody tr').first()).toBeVisible();
}

test.describe('Owners table pagination and sorting', () => {
  test('1) default load has sane pagination metadata and content', async ({ page, request }) => {
    await gotoOwners(page);

    const apiPayload = await assertUiMatchesApi(page, request, { page: 0, size: 20, sort: 'id,asc', q: '' });

    expect(apiPayload.totalPages).toBeGreaterThan(0);
    expect(apiPayload.number).toBe(0);
    expect(apiPayload.content.length).toBeLessThanOrEqual(apiPayload.size);
  });

  test('2) changing rows to 10 shows first page content from API', async ({ page, request }) => {
    await gotoOwners(page);

    await page.locator('#owners-page-size').selectOption('10');
    await expect(page).toHaveURL(/size=10/);
    await expect(page).toHaveURL(/page=0/);

    const apiPayload = await assertUiMatchesApi(page, request, { page: 0, size: 10, sort: 'id,asc', q: '' });
    expect(apiPayload.content.length).toBeLessThanOrEqual(10);
  });

  test('3) page 2 with size=10 matches API page content', async ({ page, request }) => {
    const firstPage = await fetchOwnersPage(request, { page: 0, size: 10, sort: 'id,asc', q: '' });
    test.skip(firstPage.totalPages < 2, 'Dataset does not have at least 2 pages for size=10');

    await gotoOwners(page, '?size=10&page=0');
    await page.locator('.owners-pagination').getByRole('link', { name: '2', exact: true }).click();

    await expect(page).toHaveURL(/size=10/);
    await expect(page).toHaveURL(/page=1/);
    expect(pageFromUrl(page)).toBe(1);

    await assertUiMatchesApi(page, request, { page: 1, size: 10, sort: 'id,asc', q: '' });
  });

  test('4) previous/next navigation updates URL query params correctly', async ({ page, request }) => {
    const firstPage = await fetchOwnersPage(request, { page: 0, size: 10, sort: 'id,asc', q: '' });
    test.skip(firstPage.totalPages < 2, 'Dataset does not have at least 2 pages for size=10');

    await gotoOwners(page, '?size=10&page=0');

    await page.locator('.owners-pagination a[aria-label="Next page"]').click();
    await expect(page).toHaveURL(/size=10/);
    await expect(page).toHaveURL(/page=1/);
    await expect(page.locator('.owners-pages-total')).toContainText('Page 2');

    await page.locator('.owners-pagination a[aria-label="Previous page"]').click();
    await expect(page).toHaveURL(/size=10/);
    await expect(page).toHaveURL(/page=0/);
    await expect(page.locator('.owners-pages-total')).toContainText('Page 1');

    await assertUiMatchesApi(page, request, { page: 0, size: 10, sort: 'id,asc', q: '' });
  });

  test('5) sort=lastName,desc first page matches API ordering', async ({ page, request }) => {
    await gotoOwners(page, '?sort=lastName,desc&page=0&size=10');

    expect(valueFromUrl(page, 'sort')).toBe('lastName,desc');

    await assertUiMatchesApi(page, request, { page: 0, size: 10, sort: 'lastName,desc', q: '' });
  });

  test('6) last page indicator and row count match API', async ({ page, request }) => {
    const firstPage = await fetchOwnersPage(request, { page: 0, size: 10, sort: 'id,asc', q: '' });
    test.skip(firstPage.totalPages === 0, 'No owners available to test pagination');

    const lastPageIndex = firstPage.totalPages - 1;
    await gotoOwners(page, '?size=10&page=0');

    if (lastPageIndex > 0) {
      await page.locator('.owners-pagination').getByRole('link', {
        name: String(firstPage.totalPages),
        exact: true
      }).click();
      await expect(page).toHaveURL(new RegExp(`page=${lastPageIndex}`));
    }

    const lastPayload = await assertUiMatchesApi(page, request, {
      page: lastPageIndex,
      size: 10,
      sort: 'id,asc',
      q: ''
    });

    expect(lastPayload.content.length).toBeLessThanOrEqual(lastPayload.size);
    expect(pageFromUrl(page)).toBe(lastPageIndex);
  });

  test('7) search resets page to 0 and paginates inside filtered set', async ({ page, request }) => {
    const initial = await fetchOwnersPage(request, { page: 0, size: 20, sort: 'id,asc', q: '' });
    const candidateQueries = Array.from(new Set(
      initial.content
        .map((owner) => (owner.lastName || '').trim().toLowerCase())
        .filter((lastName) => lastName.length >= 2)
        .flatMap((lastName) => [lastName.slice(0, 1), lastName.slice(0, 2)])
    ));

    let selectedQuery = null;
    let selectedPage = null;

    for (const q of candidateQueries) {
      const probe = await fetchOwnersPage(request, { page: 0, size: 2, sort: 'id,asc', q });
      if (probe.totalPages >= 2) {
        selectedQuery = q;
        selectedPage = probe;
        break;
      }
    }

    test.skip(!selectedQuery, 'Could not find a query with at least 2 filtered pages');

    await gotoOwners(page, '?size=2&page=1');

    const searchInput = page.locator('#owners-search');
    await searchInput.fill(selectedQuery);
    await searchInput.blur();

    await expect(page).toHaveURL(new RegExp(`q=${selectedQuery}`));
    await expect(page).toHaveURL(/page=0/);
    expect(valueFromUrl(page, 'q')).toBe(selectedQuery);
    expect(pageFromUrl(page)).toBe(0);

    await assertUiMatchesApi(page, request, { page: 0, size: 2, sort: 'id,asc', q: selectedQuery });

    await page.locator('.owners-pagination a[aria-label="Next page"]').click();
    await expect(page).toHaveURL(/page=1/);

    const secondFilteredPage = await fetchOwnersPage(request, { page: 1, size: 2, sort: 'id,asc', q: selectedQuery });
    expect(secondFilteredPage.totalPages).toBeGreaterThanOrEqual(2);
    await assertUiMatchesApi(page, request, { page: 1, size: 2, sort: 'id,asc', q: selectedQuery });
    expect(selectedPage.totalPages).toBeGreaterThanOrEqual(2);
  });
});

