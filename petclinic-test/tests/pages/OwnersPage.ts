import { Page, Locator } from '@playwright/test';

export class OwnersPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly searchInput: Locator;
  readonly ownerNameCells: Locator;
  readonly ownersTable: Locator;
  readonly pageSizeSelect: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h2:has-text("Owners")');
    this.searchInput = page.getByPlaceholder('Search by name, city, address, phone or pet…');
    this.ownerNameCells = page.locator('#ownersTable td.ownerFullName');
    this.ownersTable = page.locator('#ownersTable');
    this.pageSizeSelect = page.locator('#ownerPageSize');
  }

  async open(queryString: string = '') {
    const url = queryString ? `/owners?${queryString}` : '/owners';
    await this.page.goto(url);
    await this.pageTitle.waitFor({ state: 'visible', timeout: 10000 });
  }

  async getOwnerFullNames(): Promise<string[]> {
    await this.page.waitForSelector('#ownersTable td.ownerFullName, input[name="query"]', { timeout: 10000 });

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

  async search(query: string) {
    await this.searchInput.waitFor({ state: 'visible' });
    await this.searchInput.fill(query);
  }

  async clickPage(pageNumber: number) {
    await this.page.locator('.pagination button', { hasText: `${pageNumber}` }).click();
  }

  async changeRowsPerPage(size: number) {
    await this.pageSizeSelect.selectOption(`${size}`);
  }

  async toggleSort(columnName: 'Name' | 'City') {
    await this.page.locator('th button', { hasText: columnName }).click();
  }

  async getPaginationLabels(): Promise<string[]> {
    const labels = await this.page.locator('.pagination button').allTextContents();
    return labels.map(label => label.trim()).filter(label => label.length > 0);
  }

  async getRowsPerPageValue(): Promise<string> {
    return this.pageSizeSelect.inputValue();
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
