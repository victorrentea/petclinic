import {test, expect, Page} from './support/trace-fixture';

// The Owners grid pages and sorts on the server (#25): only Name and City sort, the page,
// size, sort and search live in the URL. Runs on the seed's 26 owners.
test.use({dbFixture: 'default'});

const names = (page: Page) => page.locator('#ownersTable td.ownerFullName');
const rangeLabel = (page: Page) => page.locator('.mat-mdc-paginator-range-label');
const header = (page: Page, title: string) => page.locator('#ownersTable th', {hasText: title});

async function openOwners(page: Page, query = ''): Promise<void> {
  await page.goto(`/owners${query}`);
  await expect(names(page).first()).toBeVisible({timeout: 10_000});
}

test('sorts by City, then reverses on a second click', async ({page}) => {
  await openOwners(page);

  await header(page, 'City').click();
  await expect(page).toHaveURL(/sort=city,asc/);
  await expect(names(page).first()).toHaveText('Long Silver'); // Bristol

  await header(page, 'City').click();
  await expect(page).toHaveURL(/sort=city,desc/);
  await expect(names(page).first()).toHaveText('Sam Carraclough'); // Yorkshire
});

test('Telephone is not sortable', async ({page}) => {
  await openOwners(page);
  const before = await names(page).allTextContents();

  await header(page, 'Telephone').click();

  await expect(page).not.toHaveURL(/sort=/);
  expect(await names(page).allTextContents()).toEqual(before);
});

test('a reload keeps the page, size and sort', async ({page}) => {
  await openOwners(page, '?page=1&size=5&sort=city,asc');
  const before = await names(page).allTextContents();

  await page.reload();

  await expect(names(page)).toHaveText(before);
  await expect(rangeLabel(page)).toHaveText(/6 – 10 of \d+/);
});

test('a shared link opens the same search, sort and page', async ({page}) => {
  await openOwners(page, '?lastName=Pot&page=0&size=5&sort=name,desc');

  await expect(page.locator('#lastName')).toHaveValue('Pot');
  await expect(names(page)).toHaveText(['Harry Potter', 'Beatrix Potter']);
});

test('a search from a later page shows the first page of the results', async ({page}) => {
  await openOwners(page, '?page=2&size=5');

  await page.fill('#lastName', 'Darling');
  await page.locator('#search-owner-form button[type="submit"]').click();

  await expect(page).toHaveURL(/page=0/);
  await expect(names(page)).toHaveText(['George Darling', 'Wendy Darling']);
});

test('a search with no match says so and shows no paginator', async ({page}) => {
  await openOwners(page);

  await page.fill('#lastName', 'Zzzz');
  await page.locator('#search-owner-form button[type="submit"]').click();

  await expect(page.locator('#noOwners')).toHaveText('No owners with last name starting with "Zzzz"');
  await expect(page.locator('mat-paginator')).toHaveCount(0);
});
