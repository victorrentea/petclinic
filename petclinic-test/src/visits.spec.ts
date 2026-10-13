import {test, expect} from './support/trace-fixture';
import * as fs from 'fs';
import * as path from 'path';
import {VisitsPage} from './pages/VisitsPage';
import {ApiClient, VisitDto} from './support/api-client';

test.describe('Visits Page', () => {
  let apiClient: ApiClient;
  let screenshotDir: string;

  test.beforeAll(() => {
    apiClient = new ApiClient();
    screenshotDir = path.join(__dirname, '..', 'test-results', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, {recursive: true});
    }
  });

  test.afterEach(async ({page}, testInfo) => {
    const sanitizedTitle = testInfo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(screenshotDir, `${sanitizedTitle}_${timestamp}.png`);
    await page.screenshot({path: screenshotPath, fullPage: true});
    console.log(`Screenshot saved: ${screenshotPath}`);
  });

  const asRows = (visits: VisitDto[]) => visits.map((v: VisitDto) => ({
    date: v.date,
    description: v.description,
    petName: v.petName ?? '',
    ownerFullName: `${v.ownerFirstName ?? ''} ${v.ownerLastName ?? ''}`.trim(),
  }));

  test('shows the ten latest visits on initial load', async ({page}) => {
    const expected = asRows((await apiClient.fetchVisitsPage()).content);

    const visitsPage = new VisitsPage(page);
    await visitsPage.open();
    await visitsPage.waitForVisitsCount(expected.length);

    expect(await visitsPage.getVisitRows()).toEqual(expected);
  });

  test('clicking a column header sorts by it and keeps the sort in the URL', async ({page}) => {
    const expected = asRows((await apiClient.fetchVisitsPage({sort: 'pet,asc'})).content);

    const visitsPage = new VisitsPage(page);
    await visitsPage.open();
    await visitsPage.sortBy('Pet');

    await expect(page).toHaveURL(/sort=pet,asc/);
    await expect.poll(() => visitsPage.getVisitRows()).toEqual(expected);
  });

  test('a page of 5 visits, then the next one', async ({page}) => {
    const expected = asRows((await apiClient.fetchVisitsPage({page: 1, size: 5})).content);

    const visitsPage = new VisitsPage(page);
    await visitsPage.open();
    await visitsPage.choosePageSize(5);
    await visitsPage.nextPage();

    await expect(page).toHaveURL(/page=2/);
    await expect.poll(() => visitsPage.getVisitRows()).toEqual(expected);
  });

  test('rows are sorted descending by date', async ({page}) => {
    const visitsPage = new VisitsPage(page);
    await visitsPage.open();
    const dates = await visitsPage.getDates();
    expect(dates.length).toBeGreaterThan(0);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  test('owner link navigates to owner detail', async ({page}) => {
    const visitsPage = new VisitsPage(page);
    await visitsPage.open();
    await visitsPage.clickFirstOwnerLink();
    await expect(page).toHaveURL(/\/owners\/\d+/);
  });
});
