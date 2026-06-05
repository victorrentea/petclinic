import { Page, Locator } from '@playwright/test';

// Client-side sort keys, matching the frozen API contract and the header
// data-testid suffixes (sort-name | sort-address | sort-city).
export type SortKey = 'name' | 'address' | 'city';

// Angular Material's aria-sort values on the active <th>; 'none' when inactive.
export type SortDirection = 'ascending' | 'descending' | 'none';

export class OwnersPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly lastNameInput: Locator;
  readonly findOwnerButton: Locator;
  readonly ownerNameCells: Locator;
  readonly ownersTable: Locator;
  readonly ownerNameLinks: Locator;
  readonly rows: Locator;
  // Paginator pieces — Material's stable selectors, per the UI selector contract.
  readonly paginator: Locator;
  readonly firstPageButton: Locator;
  readonly previousPageButton: Locator;
  readonly nextPageButton: Locator;
  readonly lastPageButton: Locator;
  readonly pageSizeSelect: Locator;
  readonly rangeLabel: Locator;
  // States.
  readonly emptyState: Locator;
  readonly loadingOverlay: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h2:has-text("Owners")');
    this.lastNameInput = page.locator('#lastName');
    this.findOwnerButton = page.locator('#search-owner-form button[type="submit"]');
    this.ownerNameCells = page.locator('#ownersTable td.ownerFullName');
    this.ownersTable = page.locator('#ownersTable');
    this.ownerNameLinks = page.locator('#ownersTable td.ownerFullName a');
    this.rows = page.locator('#ownersTable tbody tr');
    this.paginator = page.locator('[data-testid="owners-paginator"]');
    this.firstPageButton = this.paginator.locator('button[aria-label="First page"]');
    this.previousPageButton = this.paginator.locator('button[aria-label="Previous page"]');
    this.nextPageButton = this.paginator.locator('button[aria-label="Next page"]');
    this.lastPageButton = this.paginator.locator('button[aria-label="Last page"]');
    this.pageSizeSelect = this.paginator.locator('.mat-mdc-paginator-page-size mat-select');
    this.rangeLabel = this.paginator.locator('.mat-mdc-paginator-range-label');
    this.emptyState = page.locator('[data-testid="owners-empty"]');
    this.loadingOverlay = page.locator('[data-testid="owners-loading"]');
  }

  async open() {
    await this.page.goto('/owners');
    await this.pageTitle.waitFor({ state: 'visible', timeout: 10000 });
    await this.waitForIdle();
  }

  // Open the screen with explicit query params, e.g. 'page=2&size=5&sort=city,desc'.
  async openWithQuery(query: string) {
    await this.page.goto(`/owners?${query}`);
    await this.pageTitle.waitFor({ state: 'visible', timeout: 10000 });
    await this.waitForIdle();
  }

  // Wait for any in-flight page fetch to settle so reads see the new rows.
  async waitForIdle() {
    await this.loadingOverlay.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
      // No overlay present (fast fetch already done) — nothing to wait for.
    });
  }

  async getOwnerFullNames(): Promise<string[]> {
    await this.page.waitForSelector('#ownersTable td.ownerFullName, [data-testid="owners-empty"], #lastName', {
      timeout: 10000,
    });
    await this.waitForIdle();

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

  async getRowCount(): Promise<number> {
    await this.waitForIdle();
    return this.ownerNameCells.count();
  }

  // The trimmed name-cell text of the first visible row, or null when empty.
  async getFirstRowName(): Promise<string | null> {
    await this.waitForIdle();
    if ((await this.ownerNameCells.count()) === 0) {
      return null;
    }
    const text = await this.ownerNameCells.first().textContent();
    return text ? text.trim() : null;
  }

  private sortHeader(key: SortKey): Locator {
    return this.page.locator(`#ownersTable th[data-testid="sort-${key}"]`);
  }

  async clickSortHeader(key: SortKey) {
    await this.sortHeader(key).click();
    await this.waitForIdle();
  }

  // Reads Material's aria-sort on the header; returns 'none' when not the active column.
  async getSortDirection(key: SortKey): Promise<SortDirection> {
    const ariaSort = await this.sortHeader(key).getAttribute('aria-sort');
    if (ariaSort === 'ascending' || ariaSort === 'descending') {
      return ariaSort;
    }
    return 'none';
  }

  async searchByLastNamePrefix(prefix: string) {
    await this.lastNameInput.waitFor({ state: 'visible' });
    await this.lastNameInput.clear();
    await this.lastNameInput.fill(prefix);
    await this.lastNameInput.press('Tab');

    await this.findOwnerButton.waitFor({ state: 'visible' });
    await this.findOwnerButton.click();
    await this.waitForIdle();
  }

  async isPaginatorVisible(): Promise<boolean> {
    await this.waitForIdle();
    return this.paginator.isVisible();
  }

  async getRangeLabel(): Promise<string> {
    await this.rangeLabel.waitFor({ state: 'visible', timeout: 10000 });
    const text = await this.rangeLabel.textContent();
    return (text || '').trim();
  }

  async goToFirstPage() {
    await this.firstPageButton.click();
    await this.waitForIdle();
  }

  async goToPreviousPage() {
    await this.previousPageButton.click();
    await this.waitForIdle();
  }

  async goToNextPage() {
    await this.nextPageButton.click();
    await this.waitForIdle();
  }

  async goToLastPage() {
    await this.lastPageButton.click();
    await this.waitForIdle();
  }

  // Pick a page size from Material's mat-select overlay (5 / 10 / 20).
  async selectPageSize(size: number) {
    await this.pageSizeSelect.click();
    const exactText = new RegExp(`^\\s*${size}\\s*$`);
    await this.page.locator('mat-option', { hasText: exactText }).first().click();
    await this.waitForIdle();
  }

  // The page size shown in the paginator's mat-select trigger.
  async getPageSize(): Promise<number> {
    const text = await this.pageSizeSelect.locator('.mat-mdc-select-value').textContent();
    return Number((text || '').trim());
  }

  async openFirstOwnerDetail() {
    await this.ownerNameLinks.first().click();
    await this.pageTitle.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
      // Detail may reuse a heading; navigation away from the list is enough.
    });
  }

  async getEmptyMessage(): Promise<string | null> {
    if (!(await this.emptyState.isVisible())) {
      return null;
    }
    const text = await this.emptyState.textContent();
    return text ? text.trim() : null;
  }

  async waitForOwnersCount(expectedCount: number) {
    try {
      await this.page.waitForFunction(
        (count) => {
          const cells = document.querySelectorAll('#ownersTable td.ownerFullName');
          return cells.length === count;
        },
        expectedCount,
        { timeout: 10000 }
      );
    } catch (error) {
      // Let assertions fail with actual values when wait condition is not met
    }
  }
}
