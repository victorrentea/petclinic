import {DataTable, When, Then} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PlaywrightWorld} from './support/world';
import {OWNERS_HEADER, listedOwners} from './support/owners-grid';

// The steps owner-search.glue.ts already defines (the Background, opening the page,
// the ordered-rows assertion, the pager) are registered globally by Cucumber, so
// they are reused here rather than restated.
//
// What this file adds is the grid's *affordances* — the things a screenshot review
// argues about and a functional test usually leaves unguarded: is a sortable column
// recognisable before you click it, and does the table hold still when you do.

interface ColumnGeometry {
  lefts: number[];
  widths: number[];
}

// Kept in the module rather than on the World: the World is another session's file
// right now, and this is a single scenario's scratch value — Cucumber runs
// scenarios serially, so there is nobody to race with.
let notedGeometry: ColumnGeometry | undefined;

/**
 * Header geometry as the browser lays it out — the only honest source for "did it
 * move". `document`/`getComputedStyle` are typed away in this project (tsconfig
 * lib is ES2022, no DOM) even though the code runs in the page, hence the casts.
 */
async function columnGeometry(world: PlaywrightWorld): Promise<ColumnGeometry> {
  return world.page.evaluate((selector: string) => {
    const headers: any[] = [...(globalThis as any).document.querySelectorAll(selector)];
    return {
      lefts: headers.map((th) => Math.round(th.getBoundingClientRect().left)),
      widths: headers.map((th) => Math.round(th.getBoundingClientRect().width)),
    };
  }, OWNERS_HEADER);
}

When('I sort the grid by {string}', async function (this: PlaywrightWorld, column: string) {
  const rowsBefore = await listedOwners(this.page)();

  await this.page.locator(`[data-testid="sort-${column}"]`).click();

  // The click is answered by a round-trip, so the assertion that follows must not
  // read the page the old rows are still on.
  await expect
      .poll(listedOwners(this.page), {timeout: 10_000})
      .not.toEqual(rowsBefore);
});

When('I note where the columns are', async function (this: PlaywrightWorld) {
  notedGeometry = await columnGeometry(this);
});

Then('these columns show a sort arrow at rest', async function (this: PlaywrightWorld, columns: DataTable) {
  for (const [column] of columns.raw()) {
    const arrow = this.page.locator(`[data-testid="sort-${column.trim()}"] .mat-sort-header-arrow`);

    await expect(arrow).toBeVisible();
    // Visible in the DOM sense is not enough: Material's default is a fully
    // transparent arrow that only fades in on hover.
    await expect.poll(() => arrow.evaluate((el) => Number((globalThis as any).getComputedStyle(el).opacity)))
        .toBeGreaterThan(0.3);
  }
});

Then('the arrow of the sorted column is the most prominent one', async function (this: PlaywrightWorld) {
  const opacityOf = (selector: string) =>
    this.page.locator(selector).evaluate((el) => Number((globalThis as any).getComputedStyle(el).opacity));

  // Material marks an unsorted-but-sortable header aria-sort="none" rather than
  // leaving the attribute off, so "resting" is that value, not its absence.
  const sorted = await opacityOf(`${OWNERS_HEADER}[aria-sort]:not([aria-sort="none"]) .mat-sort-header-arrow`);
  const resting = await opacityOf(`${OWNERS_HEADER}[aria-sort="none"] .mat-sort-header-arrow >> nth=0`);

  expect(sorted).toBeGreaterThan(resting);
});

Then('the columns are exactly where they were', async function (this: PlaywrightWorld) {
  const before = notedGeometry;
  if (!before) {
    throw new Error('No column geometry was noted — the scenario is missing "I note where the columns are".');
  }

  // Not a poll: if the layout settles late the user has already seen it move.
  expect(await columnGeometry(this)).toEqual(before);
});
