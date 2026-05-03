import {test, expect} from '@playwright/test';
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

  test('shows all visits on initial load', async ({page}) => {
    const visits = await apiClient.fetchVisits();
    const expected = visits.map((v: VisitDto) => ({
      date: v.date,
      description: v.description,
      petName: v.petName ?? '',
      ownerFullName: `${v.ownerFirstName ?? ''} ${v.ownerLastName ?? ''}`.trim(),
    }));

    const visitsPage = new VisitsPage(page);
    await visitsPage.open();
    await visitsPage.waitForVisitsCount(expected.length);

    const actual = await visitsPage.getVisitRows();
    expect(ApiClient.sortedByDate(actual)).toEqual(ApiClient.sortedByDate(expected));
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
