import { Page, Locator } from '@playwright/test';

export class OwnersPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly lastNameInput: Locator;
  readonly findOwnerButton: Locator;
  readonly ownerNameCells: Locator;
  readonly cityCells: Locator;
  readonly ownersTable: Locator;
  readonly nextPageButton: Locator;
  readonly prevPageButton: Locator;
  readonly paginatorRangeLabel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h2:has-text("Owners")');
    this.lastNameInput = page.locator('#lastName');
    this.findOwnerButton = page.locator('#search-owner-form button[type="submit"]');
    this.ownerNameCells = page.locator('#ownersTable td.ownerFullName');
    this.cityCells = page.locator('#ownersTable td.mat-column-city');
    this.ownersTable = page.locator('#ownersTable');
    this.nextPageButton = page.locator('#ownersTable .mat-mdc-paginator-navigation-next');
    this.prevPageButton = page.locator('#ownersTable .mat-mdc-paginator-navigation-previous');
    this.paginatorRangeLabel = page.locator('#ownersTable .mat-mdc-paginator-range-label');
  }

  async open() {
    await this.page.goto('/owners');
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

  async getCities(): Promise<string[]> {
    const elements = await this.cityCells.all();
    const cities: string[] = [];
    for (const element of elements) {
      const text = await element.textContent();
      if (text && text.trim()) {
        cities.push(text.trim());
      }
    }
    return cities;
  }

  async searchByLastNamePrefix(prefix: string) {
    await this.lastNameInput.waitFor({ state: 'visible' });
    await this.lastNameInput.clear();
    await this.lastNameInput.fill(prefix);
    await this.lastNameInput.press('Tab');

    await this.findOwnerButton.waitFor({ state: 'visible' });
    await this.findOwnerButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /** Clicks a sortable column header (only Name and City are sortable). */
  async sortBy(column: 'name' | 'city') {
    await this.page.locator(`#ownersTable th.mat-column-${column}`).click();
    await this.page.waitForLoadState('networkidle');
  }

  async goToNextPage() {
    await this.nextPageButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async getPaginatorRangeText(): Promise<string> {
    const text = await this.paginatorRangeLabel.textContent();
    return (text ?? '').trim();
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
