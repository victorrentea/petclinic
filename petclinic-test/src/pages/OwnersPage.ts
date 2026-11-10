import {expect, Locator, Page} from '@playwright/test';

/**
 * The Owners grid, found by what a user sees — column headers, link text, the paginator's
 * labelled controls — rather than by CSS classes, so a restyled grid does not break it.
 *
 * Every interaction that changes the grid's state waits for the URL to change: the URL is
 * the grid's only state (design D7), so a click is not over until it has navigated. Without
 * that, a second click could merge its query params into the URL the first one was replacing.
 */
export class OwnersPage {
  readonly paginator: Locator;

  constructor(readonly page: Page) {
    // the grid has a pager above the table and one below, kept in sync: the tests use the one below
    this.paginator = page.getByRole('group', {name: 'Pagination'}).last();
  }

  async open(url = '/owners'): Promise<void> {
    await this.page.goto(url);
    await this.page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
  }

  async search(lastName: string): Promise<void> {
    await this.page.locator('#lastName').fill(lastName);
    await this.page.locator('#search-owner-form button[type="submit"]').click();
  }

  columnHeader(name: string): Locator {
    return this.page.getByRole('columnheader', {name, exact: true});
  }

  async sortBy(column: string): Promise<void> {
    await this.navigatingBy(() => this.columnHeader(column).click());
  }

  async nextPage(): Promise<void> {
    await this.navigatingBy(() => this.paginator.getByRole('button', {name: 'Next page'}).click());
  }

  async showPerPage(size: number): Promise<void> {
    await this.navigatingBy(async () => {
      await this.paginator.getByRole('combobox', {name: 'Items per page:'}).selectOption({label: String(size)});
    });
  }

  /** What the paginator says, e.g. "6 – 10 of 26": the selected page's range, then the total. */
  async range(): Promise<string> {
    const pagePicker = this.paginator.getByRole('combobox', {name: 'Page', exact: true});
    const selected = await pagePicker.locator('option:checked').textContent();
    const total = await this.paginator.getByText(/^of \d+$/).textContent();
    return `${selected?.trim()} ${total?.trim()}`;
  }

  async openOwner(lastFirst: string): Promise<void> {
    await this.page.getByRole('link', {name: lastFirst, exact: true}).click();
    await this.page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
  }

  /**
   * The text of the named columns, one array per row, top to bottom — a snapshot that never
   * waits, so it can be polled; no grid on screen reads as no rows.
   */
  async rows(columns: string[]): Promise<string[][]> {
    return this.page.evaluate((wanted) => {
      const clean = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();
      const headersOf = (table: Element) =>
        Array.from(table.querySelectorAll(':scope > thead > tr > th')).map((th) => clean(th.textContent));
      const grid = Array.from(document.querySelectorAll('table')).find((t) => headersOf(t).includes('Telephone'));
      if (!grid) return [];
      const headers = headersOf(grid);
      const indexes = wanted.map((column) => {
        const index = headers.indexOf(column);
        if (index < 0) throw new Error(`No "${column}" column among: ${headers.join(', ')}`);
        return index;
      });
      // Direct children only: a cell may nest a table of its own (the Pets column).
      return Array.from(grid.querySelectorAll(':scope > tbody > tr')).map((tr) => {
        const cells = Array.from(tr.children).filter((cell) => cell.tagName === 'TD');
        return indexes.map((i) => clean(cells[i]?.textContent));
      });
    }, columns);
  }

  async names(): Promise<string[]> {
    return (await this.rows(['Name'])).map(([name]) => name);
  }

  private async navigatingBy(action: () => Promise<void>): Promise<void> {
    const before = this.page.url();
    await action();
    await expect.poll(() => this.page.url(), {timeout: 10_000}).not.toBe(before);
  }
}
