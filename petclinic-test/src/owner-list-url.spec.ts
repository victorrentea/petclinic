import {Page, Request, Response} from '@playwright/test';
import {test, expect} from './support/trace-fixture';
import {fetchOwnerPage, OwnerSort} from './support/owner-fixtures';

const listResponse = (response: Response) =>
  response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/owners';

async function action(page: Page, perform: () => Promise<unknown>) {
  const requests: Request[] = [];
  const collect = (request: Request) => {
    if (request.method() === 'GET' && new URL(request.url()).pathname === '/api/owners') requests.push(request);
  };
  page.on('request', collect);
  try {
    await Promise.all([page.waitForResponse(listResponse), perform()]);
    await expect(page.locator('#ownersTable table')).toHaveAttribute('aria-busy', 'false');
    expect(requests, 'one owner-list request per action').toHaveLength(1);
  } finally {
    page.off('request', collect);
  }
}

async function expectState(page: Page, index: number, size: number, sort: OwnerSort, lastName = '') {
  const expected = await fetchOwnerPage(index, size, sort, lastName);
  const params = new URL(page.url()).searchParams;
  expect(params.get('page') ?? '0').toBe(String(index));
  expect(params.get('size') ?? '10').toBe(String(size));
  expect(params.get('sort') ?? 'name,asc').toBe(sort);
  expect(params.get('lastName') ?? '').toBe(lastName);
  await expect(page.getByRole('textbox', {name: 'Last name', exact: true})).toHaveValue(lastName);
  await expect(page.locator(`th[mat-sort-header="${sort.split(',')[0]}"]`))
    .toHaveAttribute('aria-sort', sort.endsWith(',asc') ? 'ascending' : 'descending');
  await expect.poll(() => page.locator('.ownerFullName a').evaluateAll(links =>
    links.map(link => Number(link.getAttribute('href')!.split('/').pop()))))
    .toEqual(expected.content.map(owner => owner.id));
  if (expected.totalElements) {
    await expect(page.getByRole('combobox')).toHaveText(String(size));
    const start = index * size;
    await expect(page.locator('.mat-mdc-paginator-range-label'))
      .toHaveText(`${start + 1} – ${Math.min(start + size, expected.totalElements)} of ${expected.totalElements}`);
  }
}

test('direct shared links and refresh restore a later page with one request', async ({page, browser}) => {
  const requests: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/owners') requests.push(request.url());
  });
  await action(page, () => page.goto('/petclinic/owners?page=1&size=5&sort=city,desc&lastName='));
  await expectState(page, 1, 5, 'city,desc');
  expect(requests).toHaveLength(1);
  requests.length = 0;
  await action(page, () => page.reload());
  await expectState(page, 1, 5, 'city,desc');
  expect(requests).toHaveLength(1);
  const recipient = await browser.newContext();
  try {
    const sharedPage = await recipient.newPage();
    await action(sharedPage, () => sharedPage.goto(page.url()));
    await expectState(sharedPage, 1, 5, 'city,desc');
  } finally {
    await recipient.close();
  }
});

test('search updates the shared URL and Back/Forward restore the matching grid', async ({page, browser}) => {
  await action(page, () => page.goto('/owners?page=0&size=5&sort=city,desc&lastName='));
  await action(page, () => page.getByRole('button', {name: 'Next page', exact: true}).click());
  await expectState(page, 1, 5, 'city,desc');
  await page.getByRole('textbox', {name: 'Last name', exact: true}).fill('Pot');
  await action(page, () => page.getByRole('button', {name: 'Find Owner', exact: true}).click());
  await expectState(page, 0, 5, 'city,desc', 'Pot');
  await action(page, () => page.reload());
  await expectState(page, 0, 5, 'city,desc', 'Pot');
  const sharedUrl = page.url();
  await action(page, () => page.getByRole('button', {name: 'Find Owner', exact: true}).click());
  expect(page.url()).toBe(sharedUrl);
  const recipient = await browser.newContext();
  try {
    const sharedPage = await recipient.newPage();
    await action(sharedPage, () => sharedPage.goto(sharedUrl));
    await expectState(sharedPage, 0, 5, 'city,desc', 'Pot');
  } finally {
    await recipient.close();
  }
  await action(page, () => page.goBack());
  await expectState(page, 1, 5, 'city,desc');
  await action(page, () => page.goForward());
  await expectState(page, 0, 5, 'city,desc', 'Pot');
});

test('encoded submitted prefixes survive refresh while draft edits stay out of the URL', async ({page}) => {
  await action(page, () => page.goto('/owners'));
  const input = page.getByRole('textbox', {name: 'Last name', exact: true});
  await input.fill('A&B +%_');
  await action(page, () => page.getByRole('button', {name: 'Find Owner', exact: true}).click());
  await expectState(page, 0, 10, 'name,asc', 'A&B +%_');
  await input.fill('Draft');
  expect(new URL(page.url()).searchParams.get('lastName')).toBe('A&B +%_');
  await action(page, () => page.reload());
  await expectState(page, 0, 10, 'name,asc', 'A&B +%_');
});

test('malformed links reset every setting with a notice and a single default request', async ({page}) => {
  const requests: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/owners') requests.push(request.url());
  });
  await action(page, () => page.goto('/owners?page=1&size=7&sort=city,desc&lastName=Pot'));
  await expect(page.locator('.alert-warning')).toContainText('Invalid owner-list URL');
  await expect(page.locator('.alert-warning')).toContainText('defaults');
  await expectState(page, 0, 10, 'name,asc');
  expect(requests).toHaveLength(1);
});
