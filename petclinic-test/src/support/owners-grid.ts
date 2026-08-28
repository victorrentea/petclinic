import {expect, Locator, Page} from '@playwright/test';

/**
 * The owners grid's DOM contract, in one place: the table kept its `#ownersTable` /
 * `td.ownerFullName` selectors when paging arrived (design D8), and the pager strip
 * and the sort arrows were added around it.
 */
export const SORT_KEY_BY_COLUMN: Record<string, string> = {Name: 'name', City: 'city'};

const ARROW_FOR_DIRECTION: Record<string, string> = {ascending: '▲', descending: '▼'};

export const nameCells = (page: Page): Locator => page.locator('#ownersTable td.ownerFullName');

/** The owner names currently rendered, in the order the grid shows them. */
export async function listedOwners(page: Page): Promise<string[]> {
  const texts = await nameCells(page).allTextContents();
  return texts.map((t) => t.trim()).filter(Boolean);
}

export const headerCell = (page: Page, column: string): Locator =>
  page.locator('#ownersTable thead th').filter({hasText: column}).first();

export function sortArrowFor(direction: string): string {
  const arrow = ARROW_FOR_DIRECTION[direction];
  if (!arrow) {
    throw new Error(`Unknown sort direction "${direction}" — expected ascending or descending`);
  }
  return arrow;
}

export function sortKeyFor(column: string): string {
  const key = SORT_KEY_BY_COLUMN[column];
  if (!key) {
    throw new Error(`Column "${column}" is not sortable — only ${Object.keys(SORT_KEY_BY_COLUMN).join(' and ')} are`);
  }
  return key;
}

// The pager renders numbers as text; read the number out rather than pinning the wording.
// NaN, not a throw, while the strip is mid-render: every caller polls, and a NaN simply
// keeps the poll going instead of aborting the step on a transient empty cell. A pager
// that is genuinely absent still fails loudly — on the locator, not here.
async function pagerNumber(page: Page, selector: string): Promise<number> {
  const text = (await page.locator(selector).textContent()) ?? '';
  const digits = text.replace(/[^\d]/g, '');
  return digits ? Number(digits) : NaN;
}

export const currentPage = (page: Page): Promise<number> => pagerNumber(page, '#pagerCurrentPage');
export const totalPages = (page: Page): Promise<number> => pagerNumber(page, '#pagerTotalPages');
export const totalElements = (page: Page): Promise<number> => pagerNumber(page, '#pagerTotalElements');

/** Clicks a sort header until it shows the wanted arrow — one click per direction it cycles through. */
export async function sortBy(page: Page, column: string, direction: string): Promise<void> {
  const header = page.locator(`#ownersTable th.sortable[data-sort-key="${sortKeyFor(column)}"]`);
  const arrow = header.locator('span.sort-arrow');
  const wanted = sortArrowFor(direction);
  // An unsorted sortable column now shows the *same* arrow as an ascending one, only dimmed
  // (class `sort-arrow-idle`), so the glyph alone no longer says whether the column is sorted.
  // Reading the idle column as "no arrow" keeps the old, meaningful three states.
  const shown = async () => arrow.evaluate((el) =>
    el.classList.contains('sort-arrow-idle') ? '' : (el.textContent ?? '').trim());
  for (let click = 0; click < 3; click++) {
    const before = await shown();
    if (before === wanted) {
      return;
    }
    await header.click();
    // Wait for the arrow to actually move: a ▲→▼ toggle never passes through the empty
    // state, so "not empty" would pass before the grid had re-sorted and click again.
    await expect.poll(shown, {timeout: 10_000}).not.toBe(before);
  }
  await expect(arrow).toHaveText(wanted, {timeout: 10_000});
}

/** The current page number, once the pager strip has actually rendered one. */
async function settledPage(page: Page): Promise<number> {
  await expect.poll(() => currentPage(page), {timeout: 10_000}).not.toBeNaN();
  return currentPage(page);
}

/** Steps to the 1-based page `wanted` with the pager's own Prev/Next buttons. */
export async function goToPage(page: Page, wanted: number): Promise<void> {
  for (let step = 0; step < 200; step++) {
    const at = await settledPage(page);
    if (at === wanted) {
      return;
    }
    await page.locator(at < wanted ? '#pagerNext' : '#pagerPrev').click();
    await expect.poll(() => currentPage(page), {timeout: 10_000}).not.toBe(at);
  }
  throw new Error(`Could not reach page ${wanted}`);
}

/**
 * Walks from the current page to the last one, collecting every name on the way.
 * This is what exposes a missing ORDER BY tiebreaker (design D6): under `LIMIT/OFFSET`
 * tied rows may be returned in a different order per page, so one owner shows up twice
 * and another never at all — visible only across the whole walk.
 */
export async function collectEveryPage(page: Page): Promise<string[]> {
  const collected: string[] = [];
  for (let step = 0; step < 500; step++) {
    const at = await settledPage(page);
    const rows = await listedOwners(page);
    collected.push(...rows);
    if (await page.locator('#pagerNext').isDisabled()) {
      return collected;
    }
    await page.locator('#pagerNext').click();
    // The pager label flips as soon as the route changes, while the table still shows the previous
    // page until its response lands. Waiting on the label alone re-reads the old rows and reports
    // every owner as a duplicate -- wait for the rows themselves to turn over.
    await expect.poll(async () => {
      const now = await listedOwners(page);
      const moved = await currentPage(page) === at + 1;
      return moved && now.join('|') !== rows.join('|');
    }, {timeout: 10_000}).toBe(true);
  }
  throw new Error('The pager never reached its last page');
}
