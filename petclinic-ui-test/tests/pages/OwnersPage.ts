import { Page, Locator } from '@playwright/test';

export class OwnersPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly lastNameInput: Locator;
  readonly findOwnerButton: Locator;
  readonly ownerNameCells: Locator;
  readonly ownersTable: Locator;
  readonly paginator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h2:has-text("Owners")');
    this.lastNameInput = page.locator('.search-bar input.search-input');
    this.findOwnerButton = page.locator('.search-bar button:has-text("Find Owner")');
    this.ownerNameCells = page.locator('table.owners-table td.ownerFullName');
    this.ownersTable = page.locator('table.owners-table');
    this.paginator = page.locator('mat-paginator');
  }

  async open() {
    await this.page.goto('/owners');
    await this.pageTitle.waitFor({ state: 'visible', timeout: 10000 });
  }

  async getOwnerFullNames(): Promise<string[]> {
    await this.page.waitForSelector('table.owners-table td.ownerFullName, .search-bar input', { timeout: 10000 });

    const elements = await this.ownerNameCells.all();
    const names: string[] = [];

    for (const element of elements) {
      const text = await element.textContent();
      if (text && text.trim()) {
        names.push(text.trim().replace(/\s+/g, ' '));
      }
    }

    return names;
  }

  async searchByLastNamePrefix(prefix: string) {
    await this.lastNameInput.waitFor({ state: 'visible' });
    await this.lastNameInput.clear();
    await this.lastNameInput.fill(prefix);
    await this.findOwnerButton.waitFor({ state: 'visible' });
    await this.findOwnerButton.click();
  }

  async waitForOwnersCount(expectedCount: number) {
    try {
      await this.page.waitForFunction(
        (count) => document.querySelectorAll('table.owners-table td.ownerFullName').length === count,
        expectedCount,
        { timeout: 10000 }
      );
    } catch (error) {
      // Let assertions fail with actual values when the wait condition is not met
    }
  }

  /** Click a sortable column header (server-driven sort → URL change + refetch). */
  async sortByColumn(headerText: string) {
    const header = this.page.locator(`th.mat-sort-header:has-text("${headerText}")`);
    await header.waitFor({ state: 'visible' });
    await header.click();
  }

  /** Choose a page size from the mat-paginator (server-driven → URL change + refetch). */
  async selectPageSize(size: number) {
    await this.paginator.locator('mat-select').click();
    await this.page.locator(`mat-option:has-text("${size}")`).first().click();
  }

  async goToNextPage() {
    await this.paginator.locator('button[aria-label="Next page"]').click();
  }

  /** The current URL's query params — the single source of truth for list state. */
  queryParams(): URLSearchParams {
    return new URL(this.page.url()).searchParams;
  }
}
