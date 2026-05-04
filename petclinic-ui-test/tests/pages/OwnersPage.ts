import { Page, Locator } from '@playwright/test';

export class OwnersPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly searchInput: Locator;
  readonly ownerNameCells: Locator;
  readonly ownersTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h2:has-text("Owners")');
    this.searchInput = page.locator('#ownerSearch');
    this.ownerNameCells = page.locator('#ownersTable td.ownerFullName');
    this.ownersTable = page.locator('#ownersTable');
  }

  async open() {
    await this.page.goto('/owners');
    await this.pageTitle.waitFor({ state: 'visible', timeout: 10000 });
  }

  async getOwnerFullNames(): Promise<string[]> {
    await this.page.waitForSelector('#ownersTable td.ownerFullName, #ownerSearch', { timeout: 10000 });
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
    await this.searchInput.clear();
    await this.searchInput.fill(query);
    // Wait past the 300 ms debounce so the request fires and the table updates.
    await this.page.waitForTimeout(400);
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
