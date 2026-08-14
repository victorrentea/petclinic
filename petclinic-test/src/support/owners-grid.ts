import {Page} from '@playwright/test';

/**
 * The owners grid's DOM contract, in one place.
 *
 * `#ownersTable` and the `td.ownerFullName` cell are a deliberately preserved contract the
 * feature files depend on, so they are named here rather than respelled in each glue file -
 * a template rename then breaks one import instead of a handful of string literals scattered
 * across files whose names give no hint that they read this table.
 */
export const OWNERS_TABLE = '#ownersTable';
export const OWNER_NAME_CELL = `${OWNERS_TABLE} td.ownerFullName`;
export const OWNERS_HEADER = `${OWNERS_TABLE} th`;

/** The owner names currently on screen, top to bottom. Returns a thunk, ready for expect.poll. */
export const listedOwners = (page: Page) => async () =>
  (await page.locator(OWNER_NAME_CELL).allTextContents())
      .map((t) => t.trim())
      .filter(Boolean);
