import {test, expect} from './support/trace-fixture';

/**
 * The owners grid must not re-flow when its rows change.
 *
 * With a content-driven table layout, a page whose cities read "Yorkshire, Winnetka,
 * Wiltshire" is laid out wider than one reading "Bristol, Brussels, Dartmoor", so every
 * sort click and page change slid the headers sideways — including the header the cursor
 * had just clicked, which then sat somewhere else. Reported from the running app, missed
 * by every functional test: the rows were correct, only their geometry moved.
 *
 * Reads only, creates nothing — the suite runs fullyParallel against one shared database.
 */
test.describe('Owners grid layout', () => {
  const headerBoxes = (page: import('@playwright/test').Page) =>
    page.$$eval('#ownersTable th', (ths) =>
      ths.map((th) => {
        const {x, width} = th.getBoundingClientRect();
        return {label: th.textContent!.trim(), x: Math.round(x), width: Math.round(width)};
      })
    );

  test('column positions survive a sort that brings differently sized rows', async ({page}) => {
    await page.goto('/owners?page=0&size=5&sort=city,asc');
    await expect(page.locator('#ownersTable td.ownerFullName').first()).toBeVisible();
    const ascending = await headerBoxes(page);
    const ascendingCities = await page.$$eval('#ownersTable tbody td:nth-child(3)', (tds) =>
      tds.map((td) => td.textContent!.trim())
    );

    await page.locator('th[data-test="sort-city"]').click();
    await expect(page).toHaveURL(/sort=city,desc/);
    await expect(page.locator('#ownersTable td.ownerFullName').first()).toBeVisible();
    const descending = await headerBoxes(page);
    const descendingCities = await page.$$eval('#ownersTable tbody td:nth-child(3)', (tds) =>
      tds.map((td) => td.textContent!.trim())
    );

    // The guard is only meaningful if the two pages really do hold different content.
    expect(descendingCities).not.toEqual(ascendingCities);
    expect(descending).toEqual(ascending);
  });

  test('sortable columns say so without being hovered', async ({page}) => {
    await page.goto('/owners?page=0&size=5&sort=lastName,asc');
    await expect(page.locator('#ownersTable td.ownerFullName').first()).toBeVisible();

    // Read with the pointer parked away from the table: Material fades its arrow in on
    // hover, and a hint that only exists under the cursor is not a hint.
    await page.mouse.move(0, 0);
    const headers = await page.$$eval('#ownersTable th', (ths) =>
      ths.map((th) => {
        const arrow = th.querySelector('.mat-sort-header-arrow');
        return {
          label: th.textContent!.trim(),
          arrowOpacity: arrow ? Number(getComputedStyle(arrow).opacity) : null,
          cursor: getComputedStyle(th).cursor,
        };
      })
    );

    const sortable = headers.filter((h) => h.label === 'Name' || h.label === 'City');
    expect(sortable).toHaveLength(2);
    for (const header of sortable) {
      expect(header.arrowOpacity).toBeGreaterThan(0);
      expect(header.cursor).toBe('pointer');
    }

    for (const header of headers.filter((h) => !['Name', 'City'].includes(h.label))) {
      expect(header.arrowOpacity).toBeNull();
    }

    // Three states, and the middle one has to be visibly the middle one: the column being
    // sorted reads brighter than one that merely could be, and hovering closes the gap.
    const arrowColour = (column: string) =>
      page.locator(`th[data-test="${column}"] .mat-sort-header-arrow`)
        .evaluate((el) => getComputedStyle(el).color);

    const active = await arrowColour('sort-name');
    const idle = await arrowColour('sort-city');
    expect(idle).not.toBe(active);

    await page.locator('th[data-test="sort-city"]').hover();
    await expect
      .poll(() => arrowColour('sort-city'))
      .toBe(active);
  });

  test('column positions survive paging', async ({page}) => {
    await page.goto('/owners?page=0&size=5&sort=lastName,asc');
    await expect(page.locator('#ownersTable td.ownerFullName').first()).toBeVisible();
    const firstPage = await headerBoxes(page);

    await page.goto('/owners?page=1&size=5&sort=lastName,asc');
    await expect(page.locator('#ownersTable td.ownerFullName').first()).toBeVisible();

    expect(await headerBoxes(page)).toEqual(firstPage);
  });
});
