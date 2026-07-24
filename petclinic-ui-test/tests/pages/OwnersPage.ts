import { Page, Locator, expect } from '@playwright/test';

/**
 * DOM contract with `owner-list.component.html`. The grid stays hand-rolled Bootstrap
 * (design D11 — no `mat-table`), so these are plain CSS/text selectors:
 *
 *   #ownersTable                  table wrapper
 *   td.ownerFullName              Name cell, rendered "lastName, firstName"
 *   .owners-pagination            pager: prev/next controls + "page X of Y"
 *   .owners-page-size select      page-size selector offering exactly 5 / 10 / 20
 */
export class OwnersPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly lastNameInput: Locator;
  readonly findOwnerButton: Locator;
  readonly ownerNameCells: Locator;
  readonly ownerLinks: Locator;
  readonly ownersTable: Locator;
  readonly pagination: Locator;
  readonly nextPageButton: Locator;
  readonly previousPageButton: Locator;
  readonly pageSizeSelect: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h2:has-text("Owners")');
    this.lastNameInput = page.locator('#lastName');
    this.findOwnerButton = page.locator('#search-owner-form button[type="submit"]');
    this.ownerNameCells = page.locator('#ownersTable td.ownerFullName');
    this.ownerLinks = page.locator('#ownersTable td.ownerFullName a');
    this.ownersTable = page.locator('#ownersTable');
    this.pagination = page.locator('.owners-pagination');
    // Accept either worded ("Next") or chevron ("»") pager controls.
    this.nextPageButton = this.pagination.getByRole('button', { name: /next|›|»/i });
    this.previousPageButton = this.pagination.getByRole('button', { name: /prev|‹|«/i });
    this.pageSizeSelect = page.locator('.owners-page-size select');
  }

  async open(queryString: string = '') {
    await this.page.goto(`/owners${queryString}`);
    await this.pageTitle.waitFor({ state: 'visible', timeout: 10000 });
  }

  async getOwnerFullNames(): Promise<string[]> {
    await this.page.waitForSelector('#ownersTable td.ownerFullName, #lastName', { timeout: 10000 });

    const elements = await this.ownerNameCells.all();
    const names: string[] = [];

    for (const element of elements) {
      const text = await element.textContent();
      if (text && text.trim()) {
        names.push(text.trim());
      }
    }

    return names;
  }

  /**
   * Owner ids of the rendered rows, read off the row links. Ids — not names — are what
   * makes "no owner on two pages" an exact check: two owners can share a display name.
   */
  async getOwnerIds(): Promise<number[]> {
    const hrefs = await this.ownerLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute('href') ?? '')
    );
    return hrefs
      .map((href) => href.match(/\/owners\/(\d+)/)?.[1])
      .filter((id): id is string => Boolean(id))
      .map(Number);
  }

  async searchByLastNamePrefix(prefix: string) {
    await this.lastNameInput.waitFor({ state: 'visible' });
    await this.lastNameInput.clear();
    await this.lastNameInput.fill(prefix);
    await this.lastNameInput.press('Tab');

    await this.findOwnerButton.waitFor({ state: 'visible' });
    await this.findOwnerButton.click();
  }

  async waitForOwnersCount(expectedCount: number) {
    try {
      await expect(this.ownerNameCells).toHaveCount(expectedCount, { timeout: 10000 });
    } catch (error) {
      // Let assertions fail with actual values when wait condition is not met
    }
  }

  async goToNextPage() {
    const current = this.readPageFromUrl();
    await this.nextPageButton.click();
    await this.page.waitForURL(new RegExp(`[?&]page=${current + 1}(&|$)`), { timeout: 10000 });
  }

  async selectPageSize(size: number) {
    await this.pageSizeSelect.selectOption(String(size));
    await this.page.waitForURL(new RegExp(`[?&]size=${size}(&|$)`), { timeout: 10000 });
  }

  /** Zero-based page index taken from the URL, which is the screen's source of truth (design D13). */
  readPageFromUrl(): number {
    const page = new URL(this.page.url()).searchParams.get('page');
    return page === null ? 0 : Number(page);
  }

  /** Total page count as the pager itself reports it, e.g. "Page 1 of 3". */
  async getTotalPagesFromPager(): Promise<number> {
    const text = (await this.pagination.innerText()).replace(/\s+/g, ' ');
    const match = text.match(/(\d+)\s*(?:of|\/)\s*(\d+)/i);
    if (!match) {
      throw new Error(`Pager does not show an "x of y" position; it reads: "${text}"`);
    }
    return Number(match[2]);
  }

  async isNextPageEnabled(): Promise<boolean> {
    return this.nextPageButton.isEnabled();
  }

  async isPreviousPageEnabled(): Promise<boolean> {
    return this.previousPageButton.isEnabled();
  }
}
