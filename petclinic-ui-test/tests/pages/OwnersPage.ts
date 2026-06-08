import { Page, Locator } from '@playwright/test';

export class OwnersPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly lastNameInput: Locator;
  readonly findOwnerButton: Locator;
  readonly ownerNameCells: Locator;
  readonly ownersTable: Locator;
  readonly paginator: Locator;
  readonly rangeLabel: Locator;
  readonly nextButton: Locator;
  readonly prevButton: Locator;
  readonly firstButton: Locator;
  readonly lastButton: Locator;
  readonly sortByName: Locator;
  readonly sortByCity: Locator;
  readonly noOwnersFound: Locator;
  readonly pageSizeSelect: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h2:has-text("Owners")');
    this.lastNameInput = page.locator('#lastName');
    this.findOwnerButton = page.locator('#search-owner-form button[type="submit"]');
    this.ownerNameCells = page.locator('#ownersTable td.ownerFullName');
    this.ownersTable = page.locator('#ownersTable');
    this.paginator = page.locator('#ownersPaginator');
    this.rangeLabel = page.locator('#ownersPaginator .mat-mdc-paginator-range-label');
    this.nextButton = page.locator('#ownersPaginator .mat-mdc-paginator-navigation-next');
    this.prevButton = page.locator('#ownersPaginator .mat-mdc-paginator-navigation-previous');
    this.firstButton = page.locator('#ownersPaginator .mat-mdc-paginator-navigation-first');
    this.lastButton = page.locator('#ownersPaginator .mat-mdc-paginator-navigation-last');
    this.sortByName = page.locator('#sort-name');
    this.sortByCity = page.locator('#sort-city');
    this.noOwnersFound = page.locator('#noOwnersFound');
    this.pageSizeSelect = page.locator('#ownersPaginator .mat-mdc-paginator-page-size mat-select');
  }

  async open() {
    await this.page.goto('/owners');
    await this.pageTitle.waitFor({ state: 'visible', timeout: 10000 });
  }

  async goToUrl(query: string) {
    await this.page.goto(`/owners?${query}`);
    await this.pageTitle.waitFor({ state: 'visible', timeout: 10000 });
  }

  async getRangeLabel(): Promise<string> {
    return (await this.rangeLabel.textContent())?.trim() ?? '';
  }

  async clickNext() {
    await this.nextButton.click();
  }

  async clickPrev() {
    await this.prevButton.click();
  }

  async clickSortByName() {
    await this.sortByName.click();
  }

  async clickSortByCity() {
    await this.sortByCity.click();
  }

  async selectPageSize(size: number) {
    await this.pageSizeSelect.click();
    await this.page.locator(`mat-option:has-text("${size}")`).first().click();
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
