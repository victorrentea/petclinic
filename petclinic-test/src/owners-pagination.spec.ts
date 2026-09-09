import {expect, test} from '@playwright/test';

/**
 * The mechanics behind the grid that no business reader should have to review: the URL
 * is the state, so a link reproduces a view exactly, and Back/reload go through the
 * same path as a click.
 *
 * Everything a person would actually check — the pager, the sorting, the tiebreak —
 * lives in owners-pagination.feature, which is the artefact signed off with the
 * business. Nothing here restates it.
 */
const ROWS = '#ownersTable td.ownerFullName';
const RANGE = '.mat-mdc-paginator-range-label';

test('a deep link reproduces the page, the size and the sort', async ({page}) => {
  await page.goto('/owners?page=2&size=5&sort=city,desc');

  await expect(page.locator(ROWS)).toHaveCount(5);
  await expect(page.locator(RANGE)).toContainText('11 – 15 of 28');
  await expect(page.locator('#ownersTable th', {hasText: /^\s*City\s*$/}))
      .toHaveAttribute('aria-sort', 'descending');
});

test('reloading keeps the place', async ({page}) => {
  await page.goto('/owners?page=1&size=20&sort=name,asc');
  await expect(page.locator(RANGE)).toContainText('21 – 28 of 28');

  await page.reload();

  await expect(page.locator(RANGE)).toContainText('21 – 28 of 28');
  await expect(page.locator(ROWS)).toHaveCount(8);
});

test('Back returns to the previous page of the grid', async ({page}) => {
  await page.goto('/owners?page=0&size=5&sort=name,asc');
  await expect(page.locator(RANGE)).toContainText('1 – 5 of 28');

  await page.locator('mat-paginator button[aria-label="Next page"]').click();
  await expect(page.locator(RANGE)).toContainText('6 – 10 of 28');

  await page.goBack();

  await expect(page.locator(RANGE)).toContainText('1 – 5 of 28');
});

test('an unsupported page size is refused rather than quietly changed', async ({request}) => {
  const response = await request.get('http://localhost:8080/api/owners?size=1000');

  expect(response.status()).toBe(400);
});
