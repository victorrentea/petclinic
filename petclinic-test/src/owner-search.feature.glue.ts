import {DataTable, Given, When, Then} from '@cucumber/cucumber';
import {expect, Page, Response} from '@playwright/test';
import {PlaywrightWorld} from './support/world';
import {fetchAllOwners, OwnerFixture, OwnerSort} from './support/owner-fixtures';

const fullName = (owner: OwnerFixture) => `${owner.firstName} ${owner.lastName}`;
const displayedName = (owner: OwnerFixture) => `${owner.lastName}, ${owner.firstName}`;
const namesIn = (cell: string) => cell.split(';').map(name => name.trim()).filter(Boolean);
const ownerLinks = (page: Page) => page.locator('#ownersTable td.ownerFullName a');
const listResponse = (response: Response) =>
  response.request().method() === 'GET' && /\/api\/owners$/.test(new URL(response.url()).pathname);

async function listAction(page: Page, action: () => Promise<unknown>): Promise<URL> {
  const responses: Response[] = [];
  const collect = (response: Response) => {
    if (listResponse(response)) responses.push(response);
  };
  page.on('response', collect);
  try {
    const [response] = await Promise.all([page.waitForResponse(listResponse), action()]);
    expect(response.status()).toBe(200);
    await expect(page.locator('#ownersTable table')).toHaveAttribute('aria-busy', 'false');
    expect(responses, 'one owner-list request per action').toHaveLength(1);
    return new URL(response.url());
  } finally {
    page.off('response', collect);
  }
}

async function listedIds(page: Page): Promise<number[]> {
  return ownerLinks(page).evaluateAll(links => links.map(link =>
    Number(link.getAttribute('href')!.split('/').pop())));
}

async function expectPage(world: PlaywrightWorld, pageNumber: number, size: number, sort: OwnerSort, prefix: string) {
  const owners = await fetchAllOwners(sort, prefix);
  const start = (pageNumber - 1) * size;
  const expected = owners.slice(start, start + size);
  await expect.poll(() => listedIds(world.page)).toEqual(expected.map(owner => owner.id));
  await expect(ownerLinks(world.page)).toHaveText(expected.map(displayedName));
  if (owners.length) {
    await expect(world.page.locator('.mat-mdc-paginator-range-label'))
      .toHaveText(`${start + 1} – ${Math.min(start + size, owners.length)} of ${owners.length}`);
    await expect(world.page.getByRole('combobox')).toHaveText(String(size));
  } else {
    await expect(world.page.getByRole('status')).toHaveText(`No owners with last name starting with "${prefix}"`);
    await expect(world.page.locator('mat-paginator')).toHaveCount(0);
  }
}

Given('the clinic has these owners', async function (this: PlaywrightWorld, owners: DataTable) {
  this.fixtureOwners = await fetchAllOwners();
  expect(this.fixtureOwners.map(fullName))
    .toEqual(expect.arrayContaining(owners.raw().map(([name]) => name.trim())));
});

Given('the clinic has more than 20 owners', function (this: PlaywrightWorld) {
  expect(this.requireFixtureOwners().length, 'seed must exercise multiple pages at every allowed size')
    .toBeGreaterThan(20);
});

When('I open the owners page', async function (this: PlaywrightWorld) {
  const url = await listAction(this.page, () => this.page.goto('/owners'));
  expect(url.searchParams.get('page')).toBe('0');
  expect(url.searchParams.get('size')).toBe('10');
  expect(url.searchParams.get('sort')).toBe('name,asc');
  await expectPage(this, 1, 10, 'name,asc', '');
});

When('I search owners for {string}', async function (this: PlaywrightWorld, search: string) {
  await this.page.locator('#lastName').fill(search);
  const url = await listAction(this.page, () =>
    this.page.locator('#search-owner-form button[type="submit"]').click());
  expect(url.searchParams.get('page')).toBe('0');
  expect(url.searchParams.get('lastName') ?? '').toBe(search);
});

When('I draft owner prefix {string}', async function (this: PlaywrightWorld, prefix: string) {
  await this.page.locator('#lastName').fill(prefix);
});

When('I go to the next owners page', async function (this: PlaywrightWorld) {
  await listAction(this.page, () => this.page.getByRole('button', {name: 'Next page', exact: true}).click());
});

When('I choose {int} owners per page', async function (this: PlaywrightWorld, size: number) {
  await this.page.getByRole('combobox').click();
  await expect(this.page.getByRole('option')).toHaveText(['5', '10', '20']);
  const url = await listAction(this.page, () =>
    this.page.getByRole('option', {name: String(size), exact: true}).click());
  expect(url.searchParams.get('page')).toBe('0');
  expect(url.searchParams.get('size')).toBe(String(size));
});

When('I sort owners by {string}', async function (this: PlaywrightWorld, sort: OwnerSort) {
  const [key, direction] = sort.split(',');
  const header = this.page.locator(`th[mat-sort-header="${key}"]`);
  while (await header.getAttribute('aria-sort') !== (direction === 'asc' ? 'ascending' : 'descending')) {
    const url = await listAction(this.page, () => header.getByRole('button').click());
    expect(url.searchParams.get('page')).toBe('0');
    expect(url.searchParams.get('sort')?.split(',')[0]).toBe(key);
  }
});

Then('exactly these owners are listed: {string}', async function (this: PlaywrightWorld, owners: string) {
  const expected = namesIn(owners).sort();
  await expect.poll(async () => (await ownerLinks(this.page).allTextContents()).map(name => name.trim()).sort())
    .toEqual(expected);
  if (!expected.length) {
    await expect(this.page.getByRole('status')).toContainText('No owners with last name starting with');
    await expect(this.page.locator('mat-paginator')).toHaveCount(0);
  }
});

Then('page {int} of size {int} is listed in {string} order for prefix {string}',
  async function (this: PlaywrightWorld, page: number, size: number, sort: OwnerSort, prefix: string) {
    await expectPage(this, page, size, sort, prefix);
  });

Then('only Name and City can be sorted', async function (this: PlaywrightWorld) {
  await expect(this.page.locator('#ownersTable th').filter({has: this.page.getByRole('button')}))
    .toHaveText(['Name', 'City']);
  await expect(this.page.getByRole('button', {name: 'Add Owner', exact: true})).toBeVisible();
  await expect(this.page.getByRole('button', {name: 'First page', exact: true})).toBeDisabled();
  await expect(this.page.getByRole('button', {name: 'Previous page', exact: true})).toBeDisabled();
});

Then('every owner is reachable in {string} order without missing or duplicate IDs',
  async function (this: PlaywrightWorld, sort: OwnerSort) {
    const expected = await fetchAllOwners(sort);
    const baseline = this.requireFixtureOwners();
    expect(expected.map(owner => owner.id).sort((a, b) => a - b))
      .toEqual(baseline.map(owner => owner.id).sort((a, b) => a - b));
    if (sort === 'name,asc') {
      expect(expected.map(owner => owner.id)).toEqual(baseline.map(owner => owner.id));
    } else if (sort === 'name,desc') {
      expect(expected.map(owner => owner.id)).toEqual(baseline.map(owner => owner.id).reverse());
    } else {
      const cityAscending = await fetchAllOwners('city,asc');
      expect(expected.map(owner => owner.id))
        .toEqual((sort === 'city,desc' ? cityAscending.reverse() : cityAscending).map(owner => owner.id));
    }
    const visited: number[] = [];
    for (let page = 1; (page - 1) * 5 < expected.length; page++) {
      await expectPage(this, page, 5, sort, '');
      visited.push(...await listedIds(this.page));
      if (page * 5 < expected.length) {
        await listAction(this.page, () => this.page.getByRole('button', {name: 'Next page', exact: true}).click());
      }
    }
    expect(visited).toEqual(expected.map(owner => owner.id));
    expect(new Set(visited).size).toBe(baseline.length);
    await expect(this.page.getByRole('button', {name: 'Next page', exact: true})).toBeDisabled();
    await expect(this.page.getByRole('button', {name: 'Last page', exact: true})).toBeDisabled();
    await listAction(this.page, () => this.page.getByRole('button', {name: 'Previous page', exact: true}).click());
    await expectPage(this, Math.ceil(expected.length / 5) - 1, 5, sort, '');
    await listAction(this.page, () => this.page.getByRole('button', {name: 'First page', exact: true}).click());
    await expectPage(this, 1, 5, sort, '');
    await listAction(this.page, () => this.page.getByRole('button', {name: 'Last page', exact: true}).click());
    await expectPage(this, Math.ceil(expected.length / 5), 5, sort, '');
  });
