import { Page, Locator } from '@playwright/test';

export class OwnersPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly lastNameInput: Locator;
  readonly findOwnerButton: Locator;
  readonly ownerNameCells: Locator;
  readonly ownersTable: Locator;
  readonly cityCells: Locator;
  readonly paginator: Locator;
  readonly paginatorRangeLabel: Locator;
  readonly nextPageButton: Locator;
  readonly previousPageButton: Locator;
  readonly pageSizeSelect: Locator;
  readonly nameHeader: Locator;
  readonly cityHeader: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h2:has-text("Owners")');
    this.lastNameInput = page.locator('#lastName');
    this.findOwnerButton = page.locator('#search-owner-form button[type="submit"]');
    this.ownerNameCells = page.locator('#ownersTable td.ownerFullName');
    this.ownersTable = page.locator('#ownersTable');
    this.cityCells = page.locator('#ownersTable td.mat-column-city');
    this.paginator = page.locator('mat-paginator');
    this.paginatorRangeLabel = page.locator('.mat-mdc-paginator-range-label');
    this.nextPageButton = page.locator('button.mat-mdc-paginator-navigation-next');
    this.previousPageButton = page.locator('button.mat-mdc-paginator-navigation-previous');
    this.pageSizeSelect = page.locator('mat-paginator mat-select');
    this.nameHeader = page.locator('#ownersTable th.mat-column-name');
    this.cityHeader = page.locator('#ownersTable th.mat-column-city');
  }

  async goToNextPage() {
    await this.nextPageButton.click();
  }

  async sortByCity() {
    await this.cityHeader.click();
  }

  async selectPageSize(size: number) {
    await this.pageSizeSelect.click();
    await this.page.locator(`mat-option:has-text("${size}")`).first().click();
  }

  async getCities(): Promise<string[]> {
    const cells = await this.cityCells.all();
    const cities: string[] = [];
    for (const cell of cells) {
      const text = await cell.textContent();
      if (text && text.trim()) {
        cities.push(text.trim());
      }
    }
    return cities;
  }

  async getTotalFromPaginator(): Promise<number> {
    const label = await this.paginatorRangeLabel.textContent();
    const match = label?.match(/of\s+(\d+)/);
    return match ? Number(match[1]) : 0;
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
